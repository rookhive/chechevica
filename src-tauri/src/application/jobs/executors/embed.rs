use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use tokio_util::sync::CancellationToken;

use crate::application::{
  interfaces::{
    jobs::{EmbeddingEngine, JobEventSender},
    repository::Repository,
    vectors::{SegmentEmbedding, VectorStore},
  },
  jobs::{executors::JobExecutor, job::Job},
};

pub struct EmbeddingExecutor {
  store: Arc<dyn Repository>,
  vector_store: Arc<dyn VectorStore>,
  engine: Arc<dyn EmbeddingEngine>,
}

impl EmbeddingExecutor {
  pub fn new(
    store: Arc<dyn Repository>,
    vector_store: Arc<dyn VectorStore>,
    engine: Arc<dyn EmbeddingEngine>,
  ) -> Self {
    Self {
      store,
      vector_store,
      engine,
    }
  }

  async fn execute(&self, job: &Job, events: JobEventSender) -> anyhow::Result<()> {
    let source = self
      .store
      .fetch_source(&job.source_id)
      .await?
      .context("Fetch source")?;

    let segments = self.store.fetch_segments(&job.source_id).await?;

    if segments.is_empty() {
      return Ok(());
    }

    let segment_ids: Vec<_> = segments.iter().map(|s| s.id).collect();
    let segment_texts: Vec<_> = segments.iter().map(|s| s.text.clone()).collect();

    let vectors = self
      .engine
      .embed_segments(segment_texts, &job.params_json, events)
      .await?;

    let embeddings: Vec<SegmentEmbedding> = segment_ids
      .iter()
      .zip(vectors)
      .map(|(&segment_id, vector)| SegmentEmbedding {
        segment_id,
        source_id: source.id.clone(),
        vector,
      })
      .collect();

    self.vector_store.create_project(&source.project_id).await?;

    self
      .vector_store
      .upsert_segments(&source.project_id, &embeddings)
      .await?;

    Ok(())
  }
}

#[async_trait]
impl JobExecutor for EmbeddingExecutor {
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
        anyhow::bail!("Embedding job cancelled");
      }
    }
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.engine.shutdown().await
  }
}
