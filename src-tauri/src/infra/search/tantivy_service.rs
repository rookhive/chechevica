use std::path::PathBuf;

use anyhow::Context;
use async_trait::async_trait;
use tantivy::collector::TopDocs;
use tantivy::query::{BooleanQuery, Occur, Query, QueryParser, TermQuery};
use tantivy::schema::{
  FAST, Field, IndexRecordOption, STORED, STRING, Schema, TEXT, TextFieldIndexing, TextOptions,
  Value,
};
use tantivy::tokenizer::{LowerCaser, NgramTokenizer, TextAnalyzer};
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument, Term, doc};

use crate::application::interfaces::search::{
  KeywordSearchHit, KeywordSearchRequest, SearchService,
};
use crate::entities::{
  project::ProjectId,
  segment::{Segment, SegmentId},
  source::SourceId,
};

pub struct TantivyService {
  index: Index,
  writer: tokio::sync::Mutex<IndexWriter>,
  reader: IndexReader,
  project_id_field: Field,
  source_id_field: Field,
  segment_id_field: Field,
  text_field: Field,
  text_ngram_field: Option<Field>,
}

impl TantivyService {
  pub async fn try_new(data_directory: PathBuf) -> anyhow::Result<Self> {
    let index_directory = data_directory.join("tantivy");
    tokio::fs::create_dir_all(&index_directory)
      .await
      .context("Create Tantivy directory")?;

    let mut schema_builder = Schema::builder();
    let project_id_field = schema_builder.add_text_field("project_id", STRING | STORED);
    let source_id_field = schema_builder.add_text_field("source_id", STRING | STORED);
    let segment_id_field = schema_builder.add_u64_field("segment_id", STORED | FAST);

    let text_field_indexing = TextFieldIndexing::default()
      .set_tokenizer("ngram")
      .set_index_option(IndexRecordOption::WithFreqsAndPositions);
    let text_field_options = TextOptions::default()
      .set_indexing_options(text_field_indexing)
      .set_stored();

    let text_field = schema_builder.add_text_field("text", TEXT | STORED);
    schema_builder.add_text_field("text_ngram", text_field_options);

    let schema = schema_builder.build();

    let index = if index_directory.join("meta.json").exists() {
      Index::open_in_dir(&index_directory).context("Open Tantivy index")?
    } else {
      Index::create_in_dir(&index_directory, schema.clone()).context("Create Tantivy index")?
    };

    let ngram_tokenizer = NgramTokenizer::new(3, 20, false).context("Create ngram tokenizer")?;
    let ngram_analyzer = TextAnalyzer::builder(ngram_tokenizer)
      .filter(LowerCaser)
      .build();
    index.tokenizers().register("ngram", ngram_analyzer);

    let writer = index
      .writer(50_000_000)
      .context("Create Tantivy index writer")?;

    let reader = index
      .reader_builder()
      .reload_policy(ReloadPolicy::OnCommitWithDelay)
      .try_into()
      .context("Create Tantivy index reader")?;

    let text_ngram_field = index.schema().get_field("text_ngram").ok();

    Ok(Self {
      index,
      writer: tokio::sync::Mutex::new(writer),
      reader,
      project_id_field,
      source_id_field,
      segment_id_field,
      text_field,
      text_ngram_field,
    })
  }

  fn build_filters(
    &self,
    request: &KeywordSearchRequest,
  ) -> anyhow::Result<Option<Box<dyn tantivy::query::Query>>> {
    let mut clauses = Vec::new();

    if let Some(project_ids) = &request.filters.project_ids {
      let mut inner = Vec::new();
      for project_id in project_ids {
        let project_id_str = project_id.to_string();
        let term = Term::from_field_text(self.project_id_field, &project_id_str);
        inner.push((
          Occur::Should,
          Box::new(TermQuery::new(term, IndexRecordOption::Basic))
            as Box<dyn tantivy::query::Query>,
        ));
      }
      if !inner.is_empty() {
        clauses.push((
          Occur::Must,
          Box::new(BooleanQuery::new(inner)) as Box<dyn tantivy::query::Query>,
        ));
      }
    }

    if let Some(source_ids) = &request.filters.source_ids {
      let mut inner = Vec::new();
      for source_id in source_ids {
        let source_id_str = source_id.to_string();
        let term = Term::from_field_text(self.source_id_field, &source_id_str);
        inner.push((
          Occur::Should,
          Box::new(TermQuery::new(term, IndexRecordOption::Basic))
            as Box<dyn tantivy::query::Query>,
        ));
      }
      if !inner.is_empty() {
        clauses.push((
          Occur::Must,
          Box::new(BooleanQuery::new(inner)) as Box<dyn tantivy::query::Query>,
        ));
      }
    }

    if clauses.is_empty() {
      Ok(None)
    } else {
      Ok(Some(Box::new(BooleanQuery::new(clauses))))
    }
  }

  fn build_ngram_term_query(&self, phrase: &str) -> anyhow::Result<Option<Box<dyn Query>>> {
    let text_ngram_field = match self.text_ngram_field {
      Some(field) => field,
      None => return Ok(None),
    };

    let mut analyzer = self
      .index
      .tokenizers()
      .get("ngram")
      .context("Ngram tokenizer is not registered")?;

    let mut term_queries: Vec<(Occur, Box<dyn Query>)> = Vec::new();

    let mut token_stream = analyzer.token_stream(phrase);
    token_stream.process(&mut |token| {
      let term = Term::from_field_text(text_ngram_field, &token.text);
      term_queries.push((
        Occur::Must,
        Box::new(TermQuery::new(term, IndexRecordOption::Basic)) as Box<dyn Query>,
      ));
    });

    if term_queries.is_empty() {
      return Ok(None);
    }

    if term_queries.len() == 1 {
      return Ok(Some(term_queries.into_iter().next().unwrap().1));
    }

    Ok(Some(Box::new(BooleanQuery::new(term_queries))))
  }
}

#[async_trait]
impl SearchService for TantivyService {
  async fn search(&self, request: &KeywordSearchRequest) -> anyhow::Result<Vec<KeywordSearchHit>> {
    let searcher = self.reader.searcher();

    let text_query_parser = QueryParser::for_index(&self.index, vec![self.text_field]);
    let exact_query = text_query_parser.parse_query(&request.query)?;

    let ngram_query = self.build_ngram_term_query(&request.query)?;

    let mut clauses: Vec<(Occur, Box<dyn Query>)> = Vec::new();
    clauses.push((Occur::Should, exact_query));
    if let Some(ngram_query) = ngram_query {
      clauses.push((Occur::Should, ngram_query));
    }

    let mut query: Box<dyn Query> = if clauses.len() == 1 {
      clauses.remove(0).1
    } else {
      Box::new(BooleanQuery::new(clauses))
    };

    if let Some(filter_query) = self.build_filters(request)? {
      query = Box::new(BooleanQuery::new(vec![
        (Occur::Must, query),
        (Occur::Must, filter_query),
      ]));
    }

    let top_docs = searcher.search(&query, &TopDocs::with_limit(request.top_k).order_by_score())?;

    let mut results = Vec::new();

    for (score, doc_address) in top_docs {
      let doc: TantivyDocument = searcher.doc(doc_address)?;
      let segment_id_value = doc
        .get_first(self.segment_id_field)
        .context("Missing segment_id field in search doc")?;

      let segment_id = segment_id_value
        .as_u64()
        .context("Invalid segment_id value in search doc")? as SegmentId;

      results.push(KeywordSearchHit { segment_id, score });
    }

    Ok(results)
  }

  async fn update_index(
    &self,
    project_id: &ProjectId,
    source_id: &SourceId,
    segments: &[Segment],
  ) -> anyhow::Result<()> {
    self.delete_source_index(project_id, source_id).await?;

    let mut writer = self.writer.lock().await;

    for segment in segments {
      if let Some(text_ngram_field) = self.text_ngram_field {
        writer.add_document(doc! {
          self.project_id_field => project_id.to_string(),
          self.source_id_field => source_id.to_string(),
          self.segment_id_field => segment.id as u64,
          self.text_field => segment.text.clone(),
          text_ngram_field => segment.text.clone(),
        })?;
      } else {
        writer.add_document(doc! {
          self.project_id_field => project_id.to_string(),
          self.source_id_field => source_id.to_string(),
          self.segment_id_field => segment.id as u64,
          self.text_field => segment.text.clone(),
        })?;
      }
    }

    writer.commit()?;
    self.reader.reload()?;

    Ok(())
  }

  async fn delete_source_index(
    &self,
    _project_id: &ProjectId,
    source_id: &SourceId,
  ) -> anyhow::Result<()> {
    let mut writer = self.writer.lock().await;
    let source_id_str = source_id.to_string();
    let term = Term::from_field_text(self.source_id_field, &source_id_str);
    writer.delete_term(term);
    writer.commit()?;
    self.reader.reload()?;
    Ok(())
  }

  async fn delete_project_index(&self, project_id: &ProjectId) -> anyhow::Result<()> {
    let mut writer = self.writer.lock().await;
    let project_id_str = project_id.to_string();
    let term = Term::from_field_text(self.project_id_field, &project_id_str);
    writer.delete_term(term);
    writer.commit()?;
    self.reader.reload()?;
    Ok(())
  }
}
