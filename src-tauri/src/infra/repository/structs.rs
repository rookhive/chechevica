use anyhow::{Context, Result};
use serde::Serialize;
use serde_json::{Value, from_str, from_value};
use sqlx::FromRow;

use crate::{
  application::{
    interfaces::repository::SearchHit,
    jobs::job::{Job, JobKind, JobStatus},
  },
  entities::{
    artifact::{Artifact, ArtifactId},
    project::{Project, ProjectId, ProjectInfo},
    segment::Segment,
    source::{Source, SourceId},
  },
};

#[derive(FromRow, Serialize)]
pub struct ProjectRow {
  pub id: String,
  pub title: String,
  pub thumbnail: Option<String>,
  pub created_at: i64,
  pub updated_at: Option<i64>,
}

impl TryFrom<ProjectRow> for Project {
  type Error = anyhow::Error;

  fn try_from(row: ProjectRow) -> Result<Self> {
    Ok(Self {
      id: row.id.parse::<ProjectId>()?,
      title: row.title,
      thumbnail: row.thumbnail,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}

#[derive(FromRow, Serialize)]
pub struct ProjectInfoRow {
  pub id: String,
  pub title: String,
  pub thumbnail: Option<String>,
  pub created_at: i64,
  pub updated_at: Option<i64>,
  pub sources_count: i64,
}

impl TryFrom<ProjectInfoRow> for ProjectInfo {
  type Error = anyhow::Error;

  fn try_from(row: ProjectInfoRow) -> Result<Self> {
    Ok(Self {
      project: Project {
        id: row.id.parse::<ProjectId>()?,
        title: row.title,
        thumbnail: row.thumbnail,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      sources_count: row.sources_count as u32,
    })
  }
}

#[derive(FromRow, Serialize)]
pub struct SourceRow {
  pub id: String,
  pub project_id: String,
  pub title: Option<String>,
  pub thumbnail: Option<String>,
  pub media_type: String,
  pub kind: String,
  pub status: String,
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

impl TryFrom<SourceRow> for Source {
  type Error = anyhow::Error;

  fn try_from(r: SourceRow) -> Result<Self> {
    Ok(Self {
      id: r.id.parse::<SourceId>()?,
      project_id: r.project_id.parse::<ProjectId>()?,
      title: r.title,
      thumbnail: r.thumbnail,
      media_type: from_value(Value::String(r.media_type))?,
      kind: from_value(Value::String(r.kind))?,
      status: from_value(Value::String(r.status))?,
      origin: r.origin,
      origin_created_at: r.origin_created_at,
      params_json: from_str(&r.params_json)?,
      duration: r.duration,
      created_at: r.created_at,
      updated_at: r.updated_at,
      ingest_job_id: r.ingest_job_id,
      download_job_id: r.download_job_id,
      transcribe_job_id: r.transcribe_job_id,
      embed_job_id: r.embed_job_id,
    })
  }
}

#[derive(FromRow, Serialize)]
pub struct JobRow {
  pub id: i64,
  pub source_id: String,
  pub kind: String,
  pub status: String,
  pub progress: Option<i64>,
  pub params_json: Option<String>,
  pub error: Option<String>,
  pub created_at: i64,
  pub started_at: Option<i64>,
  pub ready_at: Option<i64>,
  pub finished_at: Option<i64>,
}

impl TryFrom<JobRow> for Job {
  type Error = anyhow::Error;

  fn try_from(r: JobRow) -> Result<Self> {
    let kind = JobKind::try_from(r.kind.as_str()).map_err(anyhow::Error::msg)?;
    let status = JobStatus::try_from(r.status.as_str()).map_err(anyhow::Error::msg)?;
    let progress = u8::try_from(r.progress.unwrap_or(0)).context("Convert job progress to u8")?;

    Job::new(
      r.id,
      r.source_id.parse::<SourceId>()?,
      kind,
      status,
      progress,
      r.params_json.unwrap_or_else(|| "{}".to_string()),
      r.error,
      r.created_at,
      r.started_at,
      r.ready_at,
      r.finished_at,
    )
    .map_err(anyhow::Error::msg)
  }
}

#[derive(FromRow, Serialize)]
pub struct ArtifactRow {
  pub id: String,
  pub project_id: String,
  pub source_id: String,
  pub filename: String,
  pub size: Option<i64>,
}

impl TryFrom<ArtifactRow> for Artifact {
  type Error = anyhow::Error;

  fn try_from(row: ArtifactRow) -> Result<Self> {
    Ok(Self {
      id: row.id.parse::<ArtifactId>()?,
      project_id: row.project_id.parse::<ProjectId>()?,
      source_id: row.source_id.parse::<SourceId>()?,
      filename: row.filename,
      size: row.size.map(|value| value as u64),
    })
  }
}

#[derive(FromRow, Serialize)]
pub struct SegmentRow {
  pub id: i64,
  pub source_id: String,
  pub start: f64,
  pub end: f64,
  pub text: String,
}

impl TryFrom<SegmentRow> for Segment {
  type Error = anyhow::Error;

  fn try_from(row: SegmentRow) -> Result<Self> {
    Ok(Self {
      id: row.id,
      source_id: row.source_id.parse::<SourceId>()?,
      start: row.start,
      end: row.end,
      text: row.text,
    })
  }
}

#[derive(FromRow, Serialize)]
pub struct SearchRow {
  pub project_id: String,
  pub project_title: String,
  pub project_thumbnail: Option<String>,
  pub project_created_at: i64,
  pub project_updated_at: Option<i64>,
  pub source_id: String,
  pub source_project_id: String,
  pub source_title: Option<String>,
  pub source_thumbnail: Option<String>,
  pub source_media_type: String,
  pub source_kind: String,
  pub source_status: String,
  pub source_origin: String,
  pub source_origin_created_at: Option<i64>,
  pub source_params_json: String,
  pub source_duration: Option<f64>,
  pub source_created_at: i64,
  pub source_updated_at: Option<i64>,
  pub source_ingest_job_id: Option<i64>,
  pub source_download_job_id: Option<i64>,
  pub source_transcribe_job_id: Option<i64>,
  pub source_embed_job_id: Option<i64>,
  pub segment_id: i64,
  pub segment_source_id: String,
  pub segment_start: f64,
  pub segment_end: f64,
  pub segment_text: String,
  pub score: f64,
}

impl TryFrom<SearchRow> for SearchHit {
  type Error = anyhow::Error;

  fn try_from(row: SearchRow) -> Result<Self> {
    Ok(Self {
      project: Project {
        id: row.project_id.parse::<ProjectId>()?,
        title: row.project_title,
        thumbnail: row.project_thumbnail,
        created_at: row.project_created_at,
        updated_at: row.project_updated_at,
      },
      source: Source {
        id: row.source_id.parse::<SourceId>()?,
        project_id: row.source_project_id.parse::<ProjectId>()?,
        title: row.source_title,
        thumbnail: row.source_thumbnail,
        media_type: from_value(Value::String(row.source_media_type))?,
        kind: from_value(Value::String(row.source_kind))?,
        status: from_value(Value::String(row.source_status))?,
        origin: row.source_origin,
        origin_created_at: row.source_origin_created_at,
        params_json: from_str(&row.source_params_json)?,
        duration: row.source_duration,
        created_at: row.source_created_at,
        updated_at: row.source_updated_at,
        ingest_job_id: row.source_ingest_job_id,
        download_job_id: row.source_download_job_id,
        transcribe_job_id: row.source_transcribe_job_id,
        embed_job_id: row.source_embed_job_id,
      },
      segment: Segment {
        id: row.segment_id,
        source_id: row.segment_source_id.parse::<SourceId>()?,
        start: row.segment_start,
        end: row.segment_end,
        text: row.segment_text,
      },
      score: row.score as f32,
    })
  }
}
