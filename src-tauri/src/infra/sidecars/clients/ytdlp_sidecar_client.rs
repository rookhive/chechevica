use std::{
  collections::HashSet,
  fs,
  path::{Path, PathBuf},
  sync::Arc,
};

use anyhow::Context;
use serde::Deserialize;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
  entities::source::SourceMediaType,
  infra::sidecars::{
    sidecar_runtime::SidecarRuntime,
    structs::{SidecarId, SidecarKind, SidecarOptions, SidecarTransport},
  },
};

pub struct YtdlpSidecarClient {
  runtime: Arc<SidecarRuntime>,
  active_sidecar: Mutex<Option<SidecarId>>,
}

pub struct ProducedFile {
  pub filename: String,
  pub absolute_path: String,
}

pub struct RemoteSourceMetadataItem {
  pub title: String,
  pub url: String,
}

impl YtdlpSidecarClient {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      runtime,
      active_sidecar: Mutex::new(None),
    }
  }

  pub async fn fetch_metadata(&self, url: &str) -> anyhow::Result<YtdlpMetadata> {
    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty");
    }

    let mut args = vec![
      "--no-warnings".to_string(),
      "--no-playlist".to_string(),
      "--dump-single-json".to_string(),
    ];
    args.extend(rate_limit_args());
    args.push(url.to_string());

    let mut transport = self.spawn_yt_dlp(args).await?;

    let sidecar_id = transport.id;
    let (stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;
    ensure_no_error_output(&stderr)?;

    serde_json::from_str(stdout.trim()).context("Parse YtDlp metadata JSON")
  }

  pub async fn fetch_remote_source_metadata(
    &self,
    url: &str,
  ) -> anyhow::Result<Vec<RemoteSourceMetadataItem>> {
    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty");
    }

    let mut args = vec![
      "--flat-playlist".to_string(),
      "--encoding".to_string(),
      "utf-8".to_string(),
      "--match-filter".to_string(),
      "!is_member_only".to_string(),
      "--no-warnings".to_string(),
      "--dump-single-json".to_string(),
    ];
    args.extend(rate_limit_args());
    args.push(url.to_string());

    let mut transport = self.spawn_yt_dlp(args).await?;

    let sidecar_id = transport.id;
    let (stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;
    ensure_no_error_output(&stderr)?;

    let metadata: YtdlpMetadata =
      serde_json::from_str(stdout.trim()).context("Parse YtDlp remote metadata JSON")?;

    metadata.into_remote_items()
  }

  pub async fn fetch_thumbnail(
    &self,
    url: &str,
    destination_directory: &str,
  ) -> anyhow::Result<ProducedFile> {
    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty");
    }

    let output_stem = prepare_output_stem(destination_directory)?;

    let mut args = vec![
      "--no-warnings".to_string(),
      "--no-playlist".to_string(),
      "--skip-download".to_string(),
      "--write-thumbnail".to_string(),
      "--convert-thumbnails".to_string(),
      "jpg".to_string(),
      "-o".to_string(),
      build_output_template(&output_stem),
    ];
    args.extend(rate_limit_args());
    args.push(url.to_string());

    let mut transport = self.spawn_yt_dlp(args).await?;

    let sidecar_id = transport.id;
    let (_stdout, stderr) = collect_all_output(&mut transport).await;
    self.finalize_sidecar(sidecar_id).await;
    ensure_no_error_output(&stderr)?;

    resolve_downloaded_file(&output_stem)
  }

  pub async fn download_media<F>(
    &self,
    url: &str,
    media_type: &SourceMediaType,
    destination_directory: &str,
    quality: &str,
    mut on_progress: F,
  ) -> anyhow::Result<ProducedFile>
  where
    F: FnMut(u8),
  {
    let url = url.trim();
    if url.is_empty() {
      anyhow::bail!("Source origin URL is empty");
    }

    let output_stem = prepare_output_stem(destination_directory)?;

    let mut transport = self
      .spawn_yt_dlp(build_download_args(url, &output_stem, media_type, quality))
      .await?;

    let sidecar_id = transport.id;
    let mut stdout_open = true;
    let mut stderr_open = true;
    let mut stdout_buffer = String::new();
    let mut stderr_buffer = String::new();
    let mut stderr_text = String::new();
    let mut last_percent: u8 = 0;
    let mut downloaded_path: Option<PathBuf> = None;

    while stdout_open || stderr_open {
      tokio::select! {
        chunk = transport.stdout.recv(), if stdout_open => {
          match chunk {
            Some(bytes) => {
              for line in append_lines(&mut stdout_buffer, &bytes) {
                if let Some(percent) = parse_progress_percent(&line) {
                  if percent > last_percent {
                    last_percent = percent;
                    on_progress(percent);
                  }

                  continue;
                }

                if let Some(path) = parse_output_filepath(&line, &output_stem) {
                  downloaded_path = Some(path);
                }
              }
            }
            None => {
              stdout_open = false;
            }
          }
        }
        chunk = transport.stderr.recv(), if stderr_open => {
          match chunk {
            Some(bytes) => {
              let text = String::from_utf8_lossy(&bytes).to_string();
              stderr_text.push_str(&text);

              for line in append_lines(&mut stderr_buffer, &bytes) {
                if let Some(percent) = parse_progress_percent(&line) && percent > last_percent {
                  last_percent = percent;
                  on_progress(percent);
                }
              }
            }
            None => {
              stderr_open = false;
            }
          }
        }
      }
    }

    self.finalize_sidecar(sidecar_id).await;
    ensure_no_error_output(&stderr_text)?;

    if last_percent < 100 {
      on_progress(100);
    }

    if let Some(path) = downloaded_path {
      return build_produced_file(path);
    }

    resolve_downloaded_file(&output_stem)
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
        .context("Shutdown YtDlp sidecar")?;
    }

    Ok(())
  }

  async fn spawn_yt_dlp(&self, args: Vec<String>) -> anyhow::Result<SidecarTransport> {
    let transport = self
      .runtime
      .run(SidecarKind::YtDlp, SidecarOptions { args, cwd: None })
      .await
      .context("Spawn YtDlp sidecar")?;

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
pub struct YtdlpMetadata {
  pub id: Option<String>,
  pub title: Option<String>,
  pub url: Option<String>,
  pub webpage_url: Option<String>,
  pub original_url: Option<String>,
  pub duration: Option<f64>,
  pub upload_date: Option<String>,
  pub timestamp: Option<i64>,
  #[serde(default)]
  pub entries: Vec<YtdlpMetadata>,
}

impl YtdlpMetadata {
  fn into_remote_items(self) -> anyhow::Result<Vec<RemoteSourceMetadataItem>> {
    let mut seen = HashSet::new();
    let items = if self.entries.is_empty() {
      vec![self]
    } else {
      self.entries
    };

    let mut normalized = Vec::new();
    for item in items {
      let Some(url) = item.resolve_remote_url() else {
        continue;
      };

      if !seen.insert(url.clone()) {
        continue;
      }

      let title = item.resolve_title(&url);
      normalized.push(RemoteSourceMetadataItem { title, url });
    }

    if normalized.is_empty() {
      anyhow::bail!("YtDlp metadata does not contain any remote resources");
    }

    Ok(normalized)
  }

  fn resolve_title(&self, fallback: &str) -> String {
    self
      .title
      .as_deref()
      .map(str::trim)
      .filter(|value| !value.is_empty())
      .map(str::to_owned)
      .unwrap_or_else(|| fallback.to_string())
  }

  fn resolve_remote_url(&self) -> Option<String> {
    self
      .webpage_url
      .as_deref()
      .and_then(normalize_remote_url)
      .or_else(|| self.original_url.as_deref().and_then(normalize_remote_url))
      .or_else(|| self.url.as_deref().and_then(normalize_remote_url))
      .or_else(|| self.id.as_deref().and_then(build_youtube_watch_url))
  }
}

fn normalize_remote_url(value: &str) -> Option<String> {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return None;
  }

  if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
    return Some(trimmed.to_string());
  }

  build_youtube_watch_url(trimmed)
}

fn build_youtube_watch_url(video_id: &str) -> Option<String> {
  let trimmed = video_id.trim();
  if trimmed.is_empty() {
    return None;
  }

  Some(format!("https://www.youtube.com/watch?v={trimmed}"))
}

fn ensure_no_error_output(stderr: &str) -> anyhow::Result<()> {
  if stderr.contains("ERROR:") {
    anyhow::bail!(stderr.trim().to_string());
  }

  Ok(())
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
          Some(bytes) => {
            stdout.push_str(&String::from_utf8_lossy(&bytes));
          }
          None => {
            stdout_open = false;
          }
        }
      }
      chunk = transport.stderr.recv(), if stderr_open => {
        match chunk {
          Some(bytes) => {
            stderr.push_str(&String::from_utf8_lossy(&bytes));
          }
          None => {
            stderr_open = false;
          }
        }
      }
    }
  }

  (stdout, stderr)
}

fn rate_limit_args() -> Vec<String> {
  vec![
    "--concurrent-fragments".to_string(),
    "1".to_string(),
    "--sleep-requests".to_string(),
    "3".to_string(),
    "--sleep-interval".to_string(),
    "8".to_string(),
    "--max-sleep-interval".to_string(),
    "24".to_string(),
    "--retry-sleep".to_string(),
    "exp=1:20".to_string(),
    "--limit-rate".to_string(),
    "3M".to_string(),
  ]
}

fn build_download_args(
  url: &str,
  output_stem: &Path,
  media_type: &SourceMediaType,
  quality: &str,
) -> Vec<String> {
  let mut args = rate_limit_args();

  args.extend([
    "--no-warnings".to_string(),
    "--no-playlist".to_string(),
    "--newline".to_string(),
    "--force-overwrites".to_string(),
    "--progress".to_string(),
    "--progress-template".to_string(),
    "%(progress._percent)s".to_string(),
    "--progress-delta".to_string(),
    "1".to_string(),
    "--print".to_string(),
    "after_move:filepath".to_string(),
    "--no-part".to_string(),
    "-o".to_string(),
    build_output_template(output_stem),
  ]);

  if matches!(media_type, SourceMediaType::Audio) {
    args.extend([
      "-f".to_string(),
      "bestaudio/best".to_string(),
      "-x".to_string(),
      "--audio-format".to_string(),
      "mp3".to_string(),
    ]);

    args.extend(["-S".to_string(), "abr".to_string()]);
  } else {
    args.extend(["-f".to_string(), build_video_format_selector(quality)]);
  }

  args.push(url.to_string());
  args
}

fn build_video_format_selector(quality: &str) -> String {
  parse_target_height(quality)
    .map(|target_height| {
      format!(
        "bestvideo[height<={th}]+bestaudio/best[height<={th}]/best",
        th = target_height
      )
    })
    .unwrap_or_else(|| "bestvideo+bestaudio/best".to_string())
}

fn parse_target_height(quality: &str) -> Option<u32> {
  quality.strip_suffix('p')?.parse().ok()
}

fn prepare_output_stem(destination_directory: &str) -> anyhow::Result<PathBuf> {
  let destination_directory = destination_directory.trim();
  if destination_directory.is_empty() {
    anyhow::bail!("Destination directory is empty");
  }

  let directory = PathBuf::from(destination_directory);
  fs::create_dir_all(&directory).context("Create YtDlp destination directory")?;

  Ok(directory.join(Uuid::now_v7().to_string()))
}

fn build_output_template(output_stem: &Path) -> String {
  format!("{}.%(ext)s", output_stem.to_string_lossy())
}

fn parse_output_filepath(line: &str, output_stem: &Path) -> Option<PathBuf> {
  let path = PathBuf::from(line.trim());
  if !path.is_absolute() || !path.is_file() {
    return None;
  }

  if path.parent() != output_stem.parent() {
    return None;
  }

  if is_yt_dlp_fragment(&path) {
    return None;
  }

  let stem = path.file_stem()?.to_str()?;
  let expected_stem = output_stem.file_name()?.to_str()?;
  if stem != expected_stem {
    return None;
  }

  Some(path)
}

fn is_yt_dlp_fragment(path: &Path) -> bool {
  let ext = match path.extension().and_then(|value| value.to_str()) {
    Some(value) => value,
    None => return false,
  };

  if !ext.starts_with('f') {
    return false;
  }

  ext[1..].parse::<u32>().is_ok()
}

fn build_produced_file(resolved_path: PathBuf) -> anyhow::Result<ProducedFile> {
  let filename = resolved_path
    .file_name()
    .and_then(|value| value.to_str())
    .map(str::to_owned)
    .context("Read downloaded file name")?;

  Ok(ProducedFile {
    filename,
    absolute_path: resolved_path.to_string_lossy().to_string(),
  })
}

fn resolve_downloaded_file(output_stem: &Path) -> anyhow::Result<ProducedFile> {
  let parent = output_stem
    .parent()
    .context("Read downloaded file parent")?;
  let stem = output_stem
    .file_name()
    .and_then(|value| value.to_str())
    .context("Read downloaded file stem")?;

  let mut matches = Vec::new();
  for entry in fs::read_dir(parent).context("Read downloaded file directory")? {
    let entry = entry.context("Read downloaded file entry")?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }

    if path
      .file_stem()
      .and_then(|value| value.to_str())
      .is_some_and(|value| value == stem)
    {
      matches.push(path);
    }
  }

  let resolved_path = matches
    .into_iter()
    .max_by_key(|path| {
      path
        .metadata()
        .and_then(|metadata| metadata.modified())
        .ok()
    })
    .context("Resolve downloaded file path")?;

  build_produced_file(resolved_path)
}

fn append_lines(buffer: &mut String, chunk: &[u8]) -> Vec<String> {
  buffer.push_str(&String::from_utf8_lossy(chunk));

  let mut lines = Vec::new();
  while let Some(index) = buffer.find('\n') {
    let line = buffer[..index].trim_end_matches('\r').to_string();
    lines.push(line);
    buffer.drain(..=index);
  }

  lines
}

fn parse_progress_percent(line: &str) -> Option<u8> {
  let trimmed = line.trim();
  if let Ok(parsed) = trimmed.parse::<f64>() {
    let bounded = parsed.clamp(0.0, 100.0).round() as u8;
    return Some(bounded);
  }

  if !line.contains("[download]") {
    return None;
  }

  let percent_index = line.find('%')?;
  let prefix = &line[..percent_index];
  let start_index = prefix
    .rfind(|ch: char| !ch.is_ascii_digit() && ch != '.')
    .map(|value| value + 1)
    .unwrap_or(0);
  let raw = prefix[start_index..].trim();
  if raw.is_empty() {
    return None;
  }

  let parsed = raw.parse::<f64>().ok()?;
  let bounded = parsed.clamp(0.0, 100.0).round() as u8;
  Some(bounded)
}
