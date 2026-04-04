use crate::{
  application::dto::structs::{ProjectDto, ProjectInfoDto},
  entities::project::ProjectId,
  infra::commands::{
    CommandResult, DtoMapper, Filesystem, Patch, Repository, SearchService, VectorStore,
  },
};

#[tauri::command]
pub async fn get_projects(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
) -> CommandResult<Vec<ProjectInfoDto>> {
  Ok(
    db.fetch_projects()
      .await?
      .iter()
      .map(|project| mapper.project_info_to_dto(project))
      .collect::<anyhow::Result<Vec<ProjectInfoDto>>>()?,
  )
}

#[tauri::command]
pub async fn get_project(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  project_id: ProjectId,
) -> CommandResult<Option<ProjectDto>> {
  Ok(
    db.fetch_project(&project_id)
      .await?
      .map(|project| mapper.project_to_dto(&project))
      .transpose()?,
  )
}

#[tauri::command]
pub async fn create_project(
  db: Repository<'_>,
  fs: Filesystem<'_>,
  vector_store: VectorStore<'_>,
  mapper: DtoMapper<'_>,
  title: String,
  thumbnail_path: Option<String>,
) -> CommandResult<ProjectDto> {
  let id = ProjectId::new();

  let project = db
    .create_project(
      &id,
      &title,
      thumbnail_path
        .map(|path| fs.ingest_project_thumbnail(&id, &path))
        .transpose()?
        .as_deref(),
    )
    .await?;

  vector_store.create_project(&id).await?;

  Ok(mapper.project_to_dto(&project)?)
}

#[tauri::command]
pub async fn update_project(
  db: Repository<'_>,
  fs: Filesystem<'_>,
  mapper: DtoMapper<'_>,
  project_id: ProjectId,
  title: String,
  thumbnail_patch: Patch<String>,
) -> CommandResult<ProjectDto> {
  let current_thumbnail = db
    .fetch_project(&project_id)
    .await?
    .and_then(|p| p.thumbnail);

  if !matches!(thumbnail_patch, Patch::Unchanged)
    && let Some(ref old) = current_thumbnail
  {
    fs.delete_project_thumbnail(&project_id, old)?;
  }

  let thumbnail = match thumbnail_patch {
    Patch::Set(path) => Some(fs.ingest_project_thumbnail(&project_id, &path)?),
    Patch::Remove => None,
    Patch::Unchanged => current_thumbnail,
  };

  Ok(
    mapper.project_to_dto(
      &db
        .update_project(&project_id, &title, thumbnail.as_deref())
        .await?,
    )?,
  )
}

#[tauri::command]
pub async fn delete_project(
  db: Repository<'_>,
  fs: Filesystem<'_>,
  vector_store: VectorStore<'_>,
  search_service: SearchService<'_>,
  project_id: ProjectId,
) -> CommandResult<()> {
  db.delete_project(&project_id).await?;
  vector_store.delete_project(&project_id).await?;
  fs.delete_project_files(&project_id)?;
  search_service.delete_project_index(&project_id).await?;

  Ok(())
}
