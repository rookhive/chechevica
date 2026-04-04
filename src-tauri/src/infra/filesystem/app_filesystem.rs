use std::{
  fs, io,
  path::{Path, PathBuf},
};

use anyhow::Context;
use uuid::Uuid;

use crate::{
  application::interfaces::filesystem::Filesystem,
  entities::{project::ProjectId, source::SourceId},
};

const DB_DIR_NAME: &str = "storage";
const PROJECTS_DIR_NAME: &str = "projects";
const SOURCES_DIR_NAME: &str = "sources";
const VECTOR_DB_DIR_NAME: &str = "vectors";

pub struct AppFilesystem {
  root: PathBuf,
}

impl AppFilesystem {
  pub fn new(root: &Path) -> Self {
    Self {
      root: root.to_path_buf(),
    }
  }

  fn get_project_directory(&self, project_id: &ProjectId) -> anyhow::Result<PathBuf> {
    Ok(
      self
        .root
        .join(PROJECTS_DIR_NAME)
        .join(project_id.to_string()),
    )
  }

  fn get_source_directory(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<PathBuf> {
    Ok(
      self
        .get_project_directory(project_id)?
        .join(SOURCES_DIR_NAME)
        .join(source_id.to_string()),
    )
  }
}

impl Filesystem for AppFilesystem {
  fn ensure_repository_directory(&self) -> anyhow::Result<PathBuf> {
    let directory = self.root.join(DB_DIR_NAME);
    build_path(&directory)?;
    Ok(directory)
  }

  fn ensure_vectors_directory(&self) -> anyhow::Result<PathBuf> {
    let directory = self.root.join(VECTOR_DB_DIR_NAME);
    build_path(&directory)?;
    Ok(directory)
  }

  fn create_artifact_filename(&self, source_filename: &str) -> anyhow::Result<String> {
    Ok(build_generated_filename(source_filename))
  }

  fn ensure_source_directory(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<String> {
    let directory = self.get_source_directory(project_id, source_id)?;
    build_path(&directory)?;
    Ok(directory.to_string_lossy().to_string())
  }

  fn ingest_project_thumbnail(
    &self,
    project_id: &ProjectId,
    file_absolute_path: &str,
  ) -> anyhow::Result<String> {
    let from_path = PathBuf::from(file_absolute_path);
    let extension = from_path
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("png");
    let filename = format!("{}.{}", Uuid::now_v7(), extension);
    let to_path = self.get_project_directory(project_id)?.join(&filename);

    build_file_path(&to_path)?;
    copy_file(&from_path, &to_path)?;

    Ok(filename)
  }

  fn delete_project_thumbnail(
    &self,
    project_id: &ProjectId,
    thumbnail_filename: &str,
  ) -> anyhow::Result<()> {
    let path = self
      .get_project_directory(project_id)?
      .join(thumbnail_filename);
    delete_file(&path)?;
    Ok(())
  }

  fn delete_project_files(&self, project_id: &ProjectId) -> anyhow::Result<()> {
    let project_dir = self.get_project_directory(project_id)?;
    delete_directory(&project_dir)?;
    Ok(())
  }

  fn get_project_thumbnail_path(
    &self,
    project_id: &ProjectId,
    thumbnail_filename: &str,
  ) -> anyhow::Result<String> {
    Ok(
      self
        .get_project_directory(project_id)?
        .join(thumbnail_filename)
        .to_string_lossy()
        .to_string(),
    )
  }

  fn delete_source_files(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<()> {
    let source_dir = self.get_source_directory(project_id, source_id)?;
    delete_directory(&source_dir)?;
    Ok(())
  }

  fn get_source_thumbnail_path(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    thumbnail_filename: &str,
  ) -> anyhow::Result<String> {
    Ok(
      self
        .get_source_directory(project_id, source_id)?
        .join(thumbnail_filename)
        .to_string_lossy()
        .to_string(),
    )
  }

  fn get_source_artifact_path(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    artifact_filename: &str,
  ) -> anyhow::Result<String> {
    Ok(
      self
        .get_source_directory(project_id, source_id)?
        .join(artifact_filename)
        .to_string_lossy()
        .to_string(),
    )
  }

  fn ingest_source_artifact(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    file_absolute_path: &str,
    source_filename: &str,
  ) -> anyhow::Result<String> {
    let filename = self.create_artifact_filename(source_filename)?;
    let from_path = PathBuf::from(file_absolute_path);
    let to_path = self
      .get_source_directory(project_id, source_id)?
      .join(&filename);

    build_file_path(&to_path)?;
    move_file(&from_path, &to_path)?;

    Ok(filename)
  }

  fn get_file_size(&self, absolute_path: &str) -> anyhow::Result<Option<u64>> {
    let path = PathBuf::from(absolute_path);
    match fs::metadata(&path) {
      Ok(metadata) => Ok(Some(metadata.len())),
      Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
      Err(error) => Err(error).context(format!("Read file metadata at {:?}", path)),
    }
  }
}

fn build_path(path: &PathBuf) -> anyhow::Result<()> {
  fs::create_dir_all(path).with_context(|| format!("Failed to create directory at {:?}", path))?;
  Ok(())
}

fn build_file_path(path: &PathBuf) -> anyhow::Result<()> {
  if let Some(parent) = path.parent() {
    build_path(&parent.to_path_buf())
      .with_context(|| format!("Failed to build parent directories for {:?}", path))?;
  }
  Ok(())
}

fn copy_file(from: &PathBuf, to: &PathBuf) -> anyhow::Result<()> {
  fs::copy(from, to).with_context(|| format!("Failed to copy file from {:?} to {:?}", from, to))?;
  Ok(())
}

fn move_file(from: &PathBuf, to: &PathBuf) -> anyhow::Result<()> {
  fs::rename(from, to)
    .with_context(|| format!("Failed to move file from {:?} to {:?}", from, to))?;
  Ok(())
}

fn build_generated_filename(source_filename: &str) -> String {
  let generated_id = Uuid::now_v7();
  match Path::new(source_filename)
    .extension()
    .and_then(|extension| extension.to_str())
  {
    Some(extension) if !extension.is_empty() => format!("{}.{}", generated_id, extension),
    _ => generated_id.to_string(),
  }
}

fn delete_file(path: &PathBuf) -> anyhow::Result<()> {
  match fs::remove_file(path) {
    Ok(_) => Ok(()),
    Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
    Err(e) => Err(e).context(format!("Failed to delete file at {:?}", path)),
  }
}

fn delete_directory(path: &PathBuf) -> anyhow::Result<()> {
  match fs::remove_dir_all(path) {
    Ok(_) => Ok(()),
    Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
    Err(e) => Err(e).context(format!("Failed to delete directory at {:?}", path)),
  }
}
