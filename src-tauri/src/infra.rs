pub mod commands;
pub mod embeddings {
  #[cfg(feature = "cpu")]
  pub mod fastembed_service;
  #[cfg(feature = "cuda")]
  pub mod mistralrs_service;
  pub mod normalize;
}
pub mod engines {
  pub mod download_engine;
  pub mod embedding_engine;
  pub mod ingestion_engine;
  pub mod transcription_engine;
}
pub mod events {
  pub mod app_event_emitter;
}
pub mod filesystem {
  pub mod app_filesystem;
}
pub mod repository {
  pub mod sqlite_repository;
  mod structs;
}
pub mod sidecars {
  pub mod clients {
    pub mod faster_whisper_sidecar_client;
    pub mod ffmpeg_sidecar_client;
    pub mod ffprobe_sidecar_client;
    pub mod qdrant_sidecar_client;
    pub mod ytdlp_sidecar_client;
  }
  pub mod sidecar_runtime;
  pub mod structs;
}
pub mod vectors {
  pub mod qdrant_store;
}
pub mod search {
  pub mod tantivy_service;
}
