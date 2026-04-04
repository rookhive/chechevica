use async_trait::async_trait;
use sqlx::{QueryBuilder, Sqlite};

use super::SqliteRepository;
use crate::{
  application::interfaces::repository::{SearchHit, SearchRepository},
  entities::segment::SegmentId,
  infra::repository::structs::SearchRow,
};

#[async_trait]
impl SearchRepository for SqliteRepository {
  async fn fetch_search_hits(&self, segment_ids: Vec<SegmentId>) -> anyhow::Result<Vec<SearchHit>> {
    if segment_ids.is_empty() {
      return Ok(vec![]);
    }

    let mut qb = QueryBuilder::<Sqlite>::new("WITH requested_segments(segment_id, rank) AS (");

    qb.push_values(
      segment_ids.iter().enumerate(),
      |mut row, (rank, segment_id)| {
        row.push_bind(segment_id).push_bind(rank as i64);
      },
    );

    qb.push(")");
    qb.push(
      r#"
        SELECT
          p.id AS project_id,
          p.title AS project_title,
          p.thumbnail AS project_thumbnail,
          p.created_at AS project_created_at,
          p.updated_at AS project_updated_at,
          src.id AS source_id,
          src.project_id AS source_project_id,
          src.title AS source_title,
          src.thumbnail AS source_thumbnail,
          src.media_type AS source_media_type,
          src.kind AS source_kind,
          src.status AS source_status,
          src.origin AS source_origin,
          src.origin_created_at AS source_origin_created_at,
          src.params_json AS source_params_json,
          src.duration AS source_duration,
          src.created_at AS source_created_at,
          src.updated_at AS source_updated_at,
          src.ingest_job_id AS source_ingest_job_id,
          src.download_job_id AS source_download_job_id,
          src.transcribe_job_id AS source_transcribe_job_id,
          src.embed_job_id AS source_embed_job_id,
          seg.id AS segment_id,
          seg.source_id AS segment_source_id,
          seg.start AS segment_start,
          seg.end AS segment_end,
          seg.text AS segment_text,
          0.0 AS score
        FROM requested_segments
        INNER JOIN segments seg ON seg.id = requested_segments.segment_id
        INNER JOIN sources src ON src.id = seg.source_id
        INNER JOIN projects p ON p.id = src.project_id
        ORDER BY requested_segments.rank ASC
      "#,
    );

    let rows: Vec<SearchRow> = qb.build_query_as().fetch_all(&self.pool).await?;

    rows.into_iter().map(SearchHit::try_from).collect()
  }
}
