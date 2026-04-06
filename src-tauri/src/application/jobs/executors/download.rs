use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use tokio_util::sync::CancellationToken;

use crate::application::{
  interfaces::{
    events::EventEmitter,
    filesystem::Filesystem,
    jobs::{DownloadEngine, JobEventSender},
    repository::Repository,
  },
  jobs::{executors::JobExecutor, job::Job},
};
use crate::entities::source::SourceUpdate;

pub struct DownloadExecutor {
  store: Arc<dyn Repository>,
  emitter: Arc<dyn EventEmitter>,
  filesystem: Arc<dyn Filesystem>,
  engine: Arc<dyn DownloadEngine>,
}

impl DownloadExecutor {
  pub fn new(
    store: Arc<dyn Repository>,
    emitter: Arc<dyn EventEmitter>,
    filesystem: Arc<dyn Filesystem>,
    engine: Arc<dyn DownloadEngine>,
  ) -> Self {
    Self {
      store,
      emitter,
      filesystem,
      engine,
    }
  }

  async fn execute(&self, job: &Job, events: JobEventSender) -> anyhow::Result<()> {
    let source = self
      .store
      .fetch_source(&job.source_id)
      .await?
      .context("Fetch source")?;

    let url = &source.origin;
    let source_directory = self
      .filesystem
      .ensure_source_directory(&source.project_id, &job.source_id)?;

    let metadata = self.engine.fetch_metadata(url, &job.params_json).await?;

    let updated_source = self
      .store
      .update_source(
        &job.source_id,
        &SourceUpdate {
          title: Some(Some(metadata.title.clone())),
          duration: Some(Some(metadata.duration as f64)),
          origin_created_at: Some(metadata.uploaded_at),
          ..Default::default()
        },
      )
      .await?;

    self.emitter.emit_source_update(&updated_source)?;

    let thumbnail = self
      .engine
      .fetch_thumbnail(url, &job.params_json, &source_directory)
      .await?;

    let updated_source = self
      .store
      .update_source(
        &job.source_id,
        &SourceUpdate {
          thumbnail: Some(Some(thumbnail.filename.clone())),
          ..Default::default()
        },
      )
      .await?;

    self.emitter.emit_source_update(&updated_source)?;

    let artifact = self
      .engine
      .download_media(
        url,
        &source.media_type,
        &source_directory,
        &job.params_json,
        events,
      )
      .await?;

    let artifact_filename = self.filesystem.ingest_source_artifact(
      &source.project_id,
      &job.source_id,
      &artifact.absolute_path,
      &artifact.filename,
    )?;

    let artifact_path = self.filesystem.get_source_artifact_path(
      &source.project_id,
      &job.source_id,
      &artifact_filename,
    )?;

    let artifact_size = self.filesystem.get_file_size(&artifact_path)?;
    let artifact_mime_type = self.filesystem.get_mime_type(&artifact_path)?;

    self
      .store
      .update_artifact(
        &job.source_id,
        &artifact_filename,
        artifact_size,
        &artifact_mime_type,
      )
      .await?;

    Ok(())
  }
}

#[async_trait]
impl JobExecutor for DownloadExecutor {
  async fn run(
    &self,
    job: &Job,
    token: CancellationToken,
    events: JobEventSender,
  ) -> anyhow::Result<()> {
    tokio::select! {
      result = self.execute(job, events) => result,
      _ = token.cancelled() => {
        self.engine.shutdown().await?;
        anyhow::bail!("Download job cancelled");
      }
    }
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.engine.shutdown().await
  }
}
