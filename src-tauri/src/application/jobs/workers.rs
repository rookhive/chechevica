pub mod heavy;
pub mod serial;

use std::sync::Arc;

use anyhow::Context;

use crate::application::{
  interfaces::{events::EventEmitter, jobs::JobEvent, repository::Repository},
  jobs::{
    executors::JobExecutor,
    job::{Job, JobKind},
    runtime::CancellationRegistry,
    service::{JobCompletion, JobService},
  },
};
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio_util::sync::CancellationToken;

pub async fn handle_job_event(
  store: &Arc<dyn Repository>,
  emitter: &Arc<dyn EventEmitter>,
  job: &mut Job,
  event: JobEvent,
) -> anyhow::Result<()> {
  match event {
    JobEvent::Progress { percent } => {
      let updated = job
        .set_progress(percent)
        .map_err(|error| anyhow::anyhow!(error))?;
      if !updated {
        return Ok(());
      }

      store.update_job(job).await?;
      emitter.emit_job_update(job)?;
    }
    JobEvent::ModelReady => {
      let now = chrono::Utc::now().timestamp_millis();
      let updated = job
        .mark_ready(now)
        .map_err(|error| anyhow::anyhow!(error))?;
      if !updated {
        return Ok(());
      }

      store.update_job(job).await?;
      emitter.emit_job_update(job)?;
    }
  }

  Ok(())
}

pub async fn drain_job_events(
  store: &Arc<dyn Repository>,
  emitter: &Arc<dyn EventEmitter>,
  job: &mut Job,
  event_rx: &mut UnboundedReceiver<JobEvent>,
) -> anyhow::Result<()> {
  event_rx.close();

  while let Ok(event) = event_rx.try_recv() {
    handle_job_event(store, emitter, job, event).await?;
  }

  Ok(())
}

pub async fn run_jobs_for_kind(
  store: &Arc<dyn Repository>,
  emitter: &Arc<dyn EventEmitter>,
  registry: &Arc<dyn CancellationRegistry>,
  job_service: &Arc<JobService>,
  job_kind: JobKind,
  executor: Arc<dyn JobExecutor>,
) -> anyhow::Result<()> {
  loop {
    let job = store.claim_next_job(&job_kind).await?;

    let Some(job) = job else {
      break;
    };

    emitter.emit_job_update(&job)?;

    run_job(
      store,
      emitter,
      registry,
      job_service,
      executor.as_ref(),
      job,
    )
    .await;
  }

  Ok(())
}

pub async fn run_job(
  store: &Arc<dyn Repository>,
  emitter: &Arc<dyn EventEmitter>,
  registry: &Arc<dyn CancellationRegistry>,
  job_service: &Arc<JobService>,
  executor: &dyn JobExecutor,
  mut job: Job,
) {
  let token = CancellationToken::new();
  let job_id = job.id;
  let job_kind = job.kind;

  registry.register(job_id, token.clone());

  let result = run_job_inner(store, emitter, job_service, executor, &token, &mut job).await;

  registry.unregister(job_id);

  if let Err(error) = result {
    let job_kind_label: &str = job_kind.into();
    eprintln!(
      "Job {job_id} ({}) aborted before completion handling: {error:#}",
      job_kind_label,
    );

    if let Err(finalize_error) =
      finalize_job_after_error(job_service, &token, &mut job, &error).await
    {
      eprintln!(
        "Job {job_id} ({}) finalize-after-error failed: {finalize_error:#}",
        job_kind_label,
      );
    }
  }
}

async fn finalize_job_after_error(
  job_service: &Arc<JobService>,
  token: &CancellationToken,
  job: &mut Job,
  error: &anyhow::Error,
) -> anyhow::Result<()> {
  if token.is_cancelled() {
    job_service.finalize(job, JobCompletion::Canceled).await
  } else {
    job_service
      .finalize(job, JobCompletion::Failed(error.to_string()))
      .await
  }
}

async fn run_job_inner(
  store: &Arc<dyn Repository>,
  emitter: &Arc<dyn EventEmitter>,
  job_service: &Arc<JobService>,
  executor: &dyn JobExecutor,
  token: &CancellationToken,
  job: &mut Job,
) -> anyhow::Result<()> {
  emitter.emit_job_update(job)?;

  let (event_tx, mut event_rx) = mpsc::unbounded_channel();
  let job_for_executor = job.clone();
  let outcome = {
    let run = executor.run(&job_for_executor, token.clone(), event_tx);
    tokio::pin!(run);

    loop {
      tokio::select! {
        result = &mut run => {
          break result.context("Run job executor");
        }
        maybe_event = event_rx.recv(), if !event_rx.is_closed() => {
          if let Some(event) = maybe_event {
            handle_job_event(store, emitter, job, event).await?;
          }
        }
      }
    }
  };

  drain_job_events(store, emitter, job, &mut event_rx).await?;

  match outcome {
    Ok(_) => {
      if token.is_cancelled() {
        job_service.finalize(job, JobCompletion::Canceled).await?;
      } else {
        job_service.finalize(job, JobCompletion::Succeeded).await?;
      }
    }
    Err(error) => {
      if token.is_cancelled() {
        job_service.finalize(job, JobCompletion::Canceled).await?;
      } else {
        job_service
          .finalize(job, JobCompletion::Failed(error.to_string()))
          .await?;
      }
    }
  }

  Ok(())
}
