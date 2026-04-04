PRAGMA foreign_keys = ON;


CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);


CREATE TABLE sources (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT,
  thumbnail TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('local', 'remote')),
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed', 'cancelling', 'canceled')),
  origin TEXT NOT NULL,
  origin_created_at INTEGER,
  params_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(params_json)),
  duration REAL CHECK (duration IS NULL OR duration >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  ingest_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  download_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  transcribe_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  embed_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX sources_project_id_idx ON sources(project_id);


CREATE TABLE artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  size INTEGER,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX artifacts_source_id_idx ON artifacts(source_id);


CREATE TABLE segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  source_id TEXT NOT NULL,
  start REAL NOT NULL,
  end REAL NOT NULL CHECK (end >= start),
  text TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX segments_source_id_idx ON segments(source_id);


CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('download', 'transcribe', 'ingest', 'embed')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelling', 'canceled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error TEXT,
  params_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ready_at INTEGER,
  started_at INTEGER,
  finished_at INTEGER,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX jobs_source_id_idx ON jobs(source_id);

CREATE TRIGGER jobs_after_insert_update_source
AFTER INSERT ON jobs
FOR EACH ROW
BEGIN
  UPDATE sources
  SET
    ingest_job_id = CASE WHEN new.kind = 'ingest' THEN new.id ELSE ingest_job_id END,
    download_job_id = CASE WHEN new.kind = 'download' THEN new.id ELSE download_job_id END,
    transcribe_job_id = CASE WHEN new.kind = 'transcribe' THEN new.id ELSE transcribe_job_id END,
    embed_job_id = CASE WHEN new.kind = 'embed' THEN new.id ELSE embed_job_id END,
    status = CASE
      WHEN new.status IN ('queued', 'running') THEN 'processing'
      WHEN new.status = 'cancelling' THEN 'cancelling'
      WHEN new.status = 'canceled' THEN 'canceled'
      WHEN new.status = 'failed' THEN 'failed'
      WHEN new.status = 'succeeded' AND new.kind = 'embed' THEN 'succeeded'
      ELSE status
    END
  WHERE id = new.source_id;
END;

CREATE TRIGGER jobs_after_update_set_source_status
AFTER UPDATE ON jobs
FOR EACH ROW
BEGIN
  UPDATE sources
  SET status = CASE
    WHEN new.status IN ('queued', 'running') THEN 'processing'
    WHEN new.status = 'cancelling' THEN 'cancelling'
    WHEN new.status = 'canceled' THEN 'canceled'
    WHEN new.status = 'failed' THEN 'failed'
    WHEN new.status = 'succeeded' AND new.kind = 'embed' THEN 'succeeded'
    ELSE status
  END
  WHERE id = new.source_id;
END;
