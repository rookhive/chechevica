use derive_more::{Display, FromStr};
use serde::Serialize;
use uuid::Uuid;

use crate::entities::{project::ProjectId, source::SourceId};

#[derive(Clone, Display, FromStr, Serialize)]
#[serde(transparent)]
pub struct ArtifactId(Uuid);

#[derive(Serialize)]
pub struct Artifact {
  pub id: ArtifactId,
  pub project_id: ProjectId,
  pub source_id: SourceId,
  pub filename: String,
  pub size: Option<u64>,
}
