use derive_more::{Display, FromStr};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::project::ProjectId;

#[derive(Clone, Display, FromStr, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SourceId(Uuid);

impl SourceId {
  pub fn new() -> Self {
    Self(Uuid::now_v7())
  }
}

pub type SourceParams = serde_json::Value;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
  Local,
  Remote,
}

impl SourceKind {
  pub fn as_db_value(&self) -> &'static str {
    match self {
      SourceKind::Local => "local",
      SourceKind::Remote => "remote",
    }
  }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceStatus {
  Processing,
  Succeeded,
  Failed,
  Cancelling,
  Canceled,
}

impl SourceStatus {
  pub fn as_db_value(&self) -> &'static str {
    match self {
      SourceStatus::Processing => "processing",
      SourceStatus::Succeeded => "succeeded",
      SourceStatus::Failed => "failed",
      SourceStatus::Cancelling => "cancelling",
      SourceStatus::Canceled => "canceled",
    }
  }
}

#[derive(Default)]
pub struct SourceUpdate {
  pub title: Option<Option<String>>,
  pub thumbnail: Option<Option<String>>,
  pub media_type: Option<SourceMediaType>,
  pub status: Option<SourceStatus>,
  pub origin_created_at: Option<Option<i64>>,
  pub params_json: Option<SourceParams>,
  pub duration: Option<Option<f64>>,
}

#[derive(Clone, Copy, Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum SourceMediaType {
  Audio,
  Video,
}

impl SourceMediaType {
  pub fn as_db_value(&self) -> &'static str {
    match self {
      SourceMediaType::Audio => "audio",
      SourceMediaType::Video => "video",
    }
  }
}

#[derive(Serialize)]
pub struct Source {
  pub id: SourceId,
  pub project_id: ProjectId,
  pub title: Option<String>,
  pub thumbnail: Option<String>,
  pub media_type: SourceMediaType,
  pub kind: SourceKind,
  pub status: SourceStatus,
  pub origin: String,
  pub origin_created_at: Option<i64>,
  pub params_json: SourceParams,
  pub duration: Option<f64>,
  pub created_at: i64,
  pub updated_at: Option<i64>,
  pub ingest_job_id: Option<i64>,
  pub download_job_id: Option<i64>,
  pub transcribe_job_id: Option<i64>,
  pub embed_job_id: Option<i64>,
}
