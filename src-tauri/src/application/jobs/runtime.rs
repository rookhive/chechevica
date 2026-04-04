use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
};

use anyhow::Context;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tauri::async_runtime::spawn;
use tokio::sync::{
  Mutex as AsyncMutex,
  mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
};
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

use crate::application::{
  interfaces::{
    embeddings::EmbeddingService,
    events::EventEmitter,
    filesystem::Filesystem,
    jobs::{DownloadEngine, EmbeddingEngine, IngestionEngine, JobParam, TranscriptionEngine},
    repository::Repository,
    search::SearchService,
    vectors::VectorStore,
  },
  jobs::{
    executors::{
      download::DownloadExecutor, embed::EmbeddingExecutor, ingest::IngestExecutor,
      transcribe::TranscriptionExecutor,
    },
    job::{JobId, JobKind},
    service::{JobDriver, JobService},
    workers::{heavy::HeavyWorker, serial::SerialWorker},
  },
};

pub type Wakeup = ();

#[derive(Serialize, Deserialize, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct StepParameters {
  ingest: Vec<JobParam>,
  download: Vec<JobParam>,
  transcribe: Vec<JobParam>,
  embed: Vec<JobParam>,
}

pub struct JobRuntime {
  tx_ingest: UnboundedSender<Wakeup>,
  tx_download: UnboundedSender<Wakeup>,
  tx_transcribe: UnboundedSender<Wakeup>,
  tx_embed: UnboundedSender<Wakeup>,
  rx_ingest: Mutex<Option<UnboundedReceiver<Wakeup>>>,
  rx_download: Mutex<Option<UnboundedReceiver<Wakeup>>>,
  rx_transcribe: Mutex<Option<UnboundedReceiver<Wakeup>>>,
  rx_embed: Mutex<Option<UnboundedReceiver<Wakeup>>>,
  ingestion_engine: Arc<dyn IngestionEngine>,
  download_engine: Arc<dyn DownloadEngine>,
  transcription_engine: Arc<dyn TranscriptionEngine>,
  embedding_engine: Arc<dyn EmbeddingEngine>,
  registry: Arc<dyn CancellationRegistry>,
}

impl JobRuntime {
  pub fn new(
    ingestion_engine: Arc<dyn IngestionEngine>,
    download_engine: Arc<dyn DownloadEngine>,
    transcription_engine: Arc<dyn TranscriptionEngine>,
    embedding_engine: Arc<dyn EmbeddingEngine>,
  ) -> Self {
    let (tx_ingest, rx_ingest) = unbounded_channel::<Wakeup>();
    let (tx_download, rx_download) = unbounded_channel::<Wakeup>();
    let (tx_transcribe, rx_transcribe) = unbounded_channel::<Wakeup>();
    let (tx_embed, rx_embed) = unbounded_channel::<Wakeup>();

    let registry = Arc::new(JobCancellationRegistry::new());

    Self {
      tx_ingest,
      tx_download,
      tx_transcribe,
      tx_embed,
      rx_ingest: Mutex::new(Some(rx_ingest)),
      rx_download: Mutex::new(Some(rx_download)),
      rx_transcribe: Mutex::new(Some(rx_transcribe)),
      rx_embed: Mutex::new(Some(rx_embed)),
      ingestion_engine,
      download_engine,
      transcription_engine,
      embedding_engine,
      registry,
    }
  }

  #[allow(clippy::too_many_arguments)]
  pub fn start(
    &self,
    store: Arc<dyn Repository>,
    emitter: Arc<dyn EventEmitter>,
    filesystem: Arc<dyn Filesystem>,
    vector_store: Arc<dyn VectorStore>,
    embedding_service: Arc<dyn EmbeddingService>,
    search_service: Arc<dyn SearchService>,
    job_service: Arc<JobService>,
    gpu_lock: Arc<AsyncMutex<()>>,
  ) -> anyhow::Result<()> {
    let rx_ingest = self
      .rx_ingest
      .lock()
      .map_err(|_| anyhow::anyhow!("Acquire ingest receiver"))?
      .take()
      .context("Ingest worker already started")?;

    let rx_download = self
      .rx_download
      .lock()
      .map_err(|_| anyhow::anyhow!("Acquire download receiver"))?
      .take()
      .context("Download worker already started")?;

    let rx_transcribe = self
      .rx_transcribe
      .lock()
      .map_err(|_| anyhow::anyhow!("Acquire transcribe receiver"))?
      .take()
      .context("Transcribe worker already started")?;

    let rx_embed = self
      .rx_embed
      .lock()
      .map_err(|_| anyhow::anyhow!("Acquire embed receiver"))?
      .take()
      .context("Embed worker already started")?;

    spawn(
      SerialWorker::new(
        (
          JobKind::Ingest,
          rx_ingest,
          Arc::new(IngestExecutor::new(
            store.clone(),
            filesystem.clone(),
            self.ingestion_engine.clone(),
          )),
        ),
        store.clone(),
        emitter.clone(),
        self.registry.clone(),
        job_service.clone(),
      )
      .run(),
    );

    spawn(
      SerialWorker::new(
        (
          JobKind::Download,
          rx_download,
          Arc::new(DownloadExecutor::new(
            store.clone(),
            emitter.clone(),
            filesystem.clone(),
            self.download_engine.clone(),
          )),
        ),
        store.clone(),
        emitter.clone(),
        self.registry.clone(),
        job_service.clone(),
      )
      .run(),
    );

    spawn(
      HeavyWorker::new(
        vec![
          (
            JobKind::Transcribe,
            rx_transcribe,
            Arc::new(TranscriptionExecutor::new(
              store.clone(),
              filesystem.clone(),
              embedding_service,
              self.transcription_engine.clone(),
              gpu_lock.clone(),
              search_service.clone(),
            )),
          ),
          (
            JobKind::Embed,
            rx_embed,
            Arc::new(EmbeddingExecutor::new(
              store.clone(),
              vector_store,
              self.embedding_engine.clone(),
            )),
          ),
        ],
        store,
        emitter,
        self.registry.clone(),
        job_service,
      )
      .run(),
    );

    Ok(())
  }

  pub async fn wake(&self, kind: &JobKind) -> anyhow::Result<()> {
    match kind {
      JobKind::Ingest => self.tx_ingest.send(())?,
      JobKind::Download => self.tx_download.send(())?,
      JobKind::Transcribe => self.tx_transcribe.send(())?,
      JobKind::Embed => self.tx_embed.send(())?,
    }

    Ok(())
  }

  pub fn cancel(&self, job_id: &JobId) -> bool {
    self.registry.cancel(*job_id)
  }

  pub fn step_parameters(&self) -> StepParameters {
    StepParameters {
      ingest: self.ingestion_engine.params(),
      download: self.download_engine.params(),
      transcribe: self.transcription_engine.params(),
      embed: self.embedding_engine.params(),
    }
  }

  pub fn validate_job_params(&self, kind: &JobKind, params_json: &str) -> anyhow::Result<()> {
    match kind {
      JobKind::Ingest => self.ingestion_engine.validate_params(params_json),
      JobKind::Download => self.download_engine.validate_params(params_json),
      JobKind::Transcribe => self.transcription_engine.validate_params(params_json),
      JobKind::Embed => self.embedding_engine.validate_params(params_json),
    }
  }
}

#[async_trait]
impl JobDriver for JobRuntime {
  async fn wake(&self, kind: &JobKind) -> anyhow::Result<()> {
    JobRuntime::wake(self, kind).await
  }

  fn cancel(&self, job_id: &JobId) -> bool {
    JobRuntime::cancel(self, job_id)
  }
}

pub trait CancellationRegistry: Send + Sync {
  fn register(&self, job_id: JobId, token: CancellationToken);
  fn unregister(&self, job_id: JobId);
  fn cancel(&self, job_id: JobId) -> bool;
}

pub struct JobCancellationRegistry {
  tokens: Mutex<HashMap<JobId, CancellationToken>>,
}

impl JobCancellationRegistry {
  pub fn new() -> Self {
    Self {
      tokens: Mutex::new(HashMap::new()),
    }
  }
}

impl CancellationRegistry for JobCancellationRegistry {
  fn register(&self, job_id: JobId, token: CancellationToken) {
    if let Ok(mut tokens) = self.tokens.lock() {
      tokens.insert(job_id, token);
    }
  }

  fn unregister(&self, job_id: JobId) {
    if let Ok(mut tokens) = self.tokens.lock() {
      tokens.remove(&job_id);
    }
  }

  fn cancel(&self, job_id: JobId) -> bool {
    self
      .tokens
      .lock()
      .ok()
      .and_then(|tokens| tokens.get(&job_id).map(|token| token.cancel()))
      .is_some()
  }
}
