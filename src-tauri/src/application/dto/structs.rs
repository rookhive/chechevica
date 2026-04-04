use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::entities::source::{SourceKind, SourceMediaType, SourceStatus};

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum SourceKindDto {
  Local,
  Remote,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum SourceStatusDto {
  Processing,
  Succeeded,
  Failed,
  Cancelling,
  Canceled,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum SourceMediaTypeDto {
  Audio,
  Video,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProjectDto {
  pub id: String,
  pub title: String,
  pub thumbnail: Option<String>,
  pub created_at: i64,
  pub updated_at: Option<i64>,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProjectInfoDto {
  pub project: ProjectDto,
  pub sources_count: u32,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SourceDto {
  pub id: String,
  pub project_id: String,
  pub title: Option<String>,
  pub thumbnail: Option<String>,
  pub media_type: SourceMediaTypeDto,
  pub kind: SourceKindDto,
  pub status: SourceStatusDto,
  pub origin: String,
  pub origin_created_at: Option<i64>,
  pub params_json: String,
  pub duration: Option<f64>,
  pub created_at: i64,
  pub updated_at: Option<i64>,
  pub ingest_job_id: Option<i64>,
  pub download_job_id: Option<i64>,
  pub transcribe_job_id: Option<i64>,
  pub embed_job_id: Option<i64>,
}

impl From<&SourceKind> for SourceKindDto {
  fn from(kind: &SourceKind) -> Self {
    match kind {
      SourceKind::Local => SourceKindDto::Local,
      SourceKind::Remote => SourceKindDto::Remote,
    }
  }
}

impl From<&SourceStatus> for SourceStatusDto {
  fn from(status: &SourceStatus) -> Self {
    match status {
      SourceStatus::Processing => SourceStatusDto::Processing,
      SourceStatus::Succeeded => SourceStatusDto::Succeeded,
      SourceStatus::Failed => SourceStatusDto::Failed,
      SourceStatus::Cancelling => SourceStatusDto::Cancelling,
      SourceStatus::Canceled => SourceStatusDto::Canceled,
    }
  }
}

impl From<&SourceMediaType> for SourceMediaTypeDto {
  fn from(media_type: &SourceMediaType) -> Self {
    match media_type {
      SourceMediaType::Audio => SourceMediaTypeDto::Audio,
      SourceMediaType::Video => SourceMediaTypeDto::Video,
    }
  }
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SourceWithJobsDto {
  pub source: SourceDto,
  pub jobs: Vec<JobDto>,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct JobDto {
  pub id: i64,
  pub source_id: String,
  pub kind: String,
  pub status: String,
  pub progress: u8,
  pub error: Option<String>,
  pub params_json: Option<String>,
  pub created_at: i64,
  pub started_at: Option<i64>,
  pub ready_at: Option<i64>,
  pub finished_at: Option<i64>,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SegmentDto {
  pub id: i64,
  pub source_id: String,
  pub start: f64,
  pub end: f64,
  pub text: String,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SearchResultDto {
  pub project: ProjectDto,
  pub source: SourceDto,
  pub segment: SegmentDto,
  pub score: f32,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ArtifactDto {
  pub id: String,
  pub source_id: String,
  pub path: String,
  pub size: Option<u64>,
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RemoteSourceMetadata {
  pub title: String,
  pub url: String,
}
