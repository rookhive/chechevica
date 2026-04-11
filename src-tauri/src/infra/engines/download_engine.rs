use std::sync::Arc;

use anyhow::{Context, anyhow};
use async_trait::async_trait;
use chrono::{NaiveDate, TimeZone, Utc};
use serde::Deserialize;
use tokio::sync::Mutex;

use crate::{
  application::interfaces::jobs::{
    self, DownloadMetadata, JobEvent, JobEventSender, JobParam, JobParamKind, ProducedFile,
  },
  entities::source::SourceMediaType,
  infra::sidecars::{
    clients::ytdlp_sidecar_client::{
      ProducedFile as YtdlpProducedFile, YtdlpMetadata, YtdlpSidecarClient,
    },
    sidecar_runtime::SidecarRuntime,
  },
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
struct DownloadParams {
  quality: String,
}

pub struct DownloadEngine {
  ytdlp_client: YtdlpSidecarClient,
  run_lock: Mutex<()>,
}

impl DownloadEngine {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      ytdlp_client: YtdlpSidecarClient::new(runtime),
      run_lock: Mutex::new(()),
    }
  }

  fn parse_params_json(&self, params_json: &str) -> anyhow::Result<DownloadParams> {
    serde_json::from_str(params_json).context("Parse download params JSON")
  }

  fn parse_uploaded_at(&self, metadata: &YtdlpMetadata) -> anyhow::Result<Option<i64>> {
    if let Some(timestamp_seconds) = metadata.timestamp {
      return Ok(Some(
        timestamp_seconds
          .checked_mul(1000)
          .context("Convert YtDlp upload timestamp to milliseconds")?,
      ));
    }

    let Some(upload_date) = metadata.upload_date.as_deref() else {
      return Ok(None);
    };

    let parsed_date =
      NaiveDate::parse_from_str(upload_date, "%Y%m%d").context("Parse YtDlp upload date")?;
    let uploaded_at = Utc
      .from_utc_datetime(
        &parsed_date
          .and_hms_opt(0, 0, 0)
          .context("Construct YtDlp upload date time")?,
      )
      .timestamp_millis();

    Ok(Some(uploaded_at))
  }

  fn map_produced_file(&self, file: YtdlpProducedFile) -> ProducedFile {
    ProducedFile {
      filename: file.filename,
      absolute_path: file.absolute_path,
    }
  }
}

#[async_trait]
impl jobs::JobEngine for DownloadEngine {
  fn params(&self) -> Vec<JobParam> {
    vec![JobParam {
      key: "quality".to_string(),
      label: "Quality".to_string(),
      kind: JobParamKind::Select {
        options: vec![
          "144p".into(),
          "240p".into(),
          "360p".into(),
          "480p".into(),
          "720p".into(),
          "1080p".into(),
        ],
      },
      default: Some("360p".into()),
    }]
  }

  fn validate_params(&self, params_json: &str) -> anyhow::Result<()> {
    self.parse_params_json(params_json)?;
    Ok(())
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    self.ytdlp_client.shutdown().await
  }
}

#[async_trait]
impl jobs::DownloadEngine for DownloadEngine {
  async fn fetch_metadata(
    &self,
    url: &str,
    _params_json: &str,
  ) -> anyhow::Result<DownloadMetadata> {
    let _run_lock = self.run_lock.lock().await;

    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty")
    }

    let metadata = self.ytdlp_client.fetch_metadata(url).await?;
    let uploaded_at = self.parse_uploaded_at(&metadata)?;
    let title = metadata
      .title
      .as_deref()
      .map(str::trim)
      .map(str::to_owned)
      .filter(|value| !value.is_empty())
      .ok_or_else(|| anyhow!("YtDlp metadata does not contain title"))?;
    let duration = metadata.duration.unwrap_or_default();

    Ok(DownloadMetadata {
      title,
      duration,
      uploaded_at,
    })
  }

  async fn fetch_thumbnail(
    &self,
    url: &str,
    _params_json: &str,
    destination_directory: &str,
  ) -> anyhow::Result<ProducedFile> {
    let _run_lock = self.run_lock.lock().await;

    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty")
    }

    self
      .ytdlp_client
      .fetch_thumbnail(url, destination_directory)
      .await
      .map(|file| self.map_produced_file(file))
  }

  async fn download_media(
    &self,
    url: &str,
    media_type: &SourceMediaType,
    destination_directory: &str,
    params_json: &str,
    events: JobEventSender,
  ) -> anyhow::Result<ProducedFile> {
    let _run_lock = self.run_lock.lock().await;

    let params = self.parse_params_json(params_json)?;

    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty")
    }

    self
      .ytdlp_client
      .download_media(
        url,
        media_type,
        destination_directory,
        &params.quality,
        |percent| {
          let _ = events.send(JobEvent::Progress { percent });
        },
      )
      .await
      .map(|file| self.map_produced_file(file))
  }
}
