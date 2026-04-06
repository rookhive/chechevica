import { listen } from '@tauri-apps/api/event';
import type { JobDto } from '@/shared/contract/JobDto';
import type { SourceDto } from '@/shared/contract/SourceDto';
import { fromJobDto, fromSourceDto } from '../api/mappers';
import { appendProjectSourceId, getJobProxy, hydrateJob, hydrateSource } from './store';
import type { Job, JobId } from './types';

const applyJobUpdate = (updatedJob: Partial<Job> & { id: JobId }) => {
  const job = getJobProxy(updatedJob.id);
  Object.assign(job, updatedJob);
};

const applySourceUpdate = (sourceDto: SourceDto) => {
  const source = fromSourceDto(sourceDto);
  hydrateSource(source);
  appendProjectSourceId(source.projectId, source.id);
};

export const initRuntimeListeners = () => {
  Promise.all([
    listen<SourceDto>('source:update', (event) => applySourceUpdate(event.payload)),
    listen<JobDto>('job:new', (event) => hydrateJob(fromJobDto(event.payload))),
    listen<JobDto>('job:update', (event) => applyJobUpdate(fromJobDto(event.payload))),
  ]);
};
