use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::application::{
  interfaces::{
    embeddings::EmbeddingService,
    filesystem::Filesystem,
    jobs::{JobEventSender, TranscriptionEngine},
    repository::Repository,
    search::SearchService,
  },
  jobs::{executors::JobExecutor, job::Job},
};

pub struct TranscriptionExecutor {
  store: Arc<dyn Repository>,
  filesystem: Arc<dyn Filesystem>,
  embedding_service: Arc<dyn EmbeddingService>,
  engine: Arc<dyn TranscriptionEngine>,
  gpu_lock: Arc<Mutex<()>>,
  search_service: Arc<dyn SearchService>,
}

impl TranscriptionExecutor {
  pub fn new(
    store: Arc<dyn Repository>,
    filesystem: Arc<dyn Filesystem>,
    embedding_service: Arc<dyn EmbeddingService>,
    engine: Arc<dyn TranscriptionEngine>,
    gpu_lock: Arc<Mutex<()>>,
    search_service: Arc<dyn SearchService>,
  ) -> Self {
    Self {
      store,
      filesystem,
      embedding_service,
      engine,
      gpu_lock,
      search_service,
    }
  }

  async fn execute(&self, job: &Job, events: JobEventSender) -> anyhow::Result<()> {
    let source = self
      .store
      .fetch_source(&job.source_id)
      .await?
      .context("Fetch source")?;

    let artifact = self
      .store
      .fetch_artifact(&job.source_id)
      .await?
      .context("Fetch source artifact")?;

    let media_path = self.filesystem.get_source_artifact_path(
      &source.project_id,
      &job.source_id,
      &artifact.filename,
    )?;

    let _ = self.gpu_lock.lock().await;

    self.embedding_service.unload_model().await?;

    let segments = self
      .engine
      .transcribe(&media_path, &job.params_json, events)
      .await?;

    self
      .store
      .update_segments(&job.source_id, &segments)
      .await?;

    let segments_with_ids = self.store.fetch_segments(&job.source_id).await?;

    self
      .search_service
      .update_index(&source.project_id, &job.source_id, &segments_with_ids)
      .await
      .context("Update search index after transcription")?;

    Ok(())
  }
}

#[async_trait]
impl JobExecutor for TranscriptionExecutor {
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
        anyhow::bail!("Transcription job cancelled");
      }
    }
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.engine.shutdown().await
  }
}
