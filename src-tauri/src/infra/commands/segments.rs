use std::{
  fs,
  path::{Path, PathBuf},
  sync::Arc,
};

use anyhow::Context;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::{
  application::dto::structs::SegmentDto,
  entities::source::SourceId,
  infra::{
    commands::{CommandResult, DtoMapper, Filesystem, Repository, SidecarRuntime},
    sidecars::clients::{
      ffmpeg_sidecar_client::FfmpegSidecarClient, ffprobe_sidecar_client::FfprobeSidecarClient,
    },
  },
};

const RANGE_END_PADDING_SECONDS: f64 = 2.0;
const RANGE_MERGE_EPSILON_SECONDS: f64 = 0.05;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedSegmentRange {
  pub start: f64,
  pub end: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedSegmentsFile {
  pub path: String,
  pub filename: String,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct NormalizedRange {
  start: f64,
  end: f64,
}

struct ExportOutput {
  filename: String,
  absolute_path: PathBuf,
}

#[tauri::command]
pub async fn get_source_segments(
  db: Repository<'_>,
  mapper: DtoMapper<'_>,
  source_id: SourceId,
) -> CommandResult<Vec<SegmentDto>> {
  Ok(
    db.fetch_segments(&source_id)
      .await?
      .iter()
      .map(|segment| mapper.segment_to_dto(segment))
      .collect::<anyhow::Result<Vec<SegmentDto>>>()?,
  )
}

#[tauri::command]
pub async fn export_selected_segments(
  app: AppHandle,
  db: Repository<'_>,
  filesystem: Filesystem<'_>,
  sidecar_runtime: SidecarRuntime<'_>,
  source_id: SourceId,
  segments: Vec<SelectedSegmentRange>,
) -> CommandResult<ExportedSegmentsFile> {
  if segments.is_empty() {
    return Err(anyhow::anyhow!("No segments selected").into());
  }

  let source = db
    .fetch_source(&source_id)
    .await?
    .context("Source not found")?;
  let artifact = db
    .fetch_artifact(&source_id)
    .await?
    .context("Source artifact not found")?;
  let artifact_path =
    filesystem.get_source_artifact_path(&source.project_id, &source_id, &artifact.filename)?;

  let sidecar_runtime = Arc::clone(&*sidecar_runtime);
  let ffmpeg = FfmpegSidecarClient::new(sidecar_runtime.clone());

  let duration = match source.duration {
    Some(duration) if duration.is_finite() && duration >= 0.0 => duration,
    _ => {
      FfprobeSidecarClient::new(sidecar_runtime)
        .probe_duration(&artifact_path)
        .await?
    }
  };

  let normalized_ranges = normalize_ranges(&segments, duration)?;
  let downloads_directory = app
    .path()
    .download_dir()
    .context("Resolve downloads directory")?;
  fs::create_dir_all(&downloads_directory).context("Create downloads directory")?;
  let output = prepare_export_output(
    &downloads_directory,
    source.title.as_deref(),
    &artifact.filename,
  )?;
  let output_path = output.absolute_path.clone();
  let output_filename = output.filename.clone();
  let temp_directory = std::env::temp_dir()
    .join("chechevica")
    .join("segment-exports")
    .join(Uuid::now_v7().to_string());

  fs::create_dir_all(&temp_directory).context("Create segment export temp directory")?;

  let export_result = async {
    let temp_extension = Path::new(&artifact.filename)
      .extension()
      .and_then(|value| value.to_str())
      .filter(|value| !value.is_empty())
      .context("Read artifact extension")?;
    let mut chunk_paths = Vec::with_capacity(normalized_ranges.len());

    for (index, range) in normalized_ranges.iter().enumerate() {
      let chunk_path = temp_directory.join(format!("chunk-{index:03}.{temp_extension}"));
      ffmpeg
        .extract_range_copy(
          &artifact_path,
          &chunk_path.to_string_lossy(),
          range.start,
          range.end - range.start,
        )
        .await
        .with_context(|| format!("Extract segment range {index}"))?;
      chunk_paths.push(chunk_path);
    }

    let concat_list_path = temp_directory.join("concat.txt");
    let concat_list = build_concat_list(&chunk_paths);
    fs::write(&concat_list_path, concat_list).context("Write concat file list")?;

    ffmpeg
      .concat_copy(
        &concat_list_path.to_string_lossy(),
        &output_path.to_string_lossy(),
      )
      .await
      .context("Concatenate selected segment chunks")?;

    let output_size = filesystem
      .get_file_size(&output_path.to_string_lossy())?
      .context("Read exported file size")?;
    if output_size == 0 {
      anyhow::bail!("Exported file is empty");
    }

    Ok::<ExportedSegmentsFile, anyhow::Error>(ExportedSegmentsFile {
      path: output_path.to_string_lossy().to_string(),
      filename: output_filename,
    })
  }
  .await;

  if export_result.is_err() {
    let _ = fs::remove_file(&output_path);
  }

  let _ = fs::remove_dir_all(&temp_directory);
  Ok(export_result?)
}

fn normalize_ranges(
  ranges: &[SelectedSegmentRange],
  duration: f64,
) -> anyhow::Result<Vec<NormalizedRange>> {
  if !duration.is_finite() || duration < 0.0 {
    anyhow::bail!("Artifact duration must be finite");
  }

  let mut normalized_ranges = ranges
    .iter()
    .enumerate()
    .map(|(index, range)| normalize_range(index, range, duration))
    .collect::<anyhow::Result<Vec<_>>>()?;

  normalized_ranges.sort_by(|left, right| left.start.total_cmp(&right.start));

  let mut merged_ranges = Vec::with_capacity(normalized_ranges.len());
  for range in normalized_ranges {
    let Some(previous_range) = merged_ranges.last_mut() else {
      merged_ranges.push(range);
      continue;
    };

    if range.start <= previous_range.end + RANGE_MERGE_EPSILON_SECONDS {
      previous_range.end = previous_range.end.max(range.end);
      continue;
    }

    merged_ranges.push(range);
  }

  Ok(merged_ranges)
}

fn normalize_range(
  index: usize,
  range: &SelectedSegmentRange,
  duration: f64,
) -> anyhow::Result<NormalizedRange> {
  if !range.start.is_finite() || !range.end.is_finite() {
    anyhow::bail!("Segment range {index} must be finite");
  }

  let start = range.start.max(0.0).min(duration);
  let end = (range.end + RANGE_END_PADDING_SECONDS)
    .max(start)
    .min(duration);
  if end <= start {
    anyhow::bail!("Segment range {index} must have positive duration");
  }

  Ok(NormalizedRange { start, end })
}

fn prepare_export_output(
  downloads_directory: &Path,
  source_title: Option<&str>,
  artifact_filename: &str,
) -> anyhow::Result<ExportOutput> {
  let artifact_path = Path::new(artifact_filename);
  let extension = artifact_path
    .extension()
    .and_then(|value| value.to_str())
    .filter(|value| !value.is_empty())
    .context("Read artifact extension")?;
  let base_name = source_title
    .map(sanitize_filename)
    .filter(|value| !value.is_empty())
    .or_else(|| {
      artifact_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_filename)
        .filter(|value| !value.is_empty())
    })
    .unwrap_or_else(|| "selected-segments".to_string());
  let filename = format!(
    "{base_name}-selected-segments-{}.{}",
    Uuid::now_v7(),
    extension
  );

  Ok(ExportOutput {
    absolute_path: downloads_directory.join(&filename),
    filename,
  })
}

fn build_concat_list(chunk_paths: &[PathBuf]) -> String {
  chunk_paths
    .iter()
    .map(|path| format!("file '{}'", escape_concat_path(path)))
    .collect::<Vec<_>>()
    .join("\n")
}

fn escape_concat_path(path: &Path) -> String {
  path
    .to_string_lossy()
    .replace("\\", "/")
    .replace("'", "'\\''")
}

fn sanitize_filename(value: &str) -> String {
  value
    .chars()
    .map(|character| {
      if character.is_control() || "<>:\"/\\|?*".contains(character) {
        '-'
      } else {
        character
      }
    })
    .collect::<String>()
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
    .trim_matches([' ', '.'])
    .to_string()
}
