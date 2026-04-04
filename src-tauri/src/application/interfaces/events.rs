use crate::{application::jobs::job::Job, entities::source::Source};

pub trait EventEmitter: Send + Sync {
  fn emit_new_job(&self, job: &Job) -> anyhow::Result<()>;
  fn emit_job_update(&self, job: &Job) -> anyhow::Result<()>;
  fn emit_source_update(&self, source: &Source) -> anyhow::Result<()>;
}
