use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sqlx::{
  SqlitePool,
  migrate::Migrator,
  sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use tokio::time::Duration;

mod job_repository;
mod project_repository;
mod search_repository;
mod source_repository;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub struct SqliteRepository {
  pool: SqlitePool,
}

impl SqliteRepository {
  pub async fn try_new(data_directory: PathBuf) -> Result<Self> {
    let pool = Self::create_pool(&data_directory).await?;
    Self::migrate(&pool).await?;
    Ok(Self { pool })
  }

  async fn create_pool(data_directory: &Path) -> Result<SqlitePool> {
    let db_filename = data_directory.join("app.sqlite");

    if cfg!(debug_assertions) {
      println!("Connecting to SQLite database at: {:?}", db_filename);
    }

    let pool = SqlitePoolOptions::new()
      .max_connections(4)
      .connect_with(
        SqliteConnectOptions::new()
          .filename(db_filename)
          .create_if_missing(true)
          .busy_timeout(Duration::from_secs(10))
          .pragma("journal_mode", "WAL"),
      )
      .await
      .context("Connect to SQLite")?;

    Ok(pool)
  }

  async fn migrate(pool: &SqlitePool) -> Result<()> {
    MIGRATOR.run(pool).await.context("Run migrations")?;
    Ok(())
  }
}
