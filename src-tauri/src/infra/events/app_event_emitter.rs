use anyhow::Context;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::{
  application::{dto::mapper::DtoMapper, interfaces::events::EventEmitter, jobs::job::Job},
  entities::source::Source,
};

pub struct AppEventEmitter {
  handle: AppHandle,
  mapper: DtoMapper,
}

impl AppEventEmitter {
  pub fn new(handle: AppHandle, mapper: DtoMapper) -> Self {
    Self { handle, mapper }
  }

  fn emit<T: Serialize>(&self, event: &str, payload: &T) -> anyhow::Result<()> {
    self
      .handle
      .emit(event, payload)
      .with_context(|| format!("Emit '{event}' event"))?;

    Ok(())
  }
}

impl EventEmitter for AppEventEmitter {
  fn emit_source_update(&self, source: &Source) -> anyhow::Result<()> {
    let dto = self.mapper.source_to_dto(source)?;
    self.emit("source:update", &dto)
  }

  fn emit_new_job(&self, job: &Job) -> anyhow::Result<()> {
    let dto = self.mapper.job_to_dto(job)?;
    self.emit("job:new", &dto)
  }

  fn emit_job_update(&self, job: &Job) -> anyhow::Result<()> {
    let dto = self.mapper.job_to_dto(job)?;
    self.emit("job:update", &dto)
  }
}
