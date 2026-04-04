pub mod download;
pub mod embed;
pub mod ingest;
pub mod transcribe;

use async_trait::async_trait;

use crate::application::{interfaces::jobs::JobEventSender, jobs::job::Job};
use tokio_util::sync::CancellationToken;

#[async_trait]
pub trait JobExecutor: Send + Sync {
  async fn run(
    &self,
    job: &Job,
    token: CancellationToken,
    events: JobEventSender,
  ) -> anyhow::Result<()>;
  async fn shutdown(&self) -> anyhow::Result<()>;
}
