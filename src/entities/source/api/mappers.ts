import type { JobDto } from '@/shared/contract/JobDto';
import type { SourceDto } from '@/shared/contract/SourceDto';
import type { SourceWithJobsDto } from '@/shared/contract/SourceWithJobsDto';
import type { Job, JobKind, JobStatus, Source } from '../model/types';

export const fromSourceDto = (dto: SourceDto): Source => ({
  id: dto.id,
  projectId: dto.projectId,
  title: dto.title,
  kind: dto.kind,
  mediaType: dto.mediaType,
  status: dto.status,
  paramsJson: dto.paramsJson,
  thumbnail: dto.thumbnail,
  duration: dto.duration,
  origin: dto.origin,
  originCreatedAt: dto.originCreatedAt ? new Date(dto.originCreatedAt) : null,
  createdAt: new Date(dto.createdAt),
  updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
  ingestJobId: dto.ingestJobId,
  downloadJobId: dto.downloadJobId,
  transcribeJobId: dto.transcribeJobId,
  embedJobId: dto.embedJobId,
});

export const fromJobDto = (dto: JobDto): Job => ({
  id: dto.id,
  sourceId: dto.sourceId,
  kind: dto.kind as JobKind,
  status: dto.status as JobStatus,
  progress: dto.progress,
  error: dto.error,
  params: JSON.parse(dto.paramsJson ?? '{}'),
  createdAt: new Date(dto.createdAt),
  startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
  readyAt: dto.readyAt ? new Date(dto.readyAt) : null,
  finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : null,
});

export const fromSourceWithJobsDto = (dto: SourceWithJobsDto) => {
  const source = fromSourceDto(dto.source);
  const jobs = dto.jobs.map(fromJobDto);
  return { source, jobs };
};
