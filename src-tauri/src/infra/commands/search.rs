use std::collections::{HashMap, HashSet};

use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::{
  application::{
    dto::structs::SearchResultDto,
    interfaces::{
      embeddings::EmbeddingInputKind,
      repository::SearchHit,
      search::{KeywordSearchFilters, KeywordSearchRequest},
      vectors::{SemanticSearchFilters, SemanticSearchRequest},
    },
  },
  entities::{project::ProjectId, segment::SegmentId, source::SourceId},
  infra::commands::{
    CommandResult, DtoMapper, EmbeddingService, Repository, SearchService, VectorStore,
  },
};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
  pub project_ids: Option<Vec<String>>,
  pub source_ids: Option<Vec<String>>,
  pub strict: Option<bool>,
}

fn dedupe_and_score_segment_ids<T, FId, FScore>(
  hits: Vec<T>,
  get_segment_id: FId,
  get_score: FScore,
) -> (Vec<SegmentId>, HashMap<SegmentId, f32>)
where
  FId: Fn(&T) -> SegmentId,
  FScore: Fn(&T) -> f32,
{
  let mut seen_segment_ids = HashSet::new();
  let mut score_by_segment_id = HashMap::<SegmentId, f32>::new();

  let segment_ids = hits
    .into_iter()
    .filter(|hit| seen_segment_ids.insert(get_segment_id(hit)))
    .map(|hit| {
      let segment_id = get_segment_id(&hit);
      score_by_segment_id.insert(segment_id, get_score(&hit));
      segment_id
    })
    .collect::<Vec<SegmentId>>();

  (segment_ids, score_by_segment_id)
}

async fn map_search_hits(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  segment_ids: Vec<SegmentId>,
  score_by_segment_id: HashMap<SegmentId, f32>,
  strict_filter: Option<&str>,
) -> CommandResult<Vec<SearchResultDto>> {
  let mut hits: Vec<SearchHit> = db.fetch_search_hits(segment_ids).await?;

  if let Some(filter) = strict_filter {
    let filter_lower = filter.to_lowercase();
    hits.retain(|hit| hit.segment.text.to_lowercase().contains(&filter_lower));
  }

  let results = hits
    .into_iter()
    .map(|mut hit| {
      hit.score = score_by_segment_id
        .get(&hit.segment.id)
        .copied()
        .unwrap_or_default();
      mapper.search_hit_to_dto(&hit)
    })
    .collect::<anyhow::Result<Vec<SearchResultDto>>>()?;

  Ok(results)
}

#[tauri::command]
pub async fn semantic_search(
  db: Repository<'_>,
  vector_store: VectorStore<'_>,
  embedding_service: EmbeddingService<'_>,
  mapper: DtoMapper<'_>,
  text: String,
  filters: SearchFilters,
) -> CommandResult<Vec<SearchResultDto>> {
  if text.is_empty() {
    return Ok(vec![]);
  }

  let project_ids = parse_project_ids(filters.project_ids.as_ref())?;
  let source_ids = parse_source_ids(filters.source_ids.as_ref())?;

  let mut on_ready = || {};
  let mut on_progress = |_| {};
  let vectors = embedding_service
    .generate_embeddings(
      &[text],
      EmbeddingInputKind::Query,
      &mut on_ready,
      &mut on_progress,
    )
    .await
    .context("Generate search embedding");

  embedding_service.schedule_unload();

  let vector = vectors?.pop().context("Missing search embedding")?;

  let vector_hits = vector_store
    .semantic_search(&SemanticSearchRequest {
      vector,
      top_k: 50,
      filters: SemanticSearchFilters {
        project_ids,
        source_ids,
      },
    })
    .await?;

  if vector_hits.is_empty() {
    return Ok(vec![]);
  }

  let (segment_ids, score_by_segment_id) =
    dedupe_and_score_segment_ids(vector_hits, |hit| hit.segment_id, |hit| hit.score);

  map_search_hits(db, mapper, segment_ids, score_by_segment_id, None).await
}

#[tauri::command]
pub async fn keyword_search(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  search_service: SearchService<'_>,
  text: String,
  filters: SearchFilters,
) -> CommandResult<Vec<SearchResultDto>> {
  if text.is_empty() {
    return Ok(vec![]);
  }

  let project_ids = parse_project_ids(filters.project_ids.as_ref())?;
  let source_ids = parse_source_ids(filters.source_ids.as_ref())?;

  let hits = search_service
    .search(&KeywordSearchRequest {
      query: text.clone(),
      top_k: 250,
      filters: KeywordSearchFilters {
        project_ids,
        source_ids,
      },
    })
    .await?;

  let (segment_ids, score_by_segment_id) =
    dedupe_and_score_segment_ids(hits, |hit| hit.segment_id, |hit| hit.score);

  let strict_filter = if filters.strict.unwrap_or(false) {
    Some(text.as_str())
  } else {
    None
  };

  map_search_hits(db, mapper, segment_ids, score_by_segment_id, strict_filter).await
}

fn parse_project_ids(values: Option<&Vec<String>>) -> anyhow::Result<Option<Vec<ProjectId>>> {
  values
    .map(|items| {
      items
        .iter()
        .map(|value| value.parse::<ProjectId>())
        .collect()
    })
    .transpose()
    .context("Parse project filters")
}

fn parse_source_ids(values: Option<&Vec<String>>) -> anyhow::Result<Option<Vec<SourceId>>> {
  values
    .map(|items| {
      items
        .iter()
        .map(|value| value.parse::<SourceId>())
        .collect()
    })
    .transpose()
    .context("Parse source filters")
}
