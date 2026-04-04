use std::sync::Arc;
use std::{fs, path::PathBuf};

use anyhow::{Context, anyhow};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::infra::sidecars::{
  sidecar_runtime::SidecarRuntime,
  structs::{SidecarId, SidecarKind, SidecarOptions, SidecarTransport},
};

pub struct FfmpegSidecarClient {
  runtime: Arc<SidecarRuntime>,
  active_sidecar: Mutex<Option<SidecarId>>,
}

pub struct ProducedFile {
  pub filename: String,
  pub absolute_path: String,
}

impl FfmpegSidecarClient {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      runtime,
      active_sidecar: Mutex::new(None),
    }
  }

  pub async fn extract_middle_frame(
    &self,
    media_path: &str,
    destination_directory: &str,
    duration: f64,
  ) -> anyhow::Result<ProducedFile> {
    let media_path = media_path.trim();
    if media_path.is_empty() {
      anyhow::bail!("Source origin path is empty");
    }

    let destination_directory = destination_directory.trim();
    if destination_directory.is_empty() {
      anyhow::bail!("Thumbnail destination directory is empty");
    }

    if !duration.is_finite() {
      return Err(anyhow!("Ingest duration must be finite"));
    }

    let seek_seconds = (duration.max(0.0) / 2.0).max(0.0);
    let output = prepare_thumbnail_output(destination_directory)?;

    let mut transport = self
      .spawn_ffmpeg(vec![
        "-v".to_string(),
        "error".to_string(),
        "-ss".to_string(),
        seek_seconds.to_string(),
        "-i".to_string(),
        media_path.to_string(),
        "-vframes".to_string(),
        "1".to_string(),
        "-q:v".to_string(),
        "1".to_string(),
        "-vf".to_string(),
        "scale=min(iw\\,1280):-2:flags=lanczos".to_string(),
        "-y".to_string(),
        output.absolute_path.clone(),
      ])
      .await?;

    let sidecar_id = transport.id;
    let (_stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;

    if !stderr.trim().is_empty() {
      anyhow::bail!(stderr.trim().to_string());
    }

    Ok(output)
  }

  pub async fn extract_range_copy(
    &self,
    media_path: &str,
    output_path: &str,
    start_seconds: f64,
    duration: f64,
  ) -> anyhow::Result<()> {
    let media_path = media_path.trim();
    if media_path.is_empty() {
      anyhow::bail!("Source origin path is empty");
    }

    let output_path = output_path.trim();
    if output_path.is_empty() {
      anyhow::bail!("Ffmpeg output path is empty");
    }

    if !start_seconds.is_finite() || start_seconds < 0.0 {
      return Err(anyhow!(
        "Ffmpeg seek start must be a finite positive number"
      ));
    }

    if !duration.is_finite() || duration <= 0.0 {
      return Err(anyhow!(
        "Ffmpeg range duration must be a finite positive number"
      ));
    }

    ensure_output_directory(output_path)?;

    let mut transport = self
      .spawn_ffmpeg(vec![
        "-v".to_string(),
        "error".to_string(),
        "-ss".to_string(),
        start_seconds.to_string(),
        "-i".to_string(),
        media_path.to_string(),
        "-t".to_string(),
        duration.to_string(),
        "-map".to_string(),
        "0".to_string(),
        "-c".to_string(),
        "copy".to_string(),
        "-avoid_negative_ts".to_string(),
        "make_zero".to_string(),
        "-y".to_string(),
        output_path.to_string(),
      ])
      .await?;

    let sidecar_id = transport.id;
    let (_stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;

    if !stderr.trim().is_empty() {
      anyhow::bail!(stderr.trim().to_string());
    }

    Ok(())
  }

  pub async fn concat_copy(&self, concat_list_path: &str, output_path: &str) -> anyhow::Result<()> {
    let concat_list_path = concat_list_path.trim();
    if concat_list_path.is_empty() {
      anyhow::bail!("Ffmpeg concat list path is empty");
    }

    let output_path = output_path.trim();
    if output_path.is_empty() {
      anyhow::bail!("Ffmpeg output path is empty");
    }

    ensure_output_directory(output_path)?;

    let mut transport = self
      .spawn_ffmpeg(vec![
        "-v".to_string(),
        "error".to_string(),
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        concat_list_path.to_string(),
        "-map".to_string(),
        "0".to_string(),
        "-c".to_string(),
        "copy".to_string(),
        "-y".to_string(),
        output_path.to_string(),
      ])
      .await?;

    let sidecar_id = transport.id;
    let (_stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;

    if !stderr.trim().is_empty() {
      anyhow::bail!(stderr.trim().to_string());
    }

    Ok(())
  }

  pub async fn shutdown(&self) -> anyhow::Result<()> {
    let sidecar_id = {
      let mut guard = self.active_sidecar.lock().await;
      guard.take()
    };

    if let Some(sidecar_id) = sidecar_id {
      self
        .runtime
        .shutdown(sidecar_id)
        .context("Shutdown Ffmpeg sidecar")?;
    }

    Ok(())
  }

  async fn spawn_ffmpeg(&self, args: Vec<String>) -> anyhow::Result<SidecarTransport> {
    let transport = self
      .runtime
      .run(SidecarKind::Ffmpeg, SidecarOptions { args, cwd: None })
      .await
      .context("Spawn Ffmpeg sidecar")?;

    let mut guard = self.active_sidecar.lock().await;
    *guard = Some(transport.id);

    Ok(transport)
  }

  async fn clear_active_sidecar(&self, sidecar_id: SidecarId) {
    let mut guard = self.active_sidecar.lock().await;
    if guard.as_ref().is_some_and(|value| *value == sidecar_id) {
      *guard = None;
    }
  }

  async fn finalize_sidecar(&self, sidecar_id: SidecarId) {
    let _ = self.runtime.complete(sidecar_id);
    self.clear_active_sidecar(sidecar_id).await;
  }
}

async fn collect_all_output(transport: &mut SidecarTransport) -> (String, String) {
  let mut stdout = String::new();
  let mut stderr = String::new();
  let mut stdout_open = true;
  let mut stderr_open = true;

  while stdout_open || stderr_open {
    tokio::select! {
      chunk = transport.stdout.recv(), if stdout_open => {
        match chunk {
          Some(bytes) => stdout.push_str(&String::from_utf8_lossy(&bytes)),
          None => stdout_open = false,
        }
      }
      chunk = transport.stderr.recv(), if stderr_open => {
        match chunk {
          Some(bytes) => stderr.push_str(&String::from_utf8_lossy(&bytes)),
          None => stderr_open = false,
        }
      }
    }
  }

  (stdout, stderr)
}

fn prepare_thumbnail_output(destination_directory: &str) -> anyhow::Result<ProducedFile> {
  let directory = PathBuf::from(destination_directory);
  fs::create_dir_all(&directory).context("Create Ffmpeg destination directory")?;

  let filename = format!("{}.jpg", Uuid::now_v7());
  let absolute_path = directory.join(&filename).to_string_lossy().to_string();

  Ok(ProducedFile {
    filename,
    absolute_path,
  })
}

fn ensure_output_directory(output_path: &str) -> anyhow::Result<()> {
  let output_path = PathBuf::from(output_path);
  let parent = output_path
    .parent()
    .context("Read Ffmpeg output parent directory")?;
  fs::create_dir_all(parent).context("Create Ffmpeg output directory")?;
  Ok(())
}
