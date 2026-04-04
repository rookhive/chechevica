use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use serde::Deserialize;

use crate::application::interfaces::{
  embeddings::{EmbeddingInputKind, EmbeddingService},
  jobs::{self, JobEvent, JobEventSender, JobParam},
};

#[derive(Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
struct EmbeddingParams {}

pub struct EmbeddingEngine {
  embedding_service: Arc<dyn EmbeddingService>,
}

impl EmbeddingEngine {
  pub fn new(embedding_service: Arc<dyn EmbeddingService>) -> Self {
    Self { embedding_service }
  }

  fn parse_params_json(&self, params_json: &str) -> anyhow::Result<EmbeddingParams> {
    serde_json::from_str(params_json).context("Parse embedding params JSON")
  }
}

#[async_trait]
impl jobs::JobEngine for EmbeddingEngine {
  fn params(&self) -> Vec<JobParam> {
    vec![]
  }

  fn validate_params(&self, params_json: &str) -> anyhow::Result<()> {
    self.parse_params_json(params_json)?;
    Ok(())
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.embedding_service.unload_model().await
  }
}

#[async_trait]
impl jobs::EmbeddingEngine for EmbeddingEngine {
  async fn embed_segments(
    &self,
    segments: Vec<String>,
    params_json: &str,
    events: JobEventSender,
  ) -> anyhow::Result<Vec<Vec<f32>>> {
    self.parse_params_json(params_json)?;

    let total = segments.len();
    let ready_events = events.clone();
    let progress_events = events.clone();
    let mut on_ready = move || {
      let _ = ready_events.send(JobEvent::ModelReady);
    };
    let mut on_progress = move |percent| {
      let _ = progress_events.send(JobEvent::Progress { percent });
    };

    let embeddings = self
      .embedding_service
      .generate_embeddings(
        &segments,
        EmbeddingInputKind::Document,
        &mut on_ready,
        &mut on_progress,
      )
      .await?;

    if embeddings.len() != total {
      anyhow::bail!("Expected {} embeddings, got {}", total, embeddings.len())
    }

    self.embedding_service.schedule_unload();

    Ok(embeddings)
  }
}
