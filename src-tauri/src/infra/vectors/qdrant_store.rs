use std::{path::PathBuf, sync::Arc};

use anyhow::Context;
use async_trait::async_trait;
use qdrant_client::{
  Payload, Qdrant,
  qdrant::{
    Condition, CreateCollectionBuilder, DeletePointsBuilder, Distance, FieldCondition, Filter,
    Match, PointStruct, ScoredPoint, SearchParams, SearchPointsBuilder, UpsertPointsBuilder,
    VectorParamsBuilder, condition::ConditionOneOf, r#match::MatchValue, point_id::PointIdOptions,
  },
};
use serde_json::json;

use crate::{
  application::interfaces::vectors::{
    SegmentEmbedding, SemanticSearchFilters, SemanticSearchHit, SemanticSearchRequest, VectorStore,
  },
  entities::{project::ProjectId, segment::SegmentId, source::SourceId},
  infra::sidecars::{
    clients::qdrant_sidecar_client::QdrantSidecarClient, sidecar_runtime::SidecarRuntime,
  },
};

pub struct QdrantStore {
  client: Qdrant,
}

const SHARED_COLLECTION_NAME: &str = "vectors";
const EMBEDDING_DIMENSION: u64 = 1024;

impl QdrantStore {
  pub async fn try_new(
    sidecar_runtime: Arc<SidecarRuntime>,
    data_directory: PathBuf,
  ) -> anyhow::Result<Self> {
    QdrantSidecarClient::spawn(sidecar_runtime, data_directory).await?;

    let client = Qdrant::from_url("http://localhost:6334")
      .build()
      .map_err(anyhow::Error::from)?;

    let store = Self { client };

    store.ensure_shared_collection().await?;

    Ok(store)
  }

  async fn ensure_shared_collection(&self) -> anyhow::Result<()> {
    if !self
      .client
      .collection_exists(SHARED_COLLECTION_NAME)
      .await?
    {
      self
        .client
        .create_collection(
          CreateCollectionBuilder::new(SHARED_COLLECTION_NAME).vectors_config(
            VectorParamsBuilder::new(EMBEDDING_DIMENSION, Distance::Cosine),
          ),
        )
        .await
        .context("Create shared vector collection")?;
    }

    Ok(())
  }
}

#[async_trait]
impl VectorStore for QdrantStore {
  async fn create_project(&self, _project_id: &ProjectId) -> anyhow::Result<()> {
    self.ensure_shared_collection().await
  }

  async fn delete_project(&self, project_id: &ProjectId) -> anyhow::Result<()> {
    if !self
      .client
      .collection_exists(SHARED_COLLECTION_NAME)
      .await?
    {
      return Ok(());
    }

    let filter = Filter {
      must: vec![project_id_condition(project_id)],
      ..Default::default()
    };

    self
      .client
      .delete_points(
        DeletePointsBuilder::new(SHARED_COLLECTION_NAME)
          .points(filter)
          .wait(true),
      )
      .await
      .context("Delete project points")?;

    Ok(())
  }

  async fn upsert_segments(
    &self,
    project_id: &ProjectId,
    entries: &[SegmentEmbedding],
  ) -> anyhow::Result<()> {
    if entries.is_empty() {
      return Ok(());
    }

    self.ensure_shared_collection().await?;

    let points: Vec<PointStruct> = entries
      .iter()
      .map(|e| {
        let payload = json!({
          "project_id": project_id.to_string(),
          "source_id": e.source_id.to_string(),
        });
        let payload = Payload::try_from(payload).context("Build segment payload")?;

        Ok(PointStruct::new(
          e.segment_id as u64,
          e.vector.clone(),
          payload,
        ))
      })
      .collect::<anyhow::Result<Vec<PointStruct>>>()?;

    self
      .client
      .upsert_points(UpsertPointsBuilder::new(SHARED_COLLECTION_NAME, points).wait(true))
      .await
      .context("Upsert segment points")?;

    Ok(())
  }

  async fn delete_segments(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<()> {
    if !self
      .client
      .collection_exists(SHARED_COLLECTION_NAME)
      .await?
    {
      return Ok(());
    }

    let filter = Filter {
      must: vec![
        project_id_condition(project_id),
        source_id_condition(source_id),
      ],
      ..Default::default()
    };

    self
      .client
      .delete_points(
        DeletePointsBuilder::new(SHARED_COLLECTION_NAME)
          .points(filter)
          .wait(true),
      )
      .await
      .context("Delete points by source")?;

    Ok(())
  }

  async fn semantic_search(
    &self,
    request: &SemanticSearchRequest,
  ) -> anyhow::Result<Vec<SemanticSearchHit>> {
    if matches!(request.filters.project_ids.as_ref(), Some(project_ids) if project_ids.is_empty()) {
      return Ok(vec![]);
    }

    if !self
      .client
      .collection_exists(SHARED_COLLECTION_NAME)
      .await?
    {
      return Ok(vec![]);
    }

    let qdrant_filter = build_qdrant_filters(&request.filters);

    let mut builder = SearchPointsBuilder::new(
      SHARED_COLLECTION_NAME,
      request.vector.clone(),
      request.top_k as u64,
    );

    if let Some(ref filter) = qdrant_filter {
      builder = builder.filter(filter.clone());
    }

    builder = builder.params(SearchParams {
      exact: Some(true),
      ..Default::default()
    });

    builder = builder.with_payload(false);

    let response = self
      .client
      .search_points(builder)
      .await
      .context("Search points")?;

    let hits = response
      .result
      .into_iter()
      .filter_map(|point| {
        extract_segment_id(&point).map(|segment_id| SemanticSearchHit {
          segment_id,
          score: point.score,
        })
      })
      .collect();

    Ok(hits)
  }
}

fn project_id_condition(project_id: &ProjectId) -> Condition {
  keyword_match_condition("project_id", project_id)
}

fn source_id_condition(source_id: &SourceId) -> Condition {
  keyword_match_condition("source_id", source_id)
}

fn build_qdrant_filters(filters: &SemanticSearchFilters) -> Option<Filter> {
  let mut must = Vec::new();

  if let Some(project_ids) = &filters.project_ids
    && !project_ids.is_empty()
  {
    must.push(any_match_condition("project_id", project_ids));
  }

  if let Some(source_ids) = &filters.source_ids
    && !source_ids.is_empty()
  {
    must.push(any_match_condition("source_id", source_ids));
  }

  if must.is_empty() {
    None
  } else {
    Some(Filter {
      must,
      ..Default::default()
    })
  }
}

fn keyword_match_condition<T: ToString>(key: &str, value: &T) -> Condition {
  Condition {
    condition_one_of: Some(ConditionOneOf::Field(FieldCondition {
      key: key.to_string(),
      r#match: Some(Match {
        match_value: Some(MatchValue::Keyword(value.to_string())),
      }),
      ..Default::default()
    })),
  }
}

fn any_match_condition<T: ToString>(key: &str, values: &[T]) -> Condition {
  if values.len() == 1 {
    return keyword_match_condition(key, &values[0]);
  }

  let should: Vec<Condition> = values
    .iter()
    .map(|value| keyword_match_condition(key, value))
    .collect();

  Condition {
    condition_one_of: Some(ConditionOneOf::Filter(Filter {
      should,
      ..Default::default()
    })),
  }
}

fn extract_segment_id(point: &ScoredPoint) -> Option<SegmentId> {
  match point.id.as_ref()?.point_id_options.as_ref()? {
    PointIdOptions::Num(num) => Some(*num as SegmentId),
    _ => None,
  }
}
