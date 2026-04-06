use async_trait::async_trait;

use crate::{
  application::jobs::job::{Job, JobId, JobKind},
  entities::{
    artifact::Artifact,
    project::{Project, ProjectId, ProjectInfo},
    segment::{NewSegment, Segment, SegmentId},
    source::{Source, SourceId, SourceKind, SourceMediaType, SourceParams, SourceUpdate},
  },
};

pub struct SearchHit {
  pub project: Project,
  pub source: Source,
  pub segment: Segment,
  pub score: f32,
}

pub trait Repository:
  ProjectRepository + SourceRepository + SearchRepository + JobRepository
{
}

impl<T> Repository for T where
  T: ProjectRepository + SourceRepository + SearchRepository + JobRepository
{
}

#[async_trait]
pub trait ProjectRepository: Send + Sync {
  async fn fetch_projects(&self) -> anyhow::Result<Vec<ProjectInfo>>;
  async fn fetch_project(&self, project_id: &ProjectId) -> anyhow::Result<Option<Project>>;
  async fn create_project(
    &self,
    project_id: &ProjectId,
    title: &str,
    thumbnail: Option<&str>,
  ) -> anyhow::Result<Project>;
  async fn update_project(
    &self,
    project_id: &ProjectId,
    title: &str,
    thumbnail: Option<&str>,
  ) -> anyhow::Result<Project>;
  async fn delete_project(&self, project_id: &ProjectId) -> anyhow::Result<()>;
}

#[async_trait]
pub trait SourceRepository: Send + Sync {
  async fn fetch_source(&self, source_id: &SourceId) -> anyhow::Result<Option<Source>>;
  #[allow(clippy::too_many_arguments)]
  async fn create_source(
    &self,
    source_id: &SourceId,
    project_id: &ProjectId,
    title: &Option<String>,
    kind: &SourceKind,
    media_type: &SourceMediaType,
    origin: &str,
    params: &SourceParams,
  ) -> anyhow::Result<()>;
  async fn update_source(
    &self,
    source_id: &SourceId,
    update: &SourceUpdate,
  ) -> anyhow::Result<Source>;
  async fn delete_source(&self, source_id: &SourceId) -> anyhow::Result<()>;
  async fn fetch_sources(&self, project_id: &ProjectId) -> anyhow::Result<Vec<Source>>;
  async fn fetch_processing_sources(&self) -> anyhow::Result<Vec<Source>>;
  async fn fetch_active_jobs(&self, project_id: &ProjectId) -> anyhow::Result<Vec<Job>>;
  async fn fetch_source_jobs(&self, source_id: &SourceId) -> anyhow::Result<Vec<Job>>;
  async fn clear_source_jobs(
    &self,
    source_id: &SourceId,
    start_kind: &JobKind,
  ) -> anyhow::Result<()>;
  async fn fetch_artifact(&self, source_id: &SourceId) -> anyhow::Result<Option<Artifact>>;
  async fn delete_artifact(&self, source_id: &SourceId) -> anyhow::Result<()>;
  async fn update_artifact(
    &self,
    source_id: &SourceId,
    filename: &str,
    size: Option<u64>,
    mime_type: &str,
  ) -> anyhow::Result<()>;
  async fn fetch_segments(&self, source_id: &SourceId) -> anyhow::Result<Vec<Segment>>;
  async fn update_segments(
    &self,
    source_id: &SourceId,
    segments: &[NewSegment],
  ) -> anyhow::Result<()>;
}

#[async_trait]
pub trait SearchRepository: Send + Sync {
  async fn fetch_search_hits(&self, segment_ids: Vec<SegmentId>) -> anyhow::Result<Vec<SearchHit>>;
}

#[async_trait]
pub trait JobRepository: Send + Sync {
  async fn create_job(
    &self,
    source_id: &SourceId,
    kind: &JobKind,
    params_json: &str,
  ) -> anyhow::Result<Job>;
  async fn update_job(&self, job: &Job) -> anyhow::Result<()>;
  async fn claim_next_job(&self, kind: &JobKind) -> anyhow::Result<Option<Job>>;
  async fn mark_job_cancelling(&self, job_id: &JobId) -> anyhow::Result<()>;
  async fn mark_job_canceled(&self, job_id: &JobId) -> anyhow::Result<()>;
  async fn recover_stale_jobs(&self) -> anyhow::Result<Vec<JobKind>>;
}
