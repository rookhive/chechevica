use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;

use crate::{
  application::{
    interfaces::{events::EventEmitter, repository::Repository},
    jobs::job::{Job, JobId, JobKind},
  },
  entities::source::SourceId,
};

#[async_trait]
pub trait JobDriver: Send + Sync {
  async fn wake(&self, kind: &JobKind) -> anyhow::Result<()>;
  fn cancel(&self, job_id: &JobId) -> bool;
}

pub enum JobCompletion {
  Succeeded,
  Failed(String),
  Canceled,
}

pub struct JobService {
  store: Arc<dyn Repository>,
  emitter: Arc<dyn EventEmitter>,
  driver: Arc<dyn JobDriver>,
}

impl JobService {
  pub fn new(
    store: Arc<dyn Repository>,
    emitter: Arc<dyn EventEmitter>,
    driver: Arc<dyn JobDriver>,
  ) -> Self {
    Self {
      store,
      emitter,
      driver,
    }
  }

  pub async fn rerun_stale_jobs(&self) -> anyhow::Result<()> {
    let queued_kinds = self.store.recover_stale_jobs().await?;

    for kind in queued_kinds {
      self.driver.wake(&kind).await?;
    }

    Ok(())
  }

  pub async fn enqueue(
    &self,
    kind: &JobKind,
    source_id: &SourceId,
    params_json: &str,
  ) -> anyhow::Result<()> {
    let job = self.store.create_job(source_id, kind, params_json).await?;

    self.emitter.emit_new_job(&job)?;
    self.driver.wake(kind).await?;

    Ok(())
  }

  async fn enqueue_next(&self, job: &Job) -> anyhow::Result<()> {
    let Some(next_kind) = Self::next_job_kind(job.kind) else {
      return Ok(());
    };

    let source = self
      .store
      .fetch_source(&job.source_id)
      .await?
      .context("Source not found")?;

    let params_json = Self::params_json_for_kind(&source.params_json, next_kind)?;

    self
      .enqueue(&next_kind, &job.source_id, &params_json)
      .await?;

    Ok(())
  }

  pub async fn finalize(&self, job: &mut Job, completion: JobCompletion) -> anyhow::Result<()> {
    let should_enqueue_next =
      matches!(completion, JobCompletion::Succeeded) && Self::next_job_kind(job.kind).is_some();
    let finished_at = chrono::Utc::now().timestamp_millis();

    match completion {
      JobCompletion::Succeeded => job.succeed(finished_at),
      JobCompletion::Failed(error) => job.fail(error, finished_at),
      JobCompletion::Canceled => job.cancel(finished_at),
    }
    .map_err(anyhow::Error::msg)?;

    self.store.update_job(job).await?;

    if should_enqueue_next {
      self.enqueue_next(job).await?;
    }

    self.emitter.emit_job_update(job)?;

    if let Some(source) = self.store.fetch_source(&job.source_id).await? {
      self.emitter.emit_source_update(&source)?;
    }

    Ok(())
  }

  pub async fn cancel(&self, job_id: &JobId) -> anyhow::Result<()> {
    self.store.mark_job_cancelling(job_id).await?;
    let was_running = self.driver.cancel(job_id);
    if !was_running {
      self.store.mark_job_canceled(job_id).await?;
    }

    Ok(())
  }

  fn next_job_kind(kind: JobKind) -> Option<JobKind> {
    match kind {
      JobKind::Ingest | JobKind::Download => Some(JobKind::Transcribe),
      JobKind::Transcribe => Some(JobKind::Embed),
      JobKind::Embed => None,
    }
  }

  fn params_json_for_kind(params: &serde_json::Value, kind: JobKind) -> anyhow::Result<String> {
    let kind: &str = kind.into();
    let params = params
      .get(kind)
      .with_context(|| format!("Missing params for {kind} job"))?;

    serde_json::to_string(params).context("Serialize job params")
  }
}
