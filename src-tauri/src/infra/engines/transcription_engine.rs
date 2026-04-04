use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use serde::Deserialize;
use tokio::sync::Mutex;

use crate::{
  application::interfaces::jobs::{self, JobEvent, JobEventSender, JobParam, JobParamKind},
  entities::segment::NewSegment,
  infra::sidecars::{
    clients::{
      faster_whisper_sidecar_client::{FasterWhisperSidecarClient, TranscriptionRequest},
      ffprobe_sidecar_client::FfprobeSidecarClient,
    },
    sidecar_runtime::SidecarRuntime,
  },
};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
struct TranscriptionParams {
  model: String,
  language: String,
  batch_size: String,
  #[cfg(feature = "cuda")]
  compute_type: String,
  #[cfg(feature = "cuda")]
  beam_size: String,
}

pub struct TranscriptionEngine {
  asr: FasterWhisperSidecarClient,
  ffprobe: FfprobeSidecarClient,
  run_lock: Mutex<()>,
}

impl TranscriptionEngine {
  pub fn new(runtime: Arc<SidecarRuntime>) -> Self {
    Self {
      asr: FasterWhisperSidecarClient::new(runtime.clone()),
      ffprobe: FfprobeSidecarClient::new(runtime.clone()),
      run_lock: Mutex::new(()),
    }
  }

  fn parse_params_json(&self, params_json: &str) -> anyhow::Result<TranscriptionParams> {
    serde_json::from_str(params_json).context("Parse transcription params JSON")
  }
}

#[async_trait]
impl jobs::JobEngine for TranscriptionEngine {
  fn params(&self) -> Vec<JobParam> {
    #[allow(unused)]
    let mut params = vec![
      JobParam {
        key: "model".to_string(),
        label: "Model".to_string(),
        kind: JobParamKind::Select {
          options: vec![
            "tiny".into(),
            "tiny.en".into(),
            "base".into(),
            "base.en".into(),
            "small".into(),
            "small.en".into(),
            "medium".into(),
            "medium.en".into(),
            "large-v1".into(),
            "large-v2".into(),
            "large-v3".into(),
            "large-v3-turbo".into(),
            "distil-small.en".into(),
            "distil-medium.en".into(),
            "distil-large-v2".into(),
            "distil-large-v3".into(),
            "distil-large-v3.5".into(),
          ],
        },
        default: Some("large-v3-turbo".into()),
      },
      JobParam {
        key: "language".to_string(),
        label: "Language".to_string(),
        kind: JobParamKind::Select {
          options: vec![
            "auto".into(),
            "af".into(),
            "am".into(),
            "ar".into(),
            "as".into(),
            "az".into(),
            "ba".into(),
            "be".into(),
            "bg".into(),
            "bn".into(),
            "bo".into(),
            "br".into(),
            "bs".into(),
            "ca".into(),
            "cs".into(),
            "cy".into(),
            "da".into(),
            "de".into(),
            "el".into(),
            "en".into(),
            "es".into(),
            "et".into(),
            "eu".into(),
            "fa".into(),
            "fi".into(),
            "fo".into(),
            "fr".into(),
            "gl".into(),
            "gu".into(),
            "ha".into(),
            "haw".into(),
            "he".into(),
            "hi".into(),
            "hr".into(),
            "ht".into(),
            "hu".into(),
            "hy".into(),
            "id".into(),
            "is".into(),
            "it".into(),
            "ja".into(),
            "jw".into(),
            "ka".into(),
            "kk".into(),
            "km".into(),
            "kn".into(),
            "ko".into(),
            "la".into(),
            "lb".into(),
            "ln".into(),
            "lo".into(),
            "lt".into(),
            "lv".into(),
            "mg".into(),
            "mi".into(),
            "mk".into(),
            "ml".into(),
            "mn".into(),
            "mr".into(),
            "ms".into(),
            "mt".into(),
            "my".into(),
            "ne".into(),
            "nl".into(),
            "nn".into(),
            "no".into(),
            "oc".into(),
            "pa".into(),
            "pl".into(),
            "ps".into(),
            "pt".into(),
            "ro".into(),
            "ru".into(),
            "sa".into(),
            "sd".into(),
            "si".into(),
            "sk".into(),
            "sl".into(),
            "sn".into(),
            "so".into(),
            "sq".into(),
            "sr".into(),
            "su".into(),
            "sv".into(),
            "sw".into(),
            "ta".into(),
            "te".into(),
            "tg".into(),
            "th".into(),
            "tk".into(),
            "tl".into(),
            "tr".into(),
            "tt".into(),
            "uk".into(),
            "ur".into(),
            "uz".into(),
            "vi".into(),
            "yi".into(),
            "yo".into(),
            "zh".into(),
            "yue".into(),
          ],
        },
        default: Some("auto".into()),
      },
      JobParam {
        key: "batch_size".to_string(),
        label: "Batch Size".to_string(),
        kind: JobParamKind::Integer { min: 1, max: 64 },
        default: Some("8".into()),
      },
    ];

    #[cfg(feature = "cuda")]
    {
      params.insert(
        3,
        JobParam {
          key: "compute_type".to_string(),
          label: "Compute Type".to_string(),
          kind: JobParamKind::Select {
            options: vec!["int8".into(), "float16".into(), "float32".into()],
          },
          default: Some("float16".into()),
        },
      );
      params.insert(
        4,
        JobParam {
          key: "beam_size".to_string(),
          label: "Beam Size".to_string(),
          kind: JobParamKind::Integer { min: 1, max: 5 },
          default: Some("5".into()),
        },
      );
    }

    params
  }

  fn validate_params(&self, params_json: &str) -> anyhow::Result<()> {
    self.parse_params_json(params_json)?;
    Ok(())
  }

  async fn shutdown(&self) -> anyhow::Result<()> {
    if cfg!(debug_assertions) {
      println!("Shutting down TranscriptionEngine...");
    }
    self.ffprobe.shutdown().await?;
    self.asr.shutdown().await?;
    Ok(())
  }
}

#[async_trait]
impl jobs::TranscriptionEngine for TranscriptionEngine {
  async fn transcribe(
    &self,
    media_path: &str,
    params_json: &str,
    events: JobEventSender,
  ) -> anyhow::Result<Vec<NewSegment>> {
    let _ = self.run_lock.lock().await;
    let media_path = media_path.trim();
    if media_path.is_empty() {
      anyhow::bail!("Media path is empty");
    }

    let params = self.parse_params_json(params_json)?;
    let duration = self.ffprobe.probe_duration(media_path).await?;

    let ready_events = events.clone();
    let mut on_ready = move || {
      let _ = ready_events.send(JobEvent::ModelReady);
    };

    self
      .asr
      .transcribe(
        &params.to_request(media_path, duration)?,
        &mut on_ready,
        |percent| {
          let _ = events.send(JobEvent::Progress { percent });
        },
      )
      .await
  }
}

impl TranscriptionParams {
  fn to_request(&self, media_path: &str, duration: f64) -> anyhow::Result<TranscriptionRequest> {
    let model = self.model.trim();
    let language = self.language.trim();
    let batch_size: u32 = self.batch_size.trim().parse()?;

    #[cfg(feature = "cpu")]
    let (device, compute_type, beam_size) = ("cpu", "int8", 1);

    #[cfg(feature = "cuda")]
    let (device, compute_type) = ("cuda", self.compute_type.trim());

    #[cfg(feature = "cuda")]
    let beam_size: u32 = self.beam_size.trim().parse()?;

    Ok(TranscriptionRequest {
      path: media_path.to_string(),
      device: device.to_string(),
      model: model.to_string(),
      language: language.to_string(),
      compute_type: compute_type.to_string(),
      batch_size,
      beam_size,
      duration: Some(duration.max(0.0)),
    })
  }
}
