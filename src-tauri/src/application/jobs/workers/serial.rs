use std::sync::Arc;

use tokio::{
  sync::mpsc::UnboundedReceiver,
  time::{Duration, sleep},
};

use crate::application::{
  interfaces::{events::EventEmitter, repository::Repository},
  jobs::{
    executors::JobExecutor,
    job::JobKind,
    runtime::{CancellationRegistry, Wakeup},
    service::JobService,
  },
};

pub struct SerialWorker {
  job_kind: JobKind,
  receiver: UnboundedReceiver<Wakeup>,
  executor: Arc<dyn JobExecutor>,
  store: Arc<dyn Repository>,
  emitter: Arc<dyn EventEmitter>,
  registry: Arc<dyn CancellationRegistry>,
  job_service: Arc<JobService>,
}

impl SerialWorker {
  pub fn new(
    handler: (JobKind, UnboundedReceiver<Wakeup>, Arc<dyn JobExecutor>),
    store: Arc<dyn Repository>,
    emitter: Arc<dyn EventEmitter>,
    registry: Arc<dyn CancellationRegistry>,
    job_service: Arc<JobService>,
  ) -> Self {
    let (job_kind, receiver, executor) = handler;
    Self {
      job_kind,
      receiver,
      executor,
      store,
      emitter,
      registry,
      job_service,
    }
  }

  pub async fn run(mut self) -> anyhow::Result<()> {
    while self.receiver.recv().await.is_some() {
      loop {
        match super::run_jobs_for_kind(
          &self.store,
          &self.emitter,
          &self.registry,
          &self.job_service,
          self.job_kind,
          Arc::clone(&self.executor),
        )
        .await
        {
          Ok(()) => {
            self.executor.shutdown().await?;
            break;
          }
          Err(_) => sleep(Duration::from_secs(1)).await,
        }
      }
    }

    Ok(())
  }
}
