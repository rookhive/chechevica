use derive_more::Display;
use std::path::PathBuf;
use tauri::async_runtime::{Receiver, Sender};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Display)]
pub enum SidecarKind {
  #[display("faster-whisper")]
  #[allow(unused)]
  FasterWhisper,
  #[display("ffmpeg")]
  Ffmpeg,
  #[display("ffprobe")]
  Ffprobe,
  #[display("qdrant")]
  Qdrant,
  #[display("yt-dlp")]
  YtDlp,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SidecarId(pub Uuid);

impl SidecarId {
  pub fn new() -> Self {
    Self(Uuid::now_v7())
  }
}

#[derive(Debug, Clone, Default)]
pub struct SidecarOptions {
  pub args: Vec<String>,
  pub cwd: Option<PathBuf>,
}

#[derive(Debug)]
pub struct SidecarTransport {
  pub id: SidecarId,
  #[allow(unused)]
  pub stdin: Sender<Vec<u8>>,
  pub stdout: Receiver<Vec<u8>>,
  pub stderr: Receiver<Vec<u8>>,
}
