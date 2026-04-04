use std::{path::Path, sync::Arc, time::UNIX_EPOCH};

use anyhow::Context;
use async_trait::async_trait;
use serde::Deserialize;
use tokio::fs;

use crate::application::interfaces::jobs::{self, IngestMetadata, JobParam, ProducedFile};
use crate::infra::sidecars::{
  clients::{
    ffmpeg_sidecar_client::{FfmpegSidecarClient, ProducedFile as FfmpegProducedFile},
    ffprobe_sidecar_client::FfprobeSidecarClient,
  },
  sidecar_runtime::SidecarRuntime,
};

#[derive(Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
struct IngestParams {}

pub struct IngestionEngine {
  ffmpeg: FfmpegSidecarClient,
  ffprobe: FfprobeSidecarClient,
}

impl IngestionEngine {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      ffmpeg: FfmpegSidecarClient::new(runtime.clone()),
      ffprobe: FfprobeSidecarClient::new(runtime.clone()),
    }
  }

  fn parse_params_json(&self, params_json: &str) -> anyhow::Result<IngestParams> {
    serde_json::from_str(params_json).context("Parse ingest params JSON")
  }

  fn map_produced_file(&self, file: FfmpegProducedFile) -> ProducedFile {
    ProducedFile {
      filename: file.filename,
      absolute_path: file.absolute_path,
    }
  }
}

#[async_trait]
impl jobs::JobEngine for IngestionEngine {
  fn params(&self) -> Vec<JobParam> {
    vec![]
  }

  fn validate_params(&self, params_json: &str) -> anyhow::Result<()> {
    self.parse_params_json(params_json)?;
    Ok(())
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.ffprobe.shutdown().await?;
    self.ffmpeg.shutdown().await?;
    Ok(())
  }
}

#[async_trait]
impl jobs::IngestionEngine for IngestionEngine {
  async fn fetch_metadata(&self, from_path: &str) -> anyhow::Result<IngestMetadata> {
    if from_path.trim().is_empty() {
      anyhow::bail!("Source origin path is empty");
    }

    let title = Path::new(from_path)
      .file_name()
      .and_then(|name| name.to_str())
      .map(|s| s.to_string())
      .unwrap_or_else(|| from_path.to_string());

    let metadata = fs::metadata(from_path)
      .await
      .context("Read source origin metadata")?;
    let created_at = metadata
      .created()
      .ok()
      .map(|value| {
        value
          .duration_since(UNIX_EPOCH)
          .context("Convert source origin creation time")
          .and_then(|duration| {
            i64::try_from(duration.as_millis())
              .context("Convert source origin creation time to i64")
          })
      })
      .transpose()?;
    let duration = self.ffprobe.probe_duration(from_path).await?;

    Ok(IngestMetadata {
      title,
      created_at,
      duration,
    })
  }

  async fn fetch_thumbnail(
    &self,
    from_path: &str,
    destination_directory: &str,
    duration: f64,
  ) -> anyhow::Result<ProducedFile> {
    self
      .ffmpeg
      .extract_middle_frame(from_path, destination_directory, duration)
      .await
      .map(|file| self.map_produced_file(file))
  }

  async fn ingest(&self, from_path: &str, to_path: &str, params_json: &str) -> anyhow::Result<()> {
    self.parse_params_json(params_json)?;

    if from_path.trim().is_empty() {
      anyhow::bail!("Missing required ingest param 'from_path'");
    }

    if let Some(parent) = Path::new(to_path).parent() {
      fs::create_dir_all(parent).await?;
    }

    fs::copy(from_path, to_path).await?;

    Ok(())
  }
}
