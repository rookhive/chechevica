mod application;
mod entities;
mod infra;

use std::sync::Arc;

use anyhow::Context;
use tauri::{Manager, RunEvent, async_runtime::block_on};
use tauri_plugin_prevent_default::{Flags, PlatformOptions};
use tokio::sync::Mutex;

#[cfg(feature = "cpu")]
use crate::infra::embeddings::fastembed_service::FastembedService;

#[cfg(feature = "cuda")]
use crate::infra::embeddings::mistralrs_service::MistralrsService;

use crate::{
  application::{
    dto::mapper::DtoMapper,
    interfaces::{
      embeddings::EmbeddingService, events::EventEmitter, filesystem::Filesystem,
      repository::Repository, search::SearchService, vectors::VectorStore,
    },
    jobs::{
      runtime::JobRuntime,
      service::{JobDriver, JobService},
    },
  },
  infra::{
    commands,
    engines::{
      download_engine::DownloadEngine, embedding_engine::EmbeddingEngine,
      ingestion_engine::IngestionEngine, transcription_engine::TranscriptionEngine,
    },
    events::app_event_emitter::AppEventEmitter,
    filesystem::app_filesystem::AppFilesystem,
    repository::sqlite_repository::SqliteRepository,
    search::tantivy_service::TantivyService,
    sidecars::sidecar_runtime::SidecarRuntime,
    vectors::qdrant_store::QdrantStore,
  },
};

pub fn run() -> anyhow::Result<()> {
  let updater_plugin = tauri_plugin_updater::Builder::new().build();
  let shell_plugin = tauri_plugin_shell::init();
  let dialog_plugin = tauri_plugin_dialog::init();
  let opener_plugin = tauri_plugin_opener::init();
  let window_state_plugin = tauri_plugin_window_state::Builder::new().build();
  let single_instance_plugin = tauri_plugin_single_instance::init(|_, _, _| {});
  let clipboard_manager_plugin = tauri_plugin_clipboard_manager::init();
  let prevent_default_plugin = tauri_plugin_prevent_default::Builder::new()
    .with_flags(Flags::all().difference(Flags::RELOAD))
    .platform(PlatformOptions::new())
    .build();

  let app = tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(updater_plugin)
    .plugin(shell_plugin)
    .plugin(dialog_plugin)
    .plugin(opener_plugin)
    .plugin(window_state_plugin)
    .plugin(single_instance_plugin)
    .plugin(clipboard_manager_plugin)
    .plugin(prevent_default_plugin)
    .invoke_handler(tauri::generate_handler![
      commands::projects::get_project,
      commands::projects::get_projects,
      commands::projects::create_project,
      commands::projects::update_project,
      commands::projects::delete_project,
      commands::sources::get_source,
      commands::sources::get_sources,
      commands::sources::get_processing_sources,
      commands::sources::get_remote_source_metadata,
      commands::sources::import_sources,
      commands::sources::reprocess_source,
      commands::sources::delete_source,
      commands::sources::cancel_processing,
      commands::segments::get_source_segments,
      commands::segments::export_selected_segments,
      commands::artifacts::get_source_artifact,
      commands::jobs::get_step_parameters,
      commands::jobs::get_active_jobs,
      commands::search::semantic_search,
      commands::search::keyword_search,
    ])
    .build(tauri::generate_context!())
    .context("Error while building Tauri application")?;

  let handle = app.handle();
  let sidecar_runtime = Arc::new(SidecarRuntime::new(handle.clone()));
  let app_local_data_dir = handle.path().app_local_data_dir()?;
  let app_filesystem = AppFilesystem::new(&app_local_data_dir);
  let repository_directory = app_filesystem
    .ensure_repository_directory()
    .context("Ensure store directory")?;
  let vectors_directory = app_filesystem
    .ensure_vectors_directory()
    .context("Ensure vectors directory")?;
  let sqlite_repository = block_on(async {
    SqliteRepository::try_new(repository_directory.clone())
      .await
      .context("Create SqliteRepository")
  })?;
  let qdrant_store = block_on(async {
    QdrantStore::try_new(sidecar_runtime.clone(), vectors_directory)
      .await
      .context("Create QdrantStore")
  })?;
  let tantivy_service = block_on(async {
    TantivyService::try_new(repository_directory)
      .await
      .context("Create TantivyService")
  })?;

  let sqlite_repository: Arc<dyn Repository> = Arc::new(sqlite_repository);
  let qdrant_store: Arc<dyn VectorStore> = Arc::new(qdrant_store);
  let tantivy_service: Arc<dyn SearchService> = Arc::new(tantivy_service);
  let app_filesystem: Arc<dyn Filesystem> = Arc::new(app_filesystem);
  let dto_mapper = DtoMapper::new(app_filesystem.clone());
  let app_event_emitter: Arc<dyn EventEmitter> =
    Arc::new(AppEventEmitter::new(handle.clone(), dto_mapper.clone()));
  let gpu_lock = Arc::new(Mutex::new(()));

  #[cfg(feature = "cuda")]
  let embedding_service: Arc<dyn EmbeddingService> =
    Arc::new(MistralrsService::new(gpu_lock.clone()));

  #[cfg(feature = "cpu")]
  let embedding_service: Arc<dyn EmbeddingService> = Arc::new(FastembedService::new());

  let embedding_engine = Arc::new(EmbeddingEngine::new(embedding_service.clone()));
  let ingestion_engine = Arc::new(IngestionEngine::new(sidecar_runtime.clone()));
  let download_engine = Arc::new(DownloadEngine::new(sidecar_runtime.clone()));
  let transcription_engine = Arc::new(TranscriptionEngine::new(sidecar_runtime.clone()));

  let job_runtime = Arc::new(JobRuntime::new(
    ingestion_engine.clone(),
    download_engine.clone(),
    transcription_engine.clone(),
    embedding_engine.clone(),
  ));
  let job_driver: Arc<dyn JobDriver> = job_runtime.clone();
  let job_service = Arc::new(JobService::new(
    sqlite_repository.clone(),
    app_event_emitter.clone(),
    job_driver,
  ));

  job_runtime.start(
    sqlite_repository.clone(),
    app_event_emitter.clone(),
    app_filesystem.clone(),
    qdrant_store.clone(),
    embedding_service.clone(),
    tantivy_service.clone(),
    job_service.clone(),
    gpu_lock,
  )?;

  block_on(job_service.rerun_stale_jobs()).context("Rerun stale jobs")?;

  let sidecar_runtime_on_exit = sidecar_runtime.clone();

  app.manage(sidecar_runtime);
  app.manage(app_filesystem);
  app.manage(app_event_emitter);
  app.manage(sqlite_repository);
  app.manage(qdrant_store);
  app.manage(tantivy_service);
  app.manage(embedding_service);
  app.manage(dto_mapper);
  app.manage(job_runtime);
  app.manage(job_service);

  app.run(move |_, event| {
    if let RunEvent::Exit = event
      && let Err(error) = sidecar_runtime_on_exit.shutdown_all()
    {
      eprintln!("Failed to shutdown sidecars on app exit: {error}");
    }
  });

  Ok(())
}
