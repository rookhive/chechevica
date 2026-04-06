use std::sync::Arc;

use serde_json::to_string;

use crate::{
  application::{
    dto::structs::{
      ArtifactDto, JobDto, ProjectDto, ProjectInfoDto, SearchResultDto, SegmentDto, SourceDto,
      SourceKindDto, SourceMediaTypeDto, SourceStatusDto,
    },
    interfaces::{filesystem::Filesystem, repository::SearchHit},
    jobs::job::Job,
  },
  entities::{
    artifact::Artifact,
    project::{Project, ProjectInfo},
    segment::Segment,
    source::Source,
  },
};

#[derive(Clone)]
pub struct DtoMapper {
  fs: Arc<dyn Filesystem>,
}

impl DtoMapper {
  pub fn new(fs: Arc<dyn Filesystem>) -> Self {
    Self { fs }
  }

  pub fn project_to_dto(&self, project: &Project) -> anyhow::Result<ProjectDto> {
    Ok(ProjectDto {
      id: project.id.to_string(),
      title: project.title.clone(),
      thumbnail: match &project.thumbnail {
        Some(filename) => Some(self.fs.get_project_thumbnail_path(&project.id, filename)?),
        None => None,
      },
      created_at: project.created_at,
      updated_at: project.updated_at,
    })
  }

  pub fn project_info_to_dto(&self, project_info: &ProjectInfo) -> anyhow::Result<ProjectInfoDto> {
    Ok(ProjectInfoDto {
      project: self.project_to_dto(&project_info.project)?,
      sources_count: project_info.sources_count,
    })
  }

  pub fn source_to_dto(&self, source: &Source) -> anyhow::Result<SourceDto> {
    Ok(SourceDto {
      id: source.id.to_string(),
      project_id: source.project_id.to_string(),
      title: source.title.clone(),
      media_type: SourceMediaTypeDto::from(&source.media_type),
      thumbnail: match &source.thumbnail {
        Some(filename) => Some(self.fs.get_source_thumbnail_path(
          &source.project_id,
          &source.id,
          filename,
        )?),
        None => None,
      },
      kind: SourceKindDto::from(&source.kind),
      status: SourceStatusDto::from(&source.status),
      origin: source.origin.clone(),
      origin_created_at: source.origin_created_at,
      params_json: to_string(&source.params_json)?,
      duration: source.duration,
      created_at: source.created_at,
      updated_at: source.updated_at,
      ingest_job_id: source.ingest_job_id,
      download_job_id: source.download_job_id,
      transcribe_job_id: source.transcribe_job_id,
      embed_job_id: source.embed_job_id,
    })
  }

  pub fn job_to_dto(&self, job: &Job) -> anyhow::Result<JobDto> {
    Ok(JobDto {
      id: job.id,
      source_id: job.source_id.to_string(),
      kind: <&str>::from(job.kind).to_string(),
      status: <&str>::from(job.status).to_string(),
      error: job.error.clone(),
      params_json: Some(job.params_json.clone()),
      progress: job.progress,
      created_at: job.created_at,
      started_at: job.started_at,
      ready_at: job.ready_at,
      finished_at: job.finished_at,
    })
  }

  pub fn segment_to_dto(&self, segment: &Segment) -> anyhow::Result<SegmentDto> {
    Ok(SegmentDto {
      id: segment.id,
      source_id: segment.source_id.to_string(),
      start: segment.start,
      end: segment.end,
      text: segment.text.clone(),
    })
  }

  pub fn artifact_to_dto(&self, artifact: &Artifact) -> anyhow::Result<ArtifactDto> {
    Ok(ArtifactDto {
      id: artifact.id.to_string(),
      source_id: artifact.source_id.to_string(),
      path: self.fs.get_source_artifact_path(
        &artifact.project_id,
        &artifact.source_id,
        &artifact.filename,
      )?,
      size: artifact.size,
      mime_type: artifact.mime_type.clone(),
    })
  }

  pub fn search_hit_to_dto(&self, hit: &SearchHit) -> anyhow::Result<SearchResultDto> {
    Ok(SearchResultDto {
      project: self.project_to_dto(&hit.project)?,
      source: self.source_to_dto(&hit.source)?,
      segment: self.segment_to_dto(&hit.segment)?,
      score: hit.score,
    })
  }
}
