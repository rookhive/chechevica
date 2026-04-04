use anyhow::Context;
use serde::Deserialize;
use serde_json::Value;

use crate::{
  application::{
    dto::structs::{RemoteSourceMetadata, SourceDto, SourceWithJobsDto},
    jobs::job::{Job, JobKind, JobStatus},
  },
  entities::{
    project::ProjectId,
    source::{
      Source, SourceId, SourceKind as EntitySourceKind, SourceMediaType, SourceStatus, SourceUpdate,
    },
  },
  infra::{
    commands::{
      CommandResult, DtoMapper, EventEmitter, Filesystem, JobRuntime, JobService, Repository,
      SearchService, SidecarRuntime, VectorStore,
    },
    sidecars::clients::ytdlp_sidecar_client::YtdlpSidecarClient,
  },
};

#[tauri::command]
pub async fn get_sources(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  project_id: ProjectId,
) -> CommandResult<Vec<SourceDto>> {
  Ok(
    db.fetch_sources(&project_id)
      .await?
      .iter()
      .map(|source| mapper.source_to_dto(source))
      .collect::<anyhow::Result<Vec<SourceDto>>>()?,
  )
}

#[tauri::command]
pub async fn get_source(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  source_id: SourceId,
) -> CommandResult<SourceWithJobsDto> {
  let source = db
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;
  let jobs = db.fetch_source_jobs(&source_id).await?;

  map_source_with_jobs(&mapper, &source, &jobs)
}

#[tauri::command]
pub async fn get_processing_sources(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
) -> CommandResult<Vec<SourceWithJobsDto>> {
  let sources = db.fetch_processing_sources().await?;
  let mut sources_with_jobs = Vec::with_capacity(sources.len());

  for source in &sources {
    let jobs = db.fetch_source_jobs(&source.id).await?;
    sources_with_jobs.push(map_source_with_jobs(&mapper, source, &jobs)?);
  }

  Ok(sources_with_jobs)
}

#[tauri::command]
pub async fn delete_source(
  store: Repository<'_>,
  fs: Filesystem<'_>,
  vector_store: VectorStore<'_>,
  search_service: SearchService<'_>,
  source_id: SourceId,
) -> CommandResult<()> {
  let source = store
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;

  vector_store
    .delete_segments(&source.project_id, &source_id)
    .await?;
  search_service
    .delete_source_index(&source.project_id, &source_id)
    .await?;
  store.delete_source(&source_id).await?;
  fs.delete_source_files(&source.project_id, &source_id)?;

  Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn reprocess_source(
  store: Repository<'_>,
  fs: Filesystem<'_>,
  search_service: SearchService<'_>,
  emitter: EventEmitter<'_>,
  job_runtime: JobRuntime<'_>,
  job_service: JobService<'_>,
  vector_store: VectorStore<'_>,
  source_id: SourceId,
  start_step: JobKind,
  media_type: SourceMediaType,
  params: Value,
) -> CommandResult<()> {
  let source = store
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;

  if matches!(source.status.as_db_value(), "processing" | "cancelling") {
    return Err(anyhow::anyhow!("Source is already processing").into());
  }

  ensure_reprocess_step_supported(&source, start_step)?;

  let initial_job_kind = match &source.kind {
    EntitySourceKind::Local => JobKind::Ingest,
    EntitySourceKind::Remote => JobKind::Download,
  };

  validate_source_job_params(&job_runtime, initial_job_kind, &params)
    .context("Validate reprocess job params")?;

  reset_reprocess_outputs(
    &store,
    &fs,
    &vector_store,
    &search_service,
    &source,
    start_step,
  )
  .await?;

  let next_media_type = match &source.kind {
    EntitySourceKind::Local => source.media_type,
    EntitySourceKind::Remote => media_type,
  };

  store.clear_source_jobs(&source_id, &start_step).await?;

  // TODO: implement something like (but simpler)
  // if (start_step == JobKind::Transcribe || start_step == JobKind::Ingest || start_step == JobKind::Download) {
  //   self.search_service.delete_source_index(&source.project_id, &source_id).await?;
  // }

  store
    .update_source(
      &source_id,
      &SourceUpdate {
        media_type: Some(next_media_type),
        params_json: Some(params.clone()),
        ..Default::default()
      },
    )
    .await?;

  let updated_source = store
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;

  emitter.emit_source_update(&updated_source)?;

  job_service
    .enqueue(
      &start_step,
      &source_id,
      &job_params_json(&params, start_step)?,
    )
    .await?;

  let updated_source = store
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;

  emitter.emit_source_update(&updated_source)?;

  Ok(())
}

#[tauri::command]
pub async fn cancel_processing(
  store: Repository<'_>,
  emitter: EventEmitter<'_>,
  job_service: JobService<'_>,
  source_id: SourceId,
) -> CommandResult<()> {
  let source = store
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;

  if matches!(
    source.status,
    SourceStatus::Cancelling | SourceStatus::Canceled
  ) {
    return Ok(());
  }

  let jobs = store
    .fetch_source_jobs(&source_id)
    .await
    .context("Fetch source jobs for cancellation")?;

  let cancelable_job_ids = jobs
    .iter()
    .filter(|job| matches!(&job.status, JobStatus::Queued | JobStatus::Processing))
    .map(|job| job.id)
    .collect::<Vec<_>>();

  if cancelable_job_ids.is_empty() {
    return Ok(());
  }

  store
    .update_source(
      &source_id,
      &SourceUpdate {
        status: Some(SourceStatus::Cancelling),
        ..Default::default()
      },
    )
    .await
    .context("Set source status to cancelling")?;

  let updated_source = store
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;

  emitter.emit_source_update(&updated_source)?;

  for job_id in cancelable_job_ids {
    job_service
      .cancel(&job_id)
      .await
      .with_context(|| format!("Cancel job {job_id}"))?;
  }

  let refreshed_jobs = store
    .fetch_source_jobs(&source_id)
    .await
    .context("Fetch source jobs after cancellation")?;

  for job in refreshed_jobs.iter().filter(|job| {
    matches!(
      &job.status,
      JobStatus::Queued | JobStatus::Processing | JobStatus::Cancelling | JobStatus::Canceled
    )
  }) {
    emitter.emit_job_update(job)?;
  }

  if let Some(source) = store.fetch_source(&source_id).await? {
    emitter.emit_source_update(&source)?;
  }

  Ok(())
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
  Local,
  Remote,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SourceImport {
  pub kind: SourceKind,
  pub media_type: Option<SourceMediaType>,
  pub origin: String,
  pub params: Value,
}

#[tauri::command]
pub async fn import_sources(
  store: Repository<'_>,
  job_runtime: JobRuntime<'_>,
  job_service: JobService<'_>,
  project_id: ProjectId,
  sources: Vec<SourceImport>,
) -> CommandResult<()> {
  let total = sources.len();
  let mut imported = 0usize;
  let mut errors: Vec<String> = Vec::new();

  for source in sources {
    let result: anyhow::Result<()> = async {
      let source_id = SourceId::new();

      let (kind, initial_job_kind, media_type, initial_job_params) = match &source.kind {
        SourceKind::Local => (
          EntitySourceKind::Local,
          JobKind::Ingest,
          &detect_local_media_type(&source.origin)?,
          job_params_json(&source.params, JobKind::Ingest)?,
        ),
        SourceKind::Remote => (
          EntitySourceKind::Remote,
          JobKind::Download,
          &source
            .media_type
            .context("Remote source media_type is required")?,
          job_params_json(&source.params, JobKind::Download)?,
        ),
      };

      validate_source_job_params(&job_runtime, initial_job_kind, &source.params)?;

      store
        .create_source(
          &source_id,
          &project_id,
          &None,
          &kind,
          media_type,
          &source.origin,
          &source.params,
        )
        .await?;

      job_service
        .enqueue(&initial_job_kind, &source_id, &initial_job_params)
        .await?;

      Ok(())
    }
    .await;

    match result {
      Ok(()) => imported += 1,
      Err(error) => errors.push(format!("'{}': {}", source.origin, error)),
    }
  }

  if !errors.is_empty() {
    return Err(
      anyhow::anyhow!(
        "Imported {imported}/{total} sources. {} failed: {}",
        errors.len(),
        errors.join(" | ")
      )
      .into(),
    );
  }

  Ok(())
}

#[tauri::command]
pub async fn get_remote_source_metadata(
  sidecar_runtime: SidecarRuntime<'_>,
  link: String,
) -> CommandResult<Vec<RemoteSourceMetadata>> {
  let client = YtdlpSidecarClient::new(sidecar_runtime.inner().clone());
  let items = client.fetch_remote_source_metadata(&link).await?;

  Ok(
    items
      .into_iter()
      .map(|item| RemoteSourceMetadata {
        title: item.title,
        url: item.url,
      })
      .collect(),
  )
}

fn validate_source_job_params(
  job_runtime: &JobRuntime<'_>,
  initial_job_kind: JobKind,
  params: &Value,
) -> anyhow::Result<()> {
  let initial_params_json = job_params_json(params, initial_job_kind)?;
  job_runtime.validate_job_params(&initial_job_kind, &initial_params_json)?;

  let transcribe_params_json = job_params_json(params, JobKind::Transcribe)?;
  job_runtime.validate_job_params(&JobKind::Transcribe, &transcribe_params_json)?;

  let embed_params_json = job_params_json(params, JobKind::Embed)?;
  job_runtime.validate_job_params(&JobKind::Embed, &embed_params_json)?;

  Ok(())
}

fn job_params_json(params: &Value, kind: JobKind) -> anyhow::Result<String> {
  let key = match kind {
    JobKind::Ingest => "ingest",
    JobKind::Download => "download",
    JobKind::Transcribe => "transcribe",
    JobKind::Embed => "embed",
  };
  let params = params
    .get(key)
    .with_context(|| format!("Missing params for {key} job"))?;

  Ok(serde_json::to_string(params)?)
}

async fn reset_reprocess_outputs(
  store: &Repository<'_>,
  fs: &Filesystem<'_>,
  vector_store: &VectorStore<'_>,
  search_service: &SearchService<'_>,
  source: &Source,
  start_step: JobKind,
) -> anyhow::Result<()> {
  match start_step {
    JobKind::Ingest | JobKind::Download => {
      fs.delete_source_files(&source.project_id, &source.id)?;
      store.delete_artifact(&source.id).await?;
      store
        .update_source(
          &source.id,
          &SourceUpdate {
            title: Some(None),
            thumbnail: Some(None),
            origin_created_at: Some(None),
            duration: Some(None),
            ..Default::default()
          },
        )
        .await?;
      store.update_segments(&source.id, &[]).await?;
      vector_store
        .delete_segments(&source.project_id, &source.id)
        .await?;
      search_service
        .delete_source_index(&source.project_id, &source.id)
        .await?;
    }
    JobKind::Transcribe => {
      store.update_segments(&source.id, &[]).await?;
      vector_store
        .delete_segments(&source.project_id, &source.id)
        .await?;
      search_service
        .delete_source_index(&source.project_id, &source.id)
        .await?;
    }
    JobKind::Embed => {
      vector_store
        .delete_segments(&source.project_id, &source.id)
        .await?;
      search_service
        .delete_source_index(&source.project_id, &source.id)
        .await?;
    }
  }

  Ok(())
}

fn ensure_reprocess_step_supported(source: &Source, start_step: JobKind) -> anyhow::Result<()> {
  if matches!(
    (&source.kind, start_step),
    (EntitySourceKind::Local, JobKind::Download) | (EntitySourceKind::Remote, JobKind::Ingest)
  ) {
    anyhow::bail!("Selected reprocess step is not supported for this source kind");
  }

  Ok(())
}

fn map_source_with_jobs(
  mapper: &DtoMapper<'_>,
  source: &Source,
  jobs: &[Job],
) -> CommandResult<SourceWithJobsDto> {
  Ok(SourceWithJobsDto {
    source: mapper.source_to_dto(source)?,
    jobs: jobs
      .iter()
      .map(|job| mapper.job_to_dto(job))
      .collect::<anyhow::Result<Vec<_>>>()?,
  })
}

fn detect_local_media_type(origin: &str) -> anyhow::Result<SourceMediaType> {
  let kind = infer::get_from_path(origin)?;
  match kind {
    Some(kind) if kind.mime_type().starts_with("audio/") => Ok(SourceMediaType::Audio),
    Some(kind) if kind.mime_type().starts_with("video/") => Ok(SourceMediaType::Video),
    Some(kind) => anyhow::bail!("Unsupported local source MIME type: '{}'", kind.mime_type()),
    None => anyhow::bail!("Unable to detect local source media type"),
  }
}
