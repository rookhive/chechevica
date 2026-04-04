use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use tokio_util::sync::CancellationToken;

use crate::application::{
  interfaces::{
    filesystem::Filesystem,
    jobs::{IngestMetadata, IngestionEngine, JobEventSender},
    repository::Repository,
  },
  jobs::{executors::JobExecutor, job::Job},
};
use crate::entities::source::{SourceMediaType, SourceUpdate};

pub struct IngestExecutor {
  store: Arc<dyn Repository>,
  filesystem: Arc<dyn Filesystem>,
  engine: Arc<dyn IngestionEngine>,
}

impl IngestExecutor {
  pub fn new(
    store: Arc<dyn Repository>,
    filesystem: Arc<dyn Filesystem>,
    engine: Arc<dyn IngestionEngine>,
  ) -> Self {
    Self {
      store,
      filesystem,
      engine,
    }
  }

  async fn execute(&self, job: &Job) -> anyhow::Result<()> {
    let source = self
      .store
      .fetch_source(&job.source_id)
      .await?
      .context("Fetch source")?;

    let origin_path = &source.origin;
    let source_directory = self
      .filesystem
      .ensure_source_directory(&source.project_id, &job.source_id)?;

    let IngestMetadata {
      title,
      created_at,
      duration,
    } = self.engine.fetch_metadata(origin_path).await?;

    let artifact_filename = self.filesystem.create_artifact_filename(origin_path)?;
    let artifact_path = self.filesystem.get_source_artifact_path(
      &source.project_id,
      &job.source_id,
      &artifact_filename,
    )?;

    self
      .store
      .update_source(
        &job.source_id,
        &SourceUpdate {
          title: Some(Some(title.clone())),
          origin_created_at: Some(created_at),
          duration: Some(Some(duration)),
          ..Default::default()
        },
      )
      .await?;

    if matches!(source.media_type, SourceMediaType::Video) {
      let thumbnail = self
        .engine
        .fetch_thumbnail(origin_path, &source_directory, duration)
        .await?;

      self
        .store
        .update_source(
          &job.source_id,
          &SourceUpdate {
            thumbnail: Some(Some(thumbnail.filename.clone())),
            ..Default::default()
          },
        )
        .await?;
    }

    self
      .engine
      .ingest(origin_path, &artifact_path, &job.params_json)
      .await?;

    let artifact_size = self.filesystem.get_file_size(&artifact_path)?;

    self
      .store
      .update_artifact(&job.source_id, &artifact_filename, artifact_size)
      .await?;

    Ok(())
  }
}

#[async_trait]
impl JobExecutor for IngestExecutor {
  async fn run(
    &self,
    job: &Job,
    token: CancellationToken,
    _events: JobEventSender,
  ) -> anyhow::Result<()> {
    tokio::select! {
      result = self.execute(job) => result,
      _ = token.cancelled() => {
        self.engine.shutdown().await?;
        anyhow::bail!("Ingest job cancelled");
      }
    }
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.engine.shutdown().await
  }
}
