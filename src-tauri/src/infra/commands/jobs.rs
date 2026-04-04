use crate::{
  application::{dto::structs::JobDto, jobs::runtime::StepParameters},
  entities::project::ProjectId,
  infra::commands::{CommandResult, DtoMapper, JobRuntime, Repository},
};

#[tauri::command]
pub async fn get_step_parameters(job_runtime: JobRuntime<'_>) -> CommandResult<StepParameters> {
  Ok(job_runtime.step_parameters())
}

#[tauri::command]
pub async fn get_active_jobs(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  project_id: ProjectId,
) -> CommandResult<Vec<JobDto>> {
  Ok(
    db.fetch_active_jobs(&project_id)
      .await?
      .iter()
      .map(|job| mapper.job_to_dto(job))
      .collect::<anyhow::Result<Vec<JobDto>>>()?,
  )
}
