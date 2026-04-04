use derive_more::{Display, FromStr};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Display, FromStr, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ProjectId(Uuid);

impl ProjectId {
  pub fn new() -> Self {
    Self(Uuid::now_v7())
  }
}

pub struct Project {
  pub id: ProjectId,
  pub title: String,
  pub thumbnail: Option<String>,
  pub created_at: i64,
  pub updated_at: Option<i64>,
}

pub struct ProjectInfo {
  pub project: Project,
  pub sources_count: u32,
}
