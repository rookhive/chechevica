use async_trait::async_trait;

use super::SqliteRepository;
use crate::{
  application::{
    interfaces::repository::SourceRepository,
    jobs::job::{Job, JobKind},
  },
  entities::{
    artifact::Artifact,
    segment::{NewSegment, Segment},
    source::{Source, SourceId, SourceKind, SourceMediaType, SourceParams, SourceUpdate},
  },
  infra::repository::structs::{ArtifactRow, JobRow, SegmentRow, SourceRow},
};

#[async_trait]
impl SourceRepository for SqliteRepository {
  async fn create_source(
    &self,
    source_id: &SourceId,
    project_id: &crate::entities::project::ProjectId,
    title: &Option<String>,
    kind: &SourceKind,
    media_type: &SourceMediaType,
    origin: &str,
    params: &SourceParams,
  ) -> anyhow::Result<()> {
    let source_id = source_id.to_string();
    let project_id = project_id.to_string();
    let kind = kind.as_db_value();
    let media_type = media_type.as_db_value();
    let params_json = serde_json::to_string(params)?;
    let created_at = chrono::Utc::now().timestamp_millis();

    sqlx::query!(
      r#"
        INSERT INTO sources (
          id,
          project_id,
          title,
          kind,
          media_type,
          origin,
          params_json,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      "#,
      source_id,
      project_id,
      title,
      kind,
      media_type,
      origin,
      params_json,
      created_at,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }

  async fn delete_source(&self, source_id: &SourceId) -> anyhow::Result<()> {
    let source_id = &source_id.to_string();

    sqlx::query!(
      r#"
        DELETE FROM sources
        WHERE id = $1
      "#,
      source_id,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }

  async fn fetch_sources(
    &self,
    project_id: &crate::entities::project::ProjectId,
  ) -> anyhow::Result<Vec<Source>> {
    let project_id = &project_id.to_string();

    sqlx::query_as!(
      SourceRow,
      r#"
        SELECT
          id,
          project_id,
          title,
          thumbnail,
          media_type,
          kind,
          status,
          origin,
          origin_created_at,
          params_json,
          duration,
          created_at,
          updated_at,
          ingest_job_id,
          download_job_id,
          transcribe_job_id,
          embed_job_id
        FROM sources
        WHERE project_id = $1
        ORDER BY created_at ASC
      "#,
      project_id,
    )
    .fetch_all(&self.pool)
    .await?
    .into_iter()
    .map(Source::try_from)
    .collect()
  }

  async fn fetch_active_jobs(
    &self,
    project_id: &crate::entities::project::ProjectId,
  ) -> anyhow::Result<Vec<Job>> {
    let project_id = &project_id.to_string();

    sqlx::query_as!(
      JobRow,
      r#"
        SELECT
          j.id,
          j.source_id,
          j.kind,
          j.status,
          j.progress,
          j.params_json,
          j.error,
          j.created_at,
          j.started_at,
          j.ready_at,
          j.finished_at
        FROM sources s
        JOIN jobs j ON j.id IN (
          s.ingest_job_id,
          s.download_job_id,
          s.transcribe_job_id,
          s.embed_job_id
        )
        WHERE s.project_id = $1
          AND s.status != 'succeeded'
          AND j.source_id = s.id
      "#,
      project_id,
    )
    .fetch_all(&self.pool)
    .await?
    .into_iter()
    .map(Job::try_from)
    .collect()
  }

  async fn fetch_source(&self, source_id: &SourceId) -> anyhow::Result<Option<Source>> {
    let source_id = &source_id.to_string();

    sqlx::query_as!(
      SourceRow,
      r#"
        SELECT
          id,
          project_id,
          title,
          thumbnail,
          media_type,
          kind,
          status,
          origin,
          origin_created_at,
          params_json,
          duration,
          created_at,
          updated_at,
          ingest_job_id,
          download_job_id,
          transcribe_job_id,
          embed_job_id
        FROM sources
        WHERE id = $1
        LIMIT 1
      "#,
      source_id,
    )
    .fetch_optional(&self.pool)
    .await?
    .map(Source::try_from)
    .transpose()
  }

  async fn fetch_source_jobs(&self, source_id: &SourceId) -> anyhow::Result<Vec<Job>> {
    let source_id = &source_id.to_string();

    sqlx::query_as!(
      JobRow,
      r#"
        SELECT
          j.id,
          j.source_id,
          j.kind,
          j.status,
          j.progress,
          j.params_json,
          j.error,
          j.created_at,
          j.started_at,
          j.ready_at,
          j.finished_at
        FROM sources s
        JOIN jobs j ON j.id IN (
          s.ingest_job_id,
          s.download_job_id,
          s.transcribe_job_id,
          s.embed_job_id
        )
        WHERE s.id = $1
          AND j.source_id = s.id
      "#,
      source_id,
    )
    .fetch_all(&self.pool)
    .await?
    .into_iter()
    .map(Job::try_from)
    .collect()
  }

  async fn fetch_processing_sources(&self) -> anyhow::Result<Vec<Source>> {
    sqlx::query_as!(
      SourceRow,
      r#"
        SELECT
          s.id,
          s.project_id,
          s.title,
          s.thumbnail,
          s.media_type,
          s.kind,
          s.status,
          s.origin,
          s.origin_created_at,
          s.params_json,
          s.duration,
          s.created_at,
          s.updated_at,
          s.ingest_job_id,
          s.download_job_id,
          s.transcribe_job_id,
          s.embed_job_id
        FROM sources s
        WHERE s.status != 'succeeded'
        ORDER BY s.created_at ASC
      "#,
    )
    .fetch_all(&self.pool)
    .await?
    .into_iter()
    .map(Source::try_from)
    .collect()
  }

  async fn fetch_artifact(&self, source_id: &SourceId) -> anyhow::Result<Option<Artifact>> {
    let source_id = source_id.to_string();

    Ok(
      sqlx::query_as!(
        ArtifactRow,
        r#"
          SELECT a.id, s.project_id, a.source_id, a.filename, a.size
          FROM artifacts a
          INNER JOIN sources s ON s.id = a.source_id
          WHERE a.source_id = $1
          LIMIT 1
        "#,
        source_id,
      )
      .fetch_optional(&self.pool)
      .await?
      .map(Artifact::try_from)
      .transpose()?,
    )
  }

  async fn update_source(
    &self,
    source_id: &SourceId,
    update: &SourceUpdate,
  ) -> anyhow::Result<Source> {
    let source_id = source_id.to_string();
    let title = update.title.as_ref().and_then(|value| value.as_deref());
    let thumbnail = update.thumbnail.as_ref().and_then(|value| value.as_deref());
    let media_type = update.media_type.map(|value| value.as_db_value());
    let status = update.status.as_ref().map(|value| value.as_db_value());
    let origin_created_at = update.origin_created_at.flatten();
    let params_json = serde_json::to_string(&update.params_json)?;
    let duration = update.duration.flatten();
    let updated_at = chrono::Utc::now().timestamp_millis();

    let is_title_set = update.title.is_some();
    let is_thumbnail_set = update.thumbnail.is_some();
    let is_media_type_set = update.media_type.is_some();
    let is_status_set = update.status.is_some();
    let is_origin_created_at_set = update.origin_created_at.is_some();
    let is_params_json_set = update.params_json.is_some();
    let is_duration_set = update.duration.is_some();

    sqlx::query_as!(
      SourceRow,
      r#"
        UPDATE sources
        SET
          title = CASE WHEN $2 THEN $3 ELSE title END,
          thumbnail = CASE WHEN $4 THEN $5 ELSE thumbnail END,
          media_type = CASE WHEN $6 THEN $7 ELSE media_type END,
          status = CASE WHEN $8 THEN $9 ELSE status END,
          origin_created_at = CASE WHEN $10 THEN $11 ELSE origin_created_at END,
          params_json = CASE WHEN $12 THEN $13 ELSE params_json END,
          duration = CASE WHEN $14 THEN $15 ELSE duration END,
          updated_at = $16
        WHERE id = $1
        RETURNING *
      "#,
      source_id,
      is_title_set,
      title,
      is_thumbnail_set,
      thumbnail,
      is_media_type_set,
      media_type,
      is_status_set,
      status,
      is_origin_created_at_set,
      origin_created_at,
      is_params_json_set,
      params_json,
      is_duration_set,
      duration,
      updated_at,
    )
    .fetch_one(&self.pool)
    .await?
    .try_into()
  }

  async fn clear_source_jobs(
    &self,
    source_id: &SourceId,
    start_kind: &JobKind,
  ) -> anyhow::Result<()> {
    let source_id = source_id.to_string();
    let updated_at = chrono::Utc::now().timestamp_millis();
    let start_kind_index = match start_kind {
      JobKind::Ingest => 0,
      JobKind::Download => 1,
      JobKind::Transcribe => 2,
      JobKind::Embed => 3,
    };

    sqlx::query!(
      r#"
        UPDATE sources
        SET
          ingest_job_id = CASE WHEN $2 <= 0 THEN NULL ELSE ingest_job_id END,
          download_job_id = CASE WHEN $2 <= 1 THEN NULL ELSE download_job_id END,
          transcribe_job_id = CASE WHEN $2 <= 2 THEN NULL ELSE transcribe_job_id END,
          embed_job_id = CASE WHEN $2 <= 3 THEN NULL ELSE embed_job_id END,
          updated_at = $3
        WHERE id = $1
      "#,
      source_id,
      start_kind_index,
      updated_at,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }

  async fn delete_artifact(&self, source_id: &SourceId) -> anyhow::Result<()> {
    let source_id = source_id.to_string();
    let mut tx = self.pool.begin().await?;

    sqlx::query!(
      r#"
        DELETE FROM artifacts
        WHERE source_id = $1
      "#,
      source_id,
    )
    .execute(&mut *tx)
    .await?;

    let updated_at = chrono::Utc::now().timestamp_millis();
    sqlx::query!(
      r#"
        UPDATE sources
        SET
          thumbnail = NULL,
          updated_at = $2
        WHERE id = $1
      "#,
      source_id,
      updated_at,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
  }

  async fn update_artifact(
    &self,
    source_id: &SourceId,
    filename: &str,
    size: Option<u64>,
  ) -> anyhow::Result<()> {
    let source_id = source_id.to_string();
    let artifact_id = uuid::Uuid::now_v7().to_string();
    let size = size.map(|value| value as i64);

    sqlx::query!(
      r#"
        INSERT INTO artifacts (id, source_id, filename, size)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(source_id) DO UPDATE SET
          filename = excluded.filename,
          size = excluded.size
      "#,
      artifact_id,
      source_id,
      filename,
      size,
    )
    .execute(&self.pool)
    .await?;

    Ok(())
  }

  async fn update_segments(
    &self,
    source_id: &SourceId,
    segments: &[NewSegment],
  ) -> anyhow::Result<()> {
    let source_id = source_id.to_string();
    let mut tx = self.pool.begin().await?;

    sqlx::query!(
      r#"
        DELETE FROM segments
        WHERE source_id = $1
      "#,
      source_id,
    )
    .execute(&mut *tx)
    .await?;

    for segment in segments {
      sqlx::query!(
        r#"
          INSERT INTO segments (source_id, start, end, text)
          VALUES ($1, $2, $3, $4)
        "#,
        source_id,
        segment.start,
        segment.end,
        segment.text,
      )
      .execute(&mut *tx)
      .await?;
    }

    tx.commit().await?;

    Ok(())
  }

  async fn fetch_segments(&self, source_id: &SourceId) -> anyhow::Result<Vec<Segment>> {
    let source_id = source_id.to_string();

    sqlx::query_as!(
      SegmentRow,
      r#"
        SELECT
          id,
          source_id,
          start,
          end,
          text
        FROM segments
        WHERE source_id = $1
        ORDER BY start ASC, id ASC
      "#,
      source_id,
    )
    .fetch_all(&self.pool)
    .await?
    .into_iter()
    .map(Segment::try_from)
    .collect()
  }
}
