pub mod artifacts;
pub mod jobs;
pub mod projects;
pub mod search;
pub mod segments;
pub mod sources;

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::application::{
  dto::mapper,
  interfaces::{self, embeddings, events, filesystem, repository, vectors},
  jobs::{runtime, service},
};
use crate::infra::sidecars::sidecar_runtime;

// Type aliases for state management in Tauri commands. Just for simplicity and readability
type DtoMapper<'a> = State<'a, mapper::DtoMapper>;
type Repository<'a> = State<'a, Arc<dyn repository::Repository>>;
type VectorStore<'a> = State<'a, Arc<dyn vectors::VectorStore>>;
type SearchService<'a> = State<'a, Arc<dyn interfaces::search::SearchService>>;
type Filesystem<'a> = State<'a, Arc<dyn filesystem::Filesystem>>;
type EmbeddingService<'a> = State<'a, Arc<dyn embeddings::EmbeddingService>>;
type EventEmitter<'a> = State<'a, Arc<dyn events::EventEmitter>>;
type JobRuntime<'a> = State<'a, Arc<runtime::JobRuntime>>;
type JobService<'a> = State<'a, Arc<service::JobService>>;
type SidecarRuntime<'a> = State<'a, Arc<sidecar_runtime::SidecarRuntime>>;

pub type CommandResult<T> = anyhow::Result<T, CommandError>;

#[derive(Serialize)]
pub struct CommandError {
  pub status: &'static str,
  pub message: String,
}

impl From<anyhow::Error> for CommandError {
  fn from(error: anyhow::Error) -> Self {
    Self {
      status: "error",
      message: error.to_string(),
    }
  }
}

#[derive(Deserialize, Serialize, TS)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
#[ts(export)]
pub enum Patch<T> {
  Set(T),
  Remove,
  Unchanged,
}
