use async_trait::async_trait;

use crate::entities::{project::ProjectId, segment::SegmentId, source::SourceId};

pub struct SegmentEmbedding {
  pub vector: Vec<f32>,
  pub source_id: SourceId,
  pub segment_id: SegmentId,
}

#[derive(Default, Clone)]
pub struct SemanticSearchFilters {
  pub project_ids: Option<Vec<ProjectId>>,
  pub source_ids: Option<Vec<SourceId>>,
}

pub struct SemanticSearchRequest {
  pub vector: Vec<f32>,
  pub filters: SemanticSearchFilters,
  pub top_k: usize, // How many results to return
}

pub struct SemanticSearchHit {
  pub segment_id: SegmentId,
  pub score: f32,
}

#[async_trait]
pub trait VectorStore: Send + Sync {
  async fn create_project(&self, project_id: &ProjectId) -> anyhow::Result<()>;
  async fn delete_project(&self, project_id: &ProjectId) -> anyhow::Result<()>;
  async fn upsert_segments(
    &self,
    project_id: &ProjectId,
    entries: &[SegmentEmbedding],
  ) -> anyhow::Result<()>;
  async fn delete_segments(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<()>;
  async fn semantic_search(
    &self,
    request: &SemanticSearchRequest,
  ) -> anyhow::Result<Vec<SemanticSearchHit>>;
}
