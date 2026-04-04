use core::convert::TryFrom;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::entities::source::SourceId;

pub type JobId = i64;

#[derive(Copy, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum JobKind {
  Ingest,
  Download,
  Transcribe,
  Embed,
}

impl From<JobKind> for &'static str {
  fn from(kind: JobKind) -> Self {
    match kind {
      JobKind::Ingest => "ingest",
      JobKind::Download => "download",
      JobKind::Transcribe => "transcribe",
      JobKind::Embed => "embed",
    }
  }
}

impl TryFrom<&str> for JobKind {
  type Error = String;

  fn try_from(value: &str) -> Result<Self, Self::Error> {
    match value {
      "ingest" => Ok(JobKind::Ingest),
      "download" => Ok(JobKind::Download),
      "transcribe" => Ok(JobKind::Transcribe),
      "embed" => Ok(JobKind::Embed),
      _ => Err(format!("Unknown job kind: {value}")),
    }
  }
}

#[derive(Copy, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum JobStatus {
  Queued,
  Processing,
  Succeeded,
  Failed,
  Cancelling,
  Canceled,
}

impl From<JobStatus> for &'static str {
  fn from(status: JobStatus) -> Self {
    match status {
      JobStatus::Queued => "queued",
      JobStatus::Processing => "running",
      JobStatus::Succeeded => "succeeded",
      JobStatus::Failed => "failed",
      JobStatus::Cancelling => "cancelling",
      JobStatus::Canceled => "canceled",
    }
  }
}

impl TryFrom<&str> for JobStatus {
  type Error = String;

  fn try_from(value: &str) -> Result<Self, Self::Error> {
    match value {
      "queued" => Ok(JobStatus::Queued),
      "running" => Ok(JobStatus::Processing),
      "succeeded" => Ok(JobStatus::Succeeded),
      "failed" => Ok(JobStatus::Failed),
      "cancelling" => Ok(JobStatus::Cancelling),
      "canceled" => Ok(JobStatus::Canceled),
      _ => Err(format!("Unknown job status: {value}")),
    }
  }
}

#[derive(Clone)]
pub struct Job {
  pub id: JobId,
  pub source_id: SourceId,
  pub kind: JobKind,
  pub status: JobStatus,
  pub progress: u8,
  pub error: Option<String>,
  pub params_json: String,
  pub created_at: i64,
  pub started_at: Option<i64>,
  pub ready_at: Option<i64>,
  pub finished_at: Option<i64>,
}

impl Job {
  #[allow(clippy::too_many_arguments)]
  pub fn new(
    id: JobId,
    source_id: SourceId,
    kind: JobKind,
    status: JobStatus,
    progress: u8,
    params_json: String,
    error: Option<String>,
    created_at: i64,
    started_at: Option<i64>,
    ready_at: Option<i64>,
    finished_at: Option<i64>,
  ) -> Result<Self, String> {
    if progress > 100 {
      return Err("Job progress must be between 0 and 100".into());
    }

    let mut job = Self {
      id,
      source_id,
      kind,
      status: JobStatus::Queued,
      progress,
      error,
      params_json,
      created_at,
      started_at: None,
      ready_at: None,
      finished_at: None,
    };

    match status {
      JobStatus::Queued => {
        if started_at.is_some() || ready_at.is_some() || finished_at.is_some() {
          return Err("Queued job can't have started_at, ready_at or finished_at".into());
        }
      }
      JobStatus::Processing => {
        let started_at = started_at
          .ok_or_else(|| "Processing or cancelling job must have started_at".to_string())?;
        job.start(started_at)?;
        job.ready_at = ready_at;
      }
      JobStatus::Cancelling => {
        if started_at.is_none() {
          return Err("Processing or cancelling job must have started_at".into());
        }

        job.status = status;
        job.started_at = started_at;
        job.ready_at = ready_at;
        job.finished_at = finished_at;
      }
      JobStatus::Succeeded | JobStatus::Failed | JobStatus::Canceled => {
        if finished_at.is_none() {
          return Err("Finished job must have finished_at".into());
        }

        job.status = status;
        job.started_at = started_at;
        job.ready_at = ready_at;
        job.finished_at = finished_at;
      }
    }

    Ok(job)
  }

  pub fn set_progress(&mut self, percent: u8) -> Result<bool, String> {
    if self.status != JobStatus::Processing && self.status != JobStatus::Cancelling {
      return Err("Can't set progress for a job that is not processing or cancelling".into());
    }

    let percent = percent.min(100);
    if percent <= self.progress {
      return Ok(false);
    }

    self.progress = percent;
    Ok(true)
  }

  #[allow(unused)]
  pub fn start(&mut self, now: i64) -> Result<(), String> {
    if self.status != JobStatus::Queued {
      return Err("Can't start a job that is not queued".into());
    }
    self.status = JobStatus::Processing;
    self.started_at = Some(now);
    Ok(())
  }

  pub fn mark_ready(&mut self, now: i64) -> Result<bool, String> {
    if self.status != JobStatus::Processing && self.status != JobStatus::Cancelling {
      return Err("Can't mark ready for a job that is not processing or cancelling".into());
    }

    if self.ready_at.is_some() {
      return Ok(false);
    }

    self.ready_at = Some(now);
    Ok(true)
  }

  pub fn succeed(&mut self, now: i64) -> Result<(), String> {
    if self.status != JobStatus::Processing {
      return Err("Can't succeed a job that is not processing".into());
    }
    self.status = JobStatus::Succeeded;
    self.progress = 100;
    self.finished_at = Some(now);
    Ok(())
  }

  pub fn cancel(&mut self, now: i64) -> Result<(), String> {
    if self.status != JobStatus::Processing
      && self.status != JobStatus::Cancelling
      && self.status != JobStatus::Queued
    {
      return Err("Can't cancel a job that is not queued, processing or cancelling".into());
    }
    self.status = JobStatus::Canceled;
    self.finished_at = Some(now);
    Ok(())
  }

  pub fn fail(&mut self, error: String, now: i64) -> Result<(), String> {
    if self.status != JobStatus::Processing {
      return Err("Can't fail a job that is not processing".into());
    }
    self.status = JobStatus::Failed;
    self.error = Some(error);
    self.finished_at = Some(now);
    Ok(())
  }
}
