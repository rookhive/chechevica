use std::{future::poll_fn, sync::Arc, task::Poll};

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

pub struct HeavyWorker {
  handlers: Vec<(JobKind, UnboundedReceiver<Wakeup>, Arc<dyn JobExecutor>)>,
  store: Arc<dyn Repository>,
  emitter: Arc<dyn EventEmitter>,
  registry: Arc<dyn CancellationRegistry>,
  job_service: Arc<JobService>,
}

impl HeavyWorker {
  pub fn new(
    handlers: Vec<(JobKind, UnboundedReceiver<Wakeup>, Arc<dyn JobExecutor>)>,
    store: Arc<dyn Repository>,
    emitter: Arc<dyn EventEmitter>,
    registry: Arc<dyn CancellationRegistry>,
    job_service: Arc<JobService>,
  ) -> Self {
    Self {
      handlers,
      store,
      emitter,
      registry,
      job_service,
    }
  }

  pub async fn run(mut self) -> anyhow::Result<()> {
    loop {
      let woken_index = poll_fn(|context| {
        for (index, (_, rx, _)) in self.handlers.iter_mut().enumerate() {
          if let Poll::Ready(Some(_)) = rx.poll_recv(context) {
            return Poll::Ready(Some(index));
          }
        }
        Poll::Pending
      })
      .await;

      let Some(mut current_index) = woken_index else {
        break;
      };

      loop {
        while self.handlers[current_index].1.try_recv().is_ok() {}

        let (job_kind, _, executor) = &self.handlers[current_index];

        loop {
          match super::run_jobs_for_kind(
            &self.store,
            &self.emitter,
            &self.registry,
            &self.job_service,
            *job_kind,
            Arc::clone(executor),
          )
          .await
          {
            Ok(()) => {
              executor.shutdown().await?;
              break;
            }
            Err(_) => sleep(Duration::from_secs(1)).await,
          }
        }

        let mut next_index = None;
        for (index, (_, rx, _)) in self.handlers.iter_mut().enumerate() {
          if index != current_index && rx.try_recv().is_ok() {
            next_index = Some(index);
            break;
          }
        }

        if let Some(index) = next_index {
          current_index = index;
        } else {
          break;
        }
      }
    }

    Ok(())
  }
}
