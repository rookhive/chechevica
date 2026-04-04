use async_trait::async_trait;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EmbeddingInputKind {
  Query,
  Document,
}

#[async_trait]
pub trait EmbeddingService: Send + Sync {
  async fn generate_embeddings(
    &self,
    inputs: &[String],
    kind: EmbeddingInputKind,
    on_ready: &mut (dyn FnMut() + Send),
    on_progress: &mut (dyn FnMut(u8) + Send),
  ) -> anyhow::Result<Vec<Vec<f32>>>;
  async fn unload_model(&self) -> anyhow::Result<()>;
  fn schedule_unload(&self) {}
}
