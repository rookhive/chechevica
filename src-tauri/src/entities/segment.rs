use serde::Serialize;

use crate::entities::source::SourceId;

pub type SegmentId = i64;

#[derive(Clone, Serialize)]
pub struct Segment {
  pub id: SegmentId,
  pub source_id: SourceId,
  pub start: f64,
  pub end: f64,
  pub text: String,
}

#[derive(Clone)]
pub struct NewSegment {
  pub start: f64,
  pub end: f64,
  pub text: String,
}
