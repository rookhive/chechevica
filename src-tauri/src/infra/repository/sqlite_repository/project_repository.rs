use async_trait::async_trait;

use super::SqliteRepository;
use crate::{
  application::interfaces::repository::ProjectRepository,
  entities::project::{Project, ProjectId, ProjectInfo},
  infra::repository::structs::{ProjectInfoRow, ProjectRow},
};

#[async_trait]
impl ProjectRepository for SqliteRepository {
  async fn fetch_projects(&self) -> anyhow::Result<Vec<ProjectInfo>> {
    sqlx::query_as!(
      ProjectInfoRow,
      r#"
        SELECT
          p.id,
          p.title,
          p.thumbnail,
          p.created_at,
          p.updated_at,
          COUNT(s.id) AS sources_count
        FROM projects p
        LEFT JOIN sources s ON s.project_id = p.id
        GROUP BY p.id, p.title, p.thumbnail, p.created_at, p.updated_at
        ORDER BY p.created_at DESC
      "#,
    )
    .fetch_all(&self.pool)
    .await?
    .into_iter()
    .map(ProjectInfo::try_from)
    .collect()
  }

  async fn fetch_project(&self, project_id: &ProjectId) -> anyhow::Result<Option<Project>> {
    let project_id = &project_id.to_string();

    sqlx::query_as!(
      ProjectRow,
      r#"
        SELECT id, title, thumbnail, created_at, updated_at
        FROM projects
        WHERE id = $1
      "#,
      project_id
    )
    .fetch_optional(&self.pool)
    .await?
    .map(Project::try_from)
    .transpose()
  }

  async fn create_project(
    &self,
    project_id: &ProjectId,
    title: &str,
    thumbnail: Option<&str>,
  ) -> anyhow::Result<Project> {
    let project_id = &project_id.to_string();
    let created_at = chrono::Utc::now().timestamp_millis();

    sqlx::query_as!(
      ProjectRow,
      r#"
        INSERT INTO projects (id, title, thumbnail, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      "#,
      project_id,
      title,
      thumbnail,
      created_at,
    )
    .fetch_one(&self.pool)
    .await?
    .try_into()
  }

  async fn update_project(
    &self,
    project_id: &ProjectId,
    title: &str,
    thumbnail: Option<&str>,
  ) -> anyhow::Result<Project> {
    let project_id = &project_id.to_string();
    let updated_at = chrono::Utc::now().timestamp_millis();

    sqlx::query_as!(
      ProjectRow,
      r#"
        UPDATE projects
        SET title = $2, thumbnail = $3, updated_at = $4
        WHERE id = $1
        RETURNING *
      "#,
      project_id,
      title,
      thumbnail,
      updated_at,
    )
    .fetch_one(&self.pool)
    .await?
    .try_into()
  }

  async fn delete_project(&self, project_id: &ProjectId) -> anyhow::Result<()> {
    let project_id = &project_id.to_string();

    sqlx::query!(
      r#"
        DELETE FROM projects
        WHERE id = $1
      "#,
      project_id,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }
}
