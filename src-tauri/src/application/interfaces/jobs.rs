use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;
use ts_rs::TS;

use crate::entities::{segment::NewSegment, source::SourceMediaType};

#[derive(Debug, Clone)]
pub enum JobEvent {
  Progress { percent: u8 },
  ModelReady,
}

pub type JobEventSender = UnboundedSender<JobEvent>;

pub struct IngestMetadata {
  pub title: String,
  pub created_at: Option<i64>,
  pub duration: f64,
}

pub struct DownloadMetadata {
  pub title: String,
  pub duration: f64,
  pub uploaded_at: Option<i64>,
}

pub struct ProducedFile {
  pub filename: String,
  pub absolute_path: String,
}

#[derive(Serialize, Deserialize, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct JobParam {
  pub key: String,
  pub label: String,
  pub kind: JobParamKind,
  pub default: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum JobParamKind {
  Select { options: Vec<String> },
  Integer { min: u32, max: u32 },
  Boolean {},
}

#[async_trait]
pub trait JobEngine: Send + Sync {
  fn params(&self) -> Vec<JobParam>;
  fn validate_params(&self, params_json: &str) -> anyhow::Result<()>;
  async fn shutdown(&self) -> anyhow::Result<()>;
}

#[async_trait]
pub trait IngestionEngine: JobEngine {
  async fn fetch_metadata(&self, from_path: &str) -> anyhow::Result<IngestMetadata>;
  async fn fetch_thumbnail(
    &self,
    from_path: &str,
    destination_directory: &str,
    duration: f64,
  ) -> anyhow::Result<ProducedFile>;
  async fn ingest(&self, from_path: &str, to_path: &str, params_json: &str) -> anyhow::Result<()>;
}

#[async_trait]
pub trait DownloadEngine: JobEngine {
  async fn fetch_metadata(&self, url: &str, params_json: &str) -> anyhow::Result<DownloadMetadata>;
  async fn fetch_thumbnail(
    &self,
    url: &str,
    params_json: &str,
    destination_directory: &str,
  ) -> anyhow::Result<ProducedFile>;
  async fn download_media(
    &self,
    url: &str,
    media_type: &SourceMediaType,
    destination_directory: &str,
    params_json: &str,
    events: JobEventSender,
  ) -> anyhow::Result<ProducedFile>;
}

#[async_trait]
pub trait TranscriptionEngine: JobEngine {
  async fn transcribe(
    &self,
    media_path: &str,
    params_json: &str,
    events: JobEventSender,
  ) -> anyhow::Result<Vec<NewSegment>>;
}

#[async_trait]
pub trait EmbeddingEngine: JobEngine {
  async fn embed_segments(
    &self,
    segments: Vec<String>,
    params_json: &str,
    events: JobEventSender,
  ) -> anyhow::Result<Vec<Vec<f32>>>;
}
