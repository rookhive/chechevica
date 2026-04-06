use std::path::PathBuf;

use crate::entities::{project::ProjectId, source::SourceId};

pub trait Filesystem: Send + Sync {
  fn ensure_repository_directory(&self) -> anyhow::Result<PathBuf>;
  fn ensure_vectors_directory(&self) -> anyhow::Result<PathBuf>;
  fn ensure_source_directory(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<String>;
  fn create_artifact_filename(&self, source_filename: &str) -> anyhow::Result<String>;
  fn ingest_project_thumbnail(
    &self,
    project_id: &ProjectId,
    file_absolute_path: &str,
  ) -> anyhow::Result<String>;
  fn delete_project_thumbnail(
    &self,
    project_id: &ProjectId,
    thumbnail_filename: &str,
  ) -> anyhow::Result<()>;
  fn delete_project_files(&self, project_id: &ProjectId) -> anyhow::Result<()>;
  fn delete_source_files(&self, project_id: &ProjectId, source_id: &SourceId)
  -> anyhow::Result<()>;
  fn get_project_thumbnail_path(
    &self,
    project_id: &ProjectId,
    thumbnail_filename: &str,
  ) -> anyhow::Result<String>;
  fn get_source_thumbnail_path(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    thumbnail_filename: &str,
  ) -> anyhow::Result<String>;
  fn get_source_artifact_path(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    artifact_filename: &str,
  ) -> anyhow::Result<String>;
  fn ingest_source_artifact(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    file_absolute_path: &str,
    source_filename: &str,
  ) -> anyhow::Result<String>;
  fn get_file_size(&self, absolute_path: &str) -> anyhow::Result<Option<u64>>;
  fn get_mime_type(&self, absolute_path: &str) -> anyhow::Result<String>;
}
