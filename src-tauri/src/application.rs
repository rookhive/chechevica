pub mod dto {
  pub mod mapper;
  pub mod structs;
}
pub mod interfaces {
  pub mod embeddings;
  pub mod events;
  pub mod filesystem;
  pub mod jobs;
  pub mod repository;
  pub mod search;
  pub mod vectors;
}
pub mod jobs {
  mod executors;
  pub mod job;
  pub mod runtime;
  pub mod service;
  mod workers;
}
