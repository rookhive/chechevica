use std::sync::Arc;

use anyhow::{Context, anyhow};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, MutexGuard};

use crate::{
  entities::segment::NewSegment,
  infra::sidecars::{
    sidecar_runtime::SidecarRuntime,
    structs::{SidecarKind, SidecarOptions, SidecarTransport},
  },
};

const MAX_SEGMENT_MERGE_GAP_SECONDS: f64 = 0.85;
const MAX_MERGED_SEGMENT_DURATION_SECONDS: f64 = 18.0;
const MIN_COMPLETE_SEGMENT_WORDS: usize = 6;
const MIN_COMPLETE_SEGMENT_CHARS: usize = 28;
const MAX_MERGED_SEGMENT_WORDS: usize = 48;
const MAX_MERGED_SEGMENT_CHARS: usize = 400;
const MAX_NUMERIC_ARTIFACT_DIGITS: usize = 2;

pub struct FasterWhisperSidecarClient {
  runtime: Arc<SidecarRuntime>,
  transport: Mutex<Option<SidecarTransport>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct TranscriptionRequest {
  pub path: String,
  pub device: String,
  pub model: String,
  pub language: String,
  pub compute_type: String,
  pub batch_size: u32,
  pub beam_size: u32,
  pub duration: Option<f64>,
}

impl FasterWhisperSidecarClient {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      runtime,
      transport: Mutex::new(None),
    }
  }

  pub async fn transcribe(
    &self,
    request: &TranscriptionRequest,
    mut on_ready: impl FnMut(),
    mut on_progress: impl FnMut(u8),
  ) -> anyhow::Result<Vec<NewSegment>> {
    let result = self
      .transcribe_inner(request, &mut on_ready, &mut on_progress)
      .await;

    if result.is_err() {
      self.reset_transport().await;
    }

    result
  }

  pub async fn shutdown(&self) -> anyhow::Result<()> {
    let sidecar_id = {
      let mut guard = self.transport.lock().await;
      guard.take().map(|transport| transport.id)
    };

    if let Some(sidecar_id) = sidecar_id {
      self
        .runtime
        .shutdown(sidecar_id)
        .context("Shutdown ASR sidecar")?;
    }

    Ok(())
  }

  async fn transcribe_inner(
    &self,
    request: &TranscriptionRequest,
    on_ready: &mut impl FnMut(),
    on_progress: &mut impl FnMut(u8),
  ) -> anyhow::Result<Vec<NewSegment>> {
    let mut transport_guard = self.ensure_transport().await?;
    let transport = transport_guard
      .as_mut()
      .context("ASR sidecar transport unavailable")?;

    let mut payload = serde_json::to_vec(request).context("Serialize ASR payload")?;
    payload.push(b'\n');

    transport
      .stdin
      .send(payload)
      .await
      .context("Send ASR request")?;

    let mut segments = Vec::new();
    let mut stdout_open = true;
    let mut stderr_open = true;
    let mut stdout_buffer = String::new();
    let mut stderr_text = String::new();
    let mut last_progress: u8 = 0;
    let mut model_ready = false;

    let mut mark_ready = || {
      if !model_ready {
        model_ready = true;
        on_ready();
      }
    };

    while stdout_open || stderr_open {
      tokio::select! {
        chunk = transport.stdout.recv(), if stdout_open => {
          match chunk {
            Some(bytes) => {
              for line in append_lines(&mut stdout_buffer, &bytes) {
                if line.trim().is_empty() {
                  continue;
                }

                match serde_json::from_str::<AsrEvent>(&line)
                  .with_context(|| format!("Parse ASR event line: {line}"))?
                {
                  AsrEvent::Segment { start, end, progress, text } => {
                    mark_ready();
                    let text = text.trim().to_string();
                    if text.is_empty() {
                      continue;
                    }

                    if end < start {
                      return Err(anyhow!("ASR segment has invalid range: end < start"));
                    }

                    let progress = progress.min(100);
                    if progress > last_progress {
                      last_progress = progress;
                      on_progress(progress);
                    }

                    segments.push(NewSegment { start, end, text });
                  }
                  AsrEvent::TranscribingCompleted => {
                    mark_ready();
                    if last_progress < 100 {
                      on_progress(100);
                    }

                    return Ok(normalize_segments(segments));
                  }
                  AsrEvent::Error { message } => {
                    return Err(anyhow!(message));
                  }
                  AsrEvent::LoadingModelStarted => {}
                  AsrEvent::LoadingModelCompleted => {}
                  AsrEvent::TranscribingStarted => {
                    mark_ready();
                  }
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
              stderr_text.push_str(&String::from_utf8_lossy(&bytes));
            }
            None => {
              stderr_open = false;
            }
          }
        }
      }
    }

    let stderr_text = stderr_text.trim();
    if stderr_text.is_empty() {
      Err(anyhow!(
        "ASR sidecar closed before completing transcription"
      ))
    } else {
      Err(anyhow!(
        "ASR sidecar closed before completing transcription: {stderr_text}"
      ))
    }
  }

  async fn ensure_transport(&self) -> anyhow::Result<MutexGuard<'_, Option<SidecarTransport>>> {
    let mut guard = self.transport.lock().await;

    if guard.is_none() {
      *guard = Some(
        self
          .runtime
          .run(
            SidecarKind::FasterWhisper,
            SidecarOptions {
              args: vec!["--stdin".to_string()],
              cwd: None,
            },
          )
          .await
          .context("Spawn FasterWhisper sidecar")?,
      );
    }

    Ok(guard)
  }

  async fn reset_transport(&self) {
    let sidecar_id = {
      let mut guard = self.transport.lock().await;
      guard.take().map(|transport| transport.id)
    };

    if let Some(sidecar_id) = sidecar_id {
      let _ = self.runtime.shutdown(sidecar_id);
    }
  }
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

fn normalize_segments(segments: Vec<NewSegment>) -> Vec<NewSegment> {
  let mut normalized = segments
    .into_iter()
    .filter_map(normalize_segment)
    .collect::<Vec<_>>();

  normalized.sort_by(|left, right| {
    left
      .start
      .total_cmp(&right.start)
      .then(left.end.total_cmp(&right.end))
  });

  let mut merged = Vec::with_capacity(normalized.len());
  for segment in normalized {
    let Some(current) = merged.last_mut() else {
      merged.push(segment);
      continue;
    };

    if should_merge_segments(current, &segment) {
      merge_segments(current, segment);
      continue;
    }

    merged.push(segment);
  }

  merged
}

fn normalize_segment(mut segment: NewSegment) -> Option<NewSegment> {
  segment.text = normalize_segment_text(&segment.text);
  if segment.text.is_empty() || is_obvious_artifact_text(&segment.text) {
    return None;
  }

  Some(segment)
}

fn normalize_segment_text(text: &str) -> String {
  text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn should_merge_segments(current: &NewSegment, next: &NewSegment) -> bool {
  let gap = next.start - current.end;
  if gap > MAX_SEGMENT_MERGE_GAP_SECONDS {
    return false;
  }

  if next.end - current.start > MAX_MERGED_SEGMENT_DURATION_SECONDS {
    return false;
  }

  let current_stats = analyze_segment_text(&current.text);
  if current_stats.word_count >= MAX_MERGED_SEGMENT_WORDS
    || current_stats.char_count >= MAX_MERGED_SEGMENT_CHARS
  {
    return false;
  }

  if !current_stats.ends_sentence {
    return true;
  }

  current_stats.word_count < MIN_COMPLETE_SEGMENT_WORDS
    || current_stats.char_count < MIN_COMPLETE_SEGMENT_CHARS
}

fn merge_segments(current: &mut NewSegment, next: NewSegment) {
  current.end = current.end.max(next.end);
  current.text = join_segment_text(&current.text, &next.text);
}

fn join_segment_text(left: &str, right: &str) -> String {
  if left.is_empty() {
    return right.to_string();
  }

  if right.is_empty() {
    return left.to_string();
  }

  let Some(first_right_char) = right.chars().next() else {
    return left.to_string();
  };

  if matches!(first_right_char, ',' | '.' | '!' | '?' | ':' | ';') {
    format!("{left}{right}")
  } else {
    format!("{left} {right}")
  }
}

fn is_obvious_artifact_text(text: &str) -> bool {
  let stats = analyze_segment_text(text);
  if stats.alnum_count == 0 {
    return true;
  }

  stats.numeric_only && stats.word_count <= 1 && stats.digit_count <= MAX_NUMERIC_ARTIFACT_DIGITS
}

fn analyze_segment_text(text: &str) -> SegmentTextStats {
  let trimmed = text.trim();
  let word_count = trimmed.split_whitespace().count();
  let char_count = trimmed.chars().filter(|char| !char.is_whitespace()).count();
  let alnum_count = trimmed
    .chars()
    .filter(|char| char.is_alphanumeric())
    .count();
  let digit_count = trimmed.chars().filter(|char| char.is_numeric()).count();
  let has_letters = trimmed.chars().any(|char| char.is_alphabetic());
  let numeric_only = digit_count > 0
    && !has_letters
    && trimmed
      .chars()
      .all(|char| char.is_whitespace() || char.is_numeric() || !char.is_alphanumeric());

  SegmentTextStats {
    word_count,
    char_count,
    alnum_count,
    digit_count,
    numeric_only,
    ends_sentence: ends_with_sentence_punctuation(trimmed),
  }
}

fn ends_with_sentence_punctuation(text: &str) -> bool {
  let trimmed = text.trim_end_matches(|char: char| {
    char.is_whitespace() || matches!(char, '"' | '\'' | ')' | ']' | '}')
  });

  trimmed.ends_with('.')
    || trimmed.ends_with('!')
    || trimmed.ends_with('?')
    || trimmed.ends_with('…')
}

struct SegmentTextStats {
  word_count: usize,
  char_count: usize,
  alnum_count: usize,
  digit_count: usize,
  numeric_only: bool,
  ends_sentence: bool,
}

#[derive(Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
enum AsrEvent {
  LoadingModelStarted,
  LoadingModelCompleted,
  TranscribingStarted,
  TranscribingCompleted,
  Segment {
    start: f64,
    end: f64,
    progress: u8,
    text: String,
  },
  Error {
    message: String,
  },
}
