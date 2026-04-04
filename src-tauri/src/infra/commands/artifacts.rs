use crate::{
  application::dto::structs::ArtifactDto,
  entities::source::SourceId,
  infra::commands::{CommandResult, DtoMapper, Repository},
};

#[tauri::command]
pub async fn get_source_artifact(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  source_id: SourceId,
) -> CommandResult<Option<ArtifactDto>> {
  Ok(
    db.fetch_artifact(&source_id)
      .await?
      .map(|artifact| mapper.artifact_to_dto(&artifact))
      .transpose()?,
  )
}
