use std::sync::Arc;

use anyhow::{Context, anyhow};
use serde::Deserialize;
use tokio::sync::Mutex;

use crate::infra::sidecars::{
  sidecar_runtime::SidecarRuntime,
  structs::{SidecarId, SidecarKind, SidecarOptions, SidecarTransport},
};

pub struct FfprobeSidecarClient {
  runtime: Arc<SidecarRuntime>,
  active_sidecar: Mutex<Option<SidecarId>>,
}

impl FfprobeSidecarClient {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      runtime,
      active_sidecar: Mutex::new(None),
    }
  }

  pub async fn probe_duration(&self, media_path: &str) -> anyhow::Result<f64> {
    let media_path = media_path.trim();
    if media_path.is_empty() {
      anyhow::bail!("Source origin path is empty");
    }

    let mut transport = self
      .spawn_ffprobe(vec![
        "-v".to_string(),
        "error".to_string(),
        "-show_entries".to_string(),
        "format=duration".to_string(),
        "-of".to_string(),
        "json".to_string(),
        media_path.to_string(),
      ])
      .await?;

    let sidecar_id = transport.id;
    let (stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;

    if !stderr.trim().is_empty() {
      anyhow::bail!(stderr.trim().to_string());
    }

    let payload: FfprobeResponse =
      serde_json::from_str(stdout.trim()).context("Parse Ffprobe output JSON")?;
    let duration = payload
      .format
      .and_then(|format| format.duration)
      .context("Read Ffprobe duration")?;
    let duration = duration
      .trim()
      .parse::<f64>()
      .context("Parse Ffprobe duration")?;

    if !duration.is_finite() {
      return Err(anyhow!("Ffprobe duration must be finite"));
    }

    Ok(duration.max(0.0))
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
        .context("Shutdown Ffprobe sidecar")?;
    }

    Ok(())
  }

  async fn spawn_ffprobe(&self, args: Vec<String>) -> anyhow::Result<SidecarTransport> {
    let transport = self
      .runtime
      .run(SidecarKind::Ffprobe, SidecarOptions { args, cwd: None })
      .await
      .context("Spawn Ffprobe sidecar")?;

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

#[derive(Deserialize)]
struct FfprobeResponse {
  format: Option<FfprobeFormat>,
}

#[derive(Deserialize)]
struct FfprobeFormat {
  duration: Option<String>,
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
