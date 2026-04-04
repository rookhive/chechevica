pub fn l2_normalize_embedding(mut embedding: Vec<f32>) -> anyhow::Result<Vec<f32>> {
  if embedding.is_empty() {
    anyhow::bail!("Embedding is empty");
  }

  let norm_sq = embedding.iter().try_fold(0.0_f64, |acc, &value| {
    if !value.is_finite() {
      anyhow::bail!("Embedding contains non-finite values");
    }

    Ok(acc + (value as f64) * (value as f64))
  })?;

  if norm_sq <= f64::EPSILON {
    anyhow::bail!("Embedding has near-zero L2 norm");
  }

  let inv_norm = (norm_sq.sqrt() as f32).recip();

  for value in &mut embedding {
    *value *= inv_norm;
  }

  Ok(embedding)
}

pub fn l2_normalize_embeddings(embeddings: Vec<Vec<f32>>) -> anyhow::Result<Vec<Vec<f32>>> {
  embeddings.into_iter().map(l2_normalize_embedding).collect()
}
