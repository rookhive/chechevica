import type { ProjectId } from '@/entities/project/@x/source';
import type { JobParam } from '@/shared/contract/JobParam';
import type { Option } from '@/shared/types/common';

export type SourceId = string; // UUIDv7

export type SourceKind = 'local' | 'remote';
export type SourceType = 'video' | 'audio';
export type SourceStatus = 'processing' | 'succeeded' | 'failed' | 'cancelling' | 'canceled';
export type SourceProcessingParams = Record<JobKind, JobParam[]>;

export type Source = {
  id: SourceId;
  projectId: ProjectId;
  title: Option<string>;
  kind: SourceKind;
  mediaType: SourceType;
  status: SourceStatus;
  paramsJson: string; // JSON string
  thumbnail: Option<string>;
  duration: Option<number>;
  origin: Option<string>;
  originCreatedAt: Option<Date>;
  createdAt: Date;
  updatedAt: Option<Date>;
  ingestJobId: Option<JobId>;
  downloadJobId: Option<JobId>;
  transcribeJobId: Option<JobId>;
  embedJobId: Option<JobId>;
};

export type JobId = number;
export type JobKind = 'ingest' | 'download' | 'transcribe' | 'embed';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelling' | 'canceled';

export type Job = {
  id: JobId;
  sourceId: SourceId;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  error: Option<string>;
  params: Record<string, unknown>;
  createdAt: Date;
  startedAt: Option<Date>;
  readyAt: Option<Date>;
  finishedAt: Option<Date>;
};
