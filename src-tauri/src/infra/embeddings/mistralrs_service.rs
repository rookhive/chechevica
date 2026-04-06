use async_trait::async_trait;
use std::{
  sync::Arc,
  sync::atomic::{AtomicU64, Ordering},
  time::Instant,
};

use anyhow::Context;
use mistralrs::{Device, EmbeddingModelBuilder, EmbeddingRequest, Model, ModelDType};
use tokio::{
  sync::{Mutex, RwLock},
  time::{Duration, sleep},
};
use tokio_util::sync::CancellationToken;

use crate::{
  application::interfaces::embeddings::{EmbeddingInputKind, EmbeddingService},
  infra::embeddings::normalize::l2_normalize_embeddings,
};

const EMBEDDING_MODEL: &str = "Qwen/Qwen3-Embedding-0.6B";
const MODEL_IDLE_TIMEOUT: Duration = Duration::from_secs(120);
const QUERY_RETRIEVAL_TASK: &str = "Given a user search query, retrieve relevant transcript passages that answer or closely match the query.";
const EMBEDDING_BATCH_SIZE: usize = 8;

struct MistralrsState {
  model: RwLock<Option<Arc<Model>>>,
  gpu_lock: Arc<Mutex<()>>,
  unload_generation: AtomicU64,
  unload_cancel: Mutex<Option<CancellationToken>>,
}

pub struct MistralrsService {
  state: Arc<MistralrsState>,
}

impl MistralrsService {
  pub fn new(gpu_lock: Arc<Mutex<()>>) -> Self {
    Self {
      state: Arc::new(MistralrsState {
        model: RwLock::new(None),
        gpu_lock,
        unload_generation: AtomicU64::new(0),
        unload_cancel: Mutex::new(None),
      }),
    }
  }

  async fn mark_used(&self) {
    self.state.unload_generation.fetch_add(1, Ordering::Relaxed);

    let mut guard = self.state.unload_cancel.lock().await;
    if let Some(token) = guard.take() {
      token.cancel();
    }
  }

  async fn get_or_load_model(&self) -> anyhow::Result<Arc<Model>> {
    if let Some(model) = self.state.model.read().await.clone() {
      return Ok(model);
    }

    let mut guard = self.state.model.write().await;

    if let Some(model) = guard.clone() {
      return Ok(model);
    }

    #[cfg(feature = "cuda")]
    let device = Device::new_cuda(0).context("Initialize CUDA device for embedding model")?;

    #[cfg(feature = "cuda")]
    let build_model = |dtype| {
      EmbeddingModelBuilder::new(EMBEDDING_MODEL)
        .with_dtype(dtype)
        .with_logging()
        .with_device(device.clone())
        .build()
    };

    #[cfg(feature = "cpu")]
    let device = Device::Cpu;

    #[cfg(feature = "cpu")]
    let build_model = || {
      EmbeddingModelBuilder::new(EMBEDDING_MODEL)
        .with_dtype(ModelDType::Auto)
        .with_logging()
        .with_force_cpu()
        .build()
    };

    let started_at = Instant::now();

    if cfg!(debug_assertions) {
      println!("Loading embedding model {EMBEDDING_MODEL}...");
    }

    #[cfg(feature = "cuda")]
    let model = match build_model(ModelDType::BF16).await {
      Ok(model) => model,
      Err(_) => build_model(ModelDType::F16)
        .await
        .context("Build embedding model")?,
    };

    #[cfg(feature = "cpu")]
    let model = build_model().await.context("Build embedding model")?;

    let model = Arc::new(model);
    *guard = Some(model.clone());

    if cfg!(debug_assertions) {
      println!(
        "Embedding model {EMBEDDING_MODEL} is loaded on {device:?} in {:.2}s.",
        started_at.elapsed().as_secs_f32()
      );
    }

    Ok(model)
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

    self.mark_used().await;
    let _gpu_guard = self.state.gpu_lock.lock().await;

    let model = self
      .get_or_load_model()
      .await
      .context("Load embedding model")?;
    on_ready();

    let request = EmbeddingRequest::builder().add_prompts(
      inputs
        .iter()
        .map(|input| Self::format_input(input.trim(), kind)),
    );
    let started_at = Instant::now();
    let outputs = model
      .generate_embeddings_with_model(request, Some(EMBEDDING_MODEL))
      .await
      .context("Generate embeddings")?;

    if outputs.len() != inputs.len() {
      anyhow::bail!(
        "Expected {} embedding outputs, got {}",
        inputs.len(),
        outputs.len()
      )
    }

    let normalized = l2_normalize_embeddings(outputs)?;

    if cfg!(debug_assertions) && inputs.len() > 1 {
      println!(
        "Generated {} embeddings with {EMBEDDING_MODEL} in {:.2}s.",
        inputs.len(),
        started_at.elapsed().as_secs_f32()
      );
    }

    Ok(normalized)
  }

  fn format_input(input: &str, kind: EmbeddingInputKind) -> String {
    match kind {
      EmbeddingInputKind::Query => format!("Instruct: {QUERY_RETRIEVAL_TASK}\nQuery:{input}"),
      EmbeddingInputKind::Document => input.to_string(),
    }
  }

  async fn shutdown_model_runner_locked(&self) -> anyhow::Result<bool> {
    let Some(model) = self.state.model.read().await.clone() else {
      return Ok(false);
    };

    let was_loaded = model
      .is_model_loaded(EMBEDDING_MODEL)
      .context("Check embedding model loaded status")?;

    if was_loaded {
      model
        .unload_model(EMBEDDING_MODEL)
        .context("Unload embedding model")?;
    }

    let runner = self.state.model.write().await.take();
    drop(runner);

    Ok(was_loaded)
  }
}

impl Default for MistralrsService {
  fn default() -> Self {
    Self::new(Arc::new(Mutex::new(())))
  }
}

#[async_trait]
impl EmbeddingService for MistralrsService {
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
    let service = Self {
      state: Arc::clone(&self.state),
    };

    let token = CancellationToken::new();
    if let Ok(mut guard) = self.state.unload_cancel.try_lock() {
      if let Some(old) = guard.take() {
        old.cancel();
      }
      *guard = Some(token.clone());
    }

    tokio::spawn(async move {
      tokio::select! {
        _ = sleep(MODEL_IDLE_TIMEOUT) => {},
        _ = token.cancelled() => return,
      }

      if service.state.unload_generation.load(Ordering::Relaxed) != generation {
        return;
      }

      let _gpu_guard = service.state.gpu_lock.lock().await;

      match service.shutdown_model_runner_locked().await {
        Ok(true) if cfg!(debug_assertions) => {
          println!(
            "Unloaded embedding model {EMBEDDING_MODEL} after {:.0}s idle.",
            MODEL_IDLE_TIMEOUT.as_secs_f32()
          );
        }
        Ok(_) => {}
        Err(error) => {
          eprintln!("Failed to unload embedding model after idle timeout: {error:#}");
        }
      }
    });
  }

  async fn unload_model(&self) -> anyhow::Result<()> {
    self.mark_used().await;
    let mut guard = self.state.unload_cancel.lock().await;
    if let Some(token) = guard.take() {
      token.cancel();
    }
    drop(guard);

    let _gpu_guard = self.state.gpu_lock.lock().await;
    let unloaded = self.shutdown_model_runner_locked().await?;

    if unloaded && cfg!(debug_assertions) {
      println!("Unloaded embedding model {EMBEDDING_MODEL} on explicit shutdown.");
    }

    Ok(())
  }
}
