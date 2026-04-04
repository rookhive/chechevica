use std::{
  fs,
  path::{Path, PathBuf},
  sync::Arc,
};

use serde::Serialize;

use crate::infra::sidecars::{
  sidecar_runtime::SidecarRuntime,
  structs::{SidecarKind, SidecarOptions},
};

#[derive(Serialize)]
struct QdrantConfig {
  service: ServiceConfig,
  storage: StorageConfig,
  telemetry_disabled: bool,
}

#[derive(Serialize)]
struct ServiceConfig {
  grpc_port: u16,
}

#[derive(Serialize)]
struct StorageConfig {
  storage_path: String,
  snapshots_path: String,
}

struct QdrantPaths {
  base: PathBuf,
  config_path: PathBuf,
}

pub struct QdrantSidecarClient;

impl QdrantSidecarClient {
  pub async fn spawn(
    sidecar_runtime: Arc<SidecarRuntime>,
    data_directory: PathBuf,
  ) -> anyhow::Result<Self> {
    let paths = ensure_qdrant_config(&data_directory)?;

    let options = SidecarOptions {
      args: vec![
        "--config-path".to_string(),
        paths.config_path.to_string_lossy().to_string(),
      ],
      cwd: Some(paths.base),
    };

    sidecar_runtime.run(SidecarKind::Qdrant, options).await?;

    Ok(Self)
  }
}

fn ensure_qdrant_config(data_directory: &Path) -> anyhow::Result<QdrantPaths> {
  let base = data_directory.join("qdrant");

  fs::create_dir_all(&base)?;

  let storage_path = base.join("storage");
  let snapshots_path = base.join("snapshots");

  fs::create_dir_all(&storage_path)?;
  fs::create_dir_all(&snapshots_path)?;

  let config_path = base.join("config.yaml");
  let storage = storage_path.to_string_lossy().to_string();
  let snapshots = snapshots_path.to_string_lossy().to_string();

  let config = QdrantConfig {
    service: ServiceConfig { grpc_port: 6334 },
    storage: StorageConfig {
      storage_path: storage,
      snapshots_path: snapshots,
    },
    telemetry_disabled: true,
  };

  let config_content = serde_yaml::to_string(&config)?;

  fs::write(&config_path, config_content)?;

  Ok(QdrantPaths { base, config_path })
}
