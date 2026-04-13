use async_trait::async_trait;
use std::{
  path::PathBuf,
  sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
  },
};

use anyhow::Context;
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use hf_hub::Cache;
use tokio::{
  task,
  time::{Duration, Instant, sleep},
};
use tokio_util::sync::CancellationToken;

use crate::{
  application::interfaces::embeddings::{EmbeddingInputKind, EmbeddingService},
  infra::embeddings::normalize::l2_normalize_embeddings,
};

const EMBEDDING_MODEL: EmbeddingModel = EmbeddingModel::MultilingualE5Large;
const EMBEDDING_MODEL_NAME: &str = "intfloat/multilingual-e5-large";
const MODEL_IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const EMBEDDING_BATCH_SIZE: usize = 16;

struct FastembedState {
  cache_directory: PathBuf,
  model: Mutex<Option<TextEmbedding>>,
  unload_generation: AtomicU64,
  unload_cancel: Mutex<Option<CancellationToken>>,
}

pub struct FastembedService {
  state: Arc<FastembedState>,
}

impl FastembedService {
  pub fn new() -> Self {
    Self {
      state: Arc::new(FastembedState {
        cache_directory: Cache::from_env().path().clone(),
        model: Mutex::new(None),
        unload_generation: AtomicU64::new(0),
        unload_cancel: Mutex::new(None),
      }),
    }
  }

  fn mark_used(&self) {
    self.state.unload_generation.fetch_add(1, Ordering::Relaxed);

    if let Ok(mut guard) = self.state.unload_cancel.lock()
      && let Some(token) = guard.take()
    {
      token.cancel();
    }
  }

  fn reset_poisoned_model() -> Option<TextEmbedding> {
    None
  }

  async fn generate_embeddings_inner(
    &self,
    inputs: &[String],
    kind: EmbeddingInputKind,
    on_ready: &mut (dyn FnMut() + Send),
  ) -> anyhow::Result<Vec<Vec<f32>>> {
    if inputs.is_empty() {
      return Ok(Vec::new());
    }

    self.mark_used();

    let state_for_load = Arc::clone(&self.state);
    let state_for_embed = Arc::clone(&self.state);
    let cache_directory = self.state.cache_directory.clone();
    let formatted_inputs = inputs
      .iter()
      .map(|input| Self::format_input(input.trim(), kind))
      .collect::<Vec<String>>();
    let batch_size = formatted_inputs.len();

    task::spawn_blocking(move || -> anyhow::Result<()> {
      let mut guard = match state_for_load.model.lock() {
        Ok(guard) => guard,
        Err(error) => {
          let mut guard = error.into_inner();
          *guard = Self::reset_poisoned_model();
          guard
        }
      };

      if guard.is_none() {
        let started_at = Instant::now();

        if cfg!(debug_assertions) {
          println!("Loading embedding model {EMBEDDING_MODEL_NAME}...");
        }

        let model = TextEmbedding::try_new(
          TextInitOptions::new(EMBEDDING_MODEL).with_cache_dir(cache_directory),
        )
        .context("Build embedding model")?;
        *guard = Some(model);

        if cfg!(debug_assertions) {
          println!(
            "Embedding model {EMBEDDING_MODEL_NAME} is loaded on CPU in {:.2}s.",
            started_at.elapsed().as_secs_f32()
          );
        }

        Ok(())
      } else {
        Ok(())
      }
    })
    .await
    .context("Run FastEmbed model load task")??;

    on_ready();

    task::spawn_blocking(move || {
      let mut guard = match state_for_embed.model.lock() {
        Ok(guard) => guard,
        Err(error) => {
          let mut guard = error.into_inner();
          *guard = Self::reset_poisoned_model();
          guard
        }
      };

      let model = guard.as_mut().context("Missing FastEmbed model")?;
      let started_at = Instant::now();
      let outputs = model
        .embed(formatted_inputs.clone(), Some(batch_size))
        .context("Generate embeddings")?;

      if outputs.len() != formatted_inputs.len() {
        anyhow::bail!(
          "Expected {} embedding outputs, got {}",
          formatted_inputs.len(),
          outputs.len()
        )
      }

      if cfg!(debug_assertions) && formatted_inputs.len() > 1 {
        println!(
          "Generated {} embeddings with {EMBEDDING_MODEL_NAME} in {:.2}s.",
          formatted_inputs.len(),
          started_at.elapsed().as_secs_f32()
        );
      }

      l2_normalize_embeddings(outputs)
    })
    .await
    .context("Run FastEmbed task")?
  }

  fn format_input(input: &str, kind: EmbeddingInputKind) -> String {
    match kind {
      EmbeddingInputKind::Query => format!("query: {input}"),
      EmbeddingInputKind::Document => format!("passage: {input}"),
    }
  }
}

#[async_trait]
impl EmbeddingService for FastembedService {
  async fn generate_embeddings(
    &self,
    inputs: &[String],
    kind: EmbeddingInputKind,
    on_ready: &mut (dyn FnMut() + Send),
    on_progress: &mut (dyn FnMut(u8) + Send),
  ) -> anyhow::Result<Vec<Vec<f32>>> {
    let mut outputs = Vec::with_capacity(inputs.len());
    let total = inputs.len();

    for batch in inputs.chunks(EMBEDDING_BATCH_SIZE) {
      let mut batch_outputs = self
        .generate_embeddings_inner(batch, kind, on_ready)
        .await?;
      outputs.append(&mut batch_outputs);
      let percent = ((outputs.len() * 100) / total) as u8;
      on_progress(percent);
    }

    Ok(outputs)
  }

  fn schedule_unload(&self) {
    let generation = self.state.unload_generation.fetch_add(1, Ordering::Relaxed) + 1;
    let state = Arc::clone(&self.state);

    let token = CancellationToken::new();
    {
      if let Ok(mut guard) = self.state.unload_cancel.lock() {
        if let Some(old) = guard.take() {
          old.cancel();
        }
        *guard = Some(token.clone());
      }
    }

    tokio::spawn(async move {
      tokio::select! {
        _ = sleep(MODEL_IDLE_TIMEOUT) => {},
        _ = token.cancelled() => return,
      }

      if state.unload_generation.load(Ordering::Relaxed) != generation {
        return;
      }

      let unloaded = match state.model.lock() {
        Ok(mut guard) => guard.take().is_some(),
        Err(error) => {
          let mut guard = error.into_inner();
          guard.take().is_some()
        }
      };

      if unloaded && cfg!(debug_assertions) {
        println!(
          "Unloaded embedding model {EMBEDDING_MODEL_NAME} after {:.0}s idle.",
          MODEL_IDLE_TIMEOUT.as_secs_f32()
        );
      }
    });
  }

  async fn unload_model(&self) -> anyhow::Result<()> {
    self.mark_used();
    if let Ok(mut guard) = self.state.unload_cancel.lock()
      && let Some(token) = guard.take()
    {
      token.cancel();
    }
    let unloaded = match self.state.model.lock() {
      Ok(mut guard) => guard.take().is_some(),
      Err(error) => {
        let mut guard = error.into_inner();
        guard.take().is_some()
      }
    };

    if unloaded && cfg!(debug_assertions) {
      println!("Unloaded embedding model {EMBEDDING_MODEL_NAME} on explicit shutdown.");
    }

    Ok(())
  }
}
