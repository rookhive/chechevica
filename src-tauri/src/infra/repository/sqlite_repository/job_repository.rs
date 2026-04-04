use async_trait::async_trait;

use super::SqliteRepository;
use crate::{
  application::{
    interfaces::repository::JobRepository,
    jobs::job::{Job, JobId, JobKind, JobStatus},
  },
  entities::source::SourceId,
  infra::repository::structs::JobRow,
};

#[async_trait]
impl JobRepository for SqliteRepository {
  async fn create_job(
    &self,
    source_id: &SourceId,
    kind: &JobKind,
    params_json: &str,
  ) -> anyhow::Result<Job> {
    let source_id = &source_id.to_string();
    let kind: &str = (*kind).into();
    let created_at = chrono::Utc::now().timestamp_millis();

    sqlx::query_as!(
      JobRow,
      r#"
        INSERT INTO jobs (source_id, kind, params_json, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      "#,
      source_id,
      kind,
      params_json,
      created_at,
    )
    .fetch_one(&self.pool)
    .await?
    .try_into()
  }

  async fn recover_stale_jobs(&self) -> anyhow::Result<Vec<JobKind>> {
    let mut tx = self.pool.begin().await?;
    let now = chrono::Utc::now().timestamp_millis();

    sqlx::query!(
      r#"
        UPDATE jobs
        SET
          status = 'queued',
          progress = 0,
          error = NULL,
          started_at = NULL,
          ready_at = NULL,
          finished_at = NULL
        WHERE status IN ('running', 'cancelling')
      "#,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
      r#"
        UPDATE sources
        SET status = 'processing', updated_at = $1
        WHERE status = 'cancelling'
          AND EXISTS (
            SELECT 1
            FROM jobs
            WHERE jobs.source_id = sources.id
              AND jobs.status = 'queued'
          )
      "#,
      now,
    )
    .execute(&mut *tx)
    .await?;

    let rows = sqlx::query!(
      r#"
        SELECT DISTINCT kind
        FROM jobs
        WHERE status = 'queued'
        ORDER BY kind ASC
      "#,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    rows
      .into_iter()
      .map(|row| JobKind::try_from(row.kind.as_str()).map_err(anyhow::Error::msg))
      .collect()
  }

  async fn claim_next_job(&self, kind: &JobKind) -> anyhow::Result<Option<Job>> {
    let kind: &str = (*kind).into();
    let started_at = chrono::Utc::now().timestamp_millis();
    let processing_status: &str = JobStatus::Processing.into();
    let queued_status: &str = JobStatus::Queued.into();

    sqlx::query_as!(
      JobRow,
      r#"
        UPDATE jobs
        SET status = $1, started_at = $2
        WHERE id = (
          SELECT id FROM jobs
          WHERE kind = $3 AND status = $4
          ORDER BY created_at ASC
          LIMIT 1
        )
        RETURNING *
      "#,
      processing_status,
      started_at,
      kind,
      queued_status,
    )
    .fetch_optional(&self.pool)
    .await?
    .map(Job::try_from)
    .transpose()
  }

  async fn update_job(&self, job: &Job) -> anyhow::Result<()> {
    let job_id = job.id;
    let status = <&str>::from(job.status).to_string();
    let progress = job.progress;
    let error = job.error.clone();
    let params_json = job.params_json.clone();
    let started_at = job.started_at;
    let ready_at = job.ready_at;
    let finished_at = job.finished_at;

    sqlx::query!(
      r#"
        UPDATE jobs
        SET status = $2, progress = $3, error = $4, params_json = $5, started_at = $6, ready_at = $7, finished_at = $8
        WHERE id = $1
      "#,
      job_id,
      status,
      progress,
      error,
      params_json,
      started_at,
      ready_at,
      finished_at,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }

  async fn mark_job_cancelling(&self, job_id: &JobId) -> anyhow::Result<()> {
    let now = chrono::Utc::now().timestamp_millis();

    sqlx::query!(
      r#"
        UPDATE jobs
        SET status = 'cancelling', started_at = COALESCE(started_at, $2)
        WHERE id = $1
      "#,
      job_id,
      now,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }

  async fn mark_job_canceled(&self, job_id: &JobId) -> anyhow::Result<()> {
    let now = chrono::Utc::now().timestamp_millis();

    sqlx::query!(
      r#"
        UPDATE jobs
        SET status = 'canceled', finished_at = $2
        WHERE id = $1
      "#,
      job_id,
      now,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }
}
