use async_trait::async_trait;

use crate::entities::{
  project::ProjectId,
  segment::{Segment, SegmentId},
  source::SourceId,
};

#[derive(Default, Clone)]
pub struct KeywordSearchFilters {
  pub project_ids: Option<Vec<ProjectId>>,
  pub source_ids: Option<Vec<SourceId>>,
}

pub struct KeywordSearchRequest {
  pub query: String,
  pub filters: KeywordSearchFilters,
  pub top_k: usize, // How many results to return
}

pub struct KeywordSearchHit {
  pub segment_id: SegmentId,
  pub score: f32,
}

#[async_trait]
pub trait SearchService: Send + Sync {
  async fn search(&self, request: &KeywordSearchRequest) -> anyhow::Result<Vec<KeywordSearchHit>>;

  async fn update_index(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    segments: &[Segment],
  ) -> anyhow::Result<()>;

  async fn delete_source_index(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<()>;

  async fn delete_project_index(&self, project_id: &ProjectId) -> anyhow::Result<()>;
}
