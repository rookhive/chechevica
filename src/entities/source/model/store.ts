import { proxy } from 'valtio';
import type { ProjectId } from '@/entities/project/@x/source';
import type { Job, JobId, Source, SourceId } from './types';

export type SourceSortField = 'createdAt' | 'originCreatedAt';
export type SourceSortDirection = 'asc' | 'desc';

export type ProjectSourceSort = {
  field: SourceSortField;
  direction: SourceSortDirection;
};

type State = {
  projectSourceIds: Record<ProjectId, SourceId[]>;
  projectSourceSorts: Record<ProjectId, ProjectSourceSort>;
  processingSourceIds: SourceId[];
  sourcesById: Record<SourceId, Source>;
  jobsById: Record<JobId, Job>;
};

export const store = proxy<State>({
  projectSourceIds: {},
  projectSourceSorts: {},
  processingSourceIds: proxy<SourceId[]>([]),
  sourcesById: {},
  jobsById: {},
});

const createSourceProxy = () => proxy({} as Source);
const createJobProxy = () => proxy({} as Job);
const createProjectSourceIdsProxy = () => proxy<SourceId[]>([]);
const createProjectSourceSortProxy = () =>
  proxy<ProjectSourceSort>({ field: 'createdAt', direction: 'desc' });

const removeSourceId = (sourceIds: SourceId[], sourceId: SourceId) => {
  const index = sourceIds.indexOf(sourceId);
  if (index >= 0) {
    sourceIds.splice(index, 1);
  }
};

const insertSourceIdByCreatedAt = (sourceIds: SourceId[], source: Source) => {
  const existingIndex = sourceIds.indexOf(source.id);
  if (existingIndex >= 0) {
    sourceIds.splice(existingIndex, 1);
  }
  const nextIndex = sourceIds.findIndex((sourceId) => {
    const currentSource = store.sourcesById[sourceId];
    return currentSource ? currentSource.createdAt > source.createdAt : false;
  });
  if (nextIndex === -1) {
    sourceIds.push(source.id);
    return;
  }
  sourceIds.splice(nextIndex, 0, source.id);
};

const syncTrackedProcessingSource = (source: Source) => {
  if (source.status === 'succeeded') {
    removeSourceId(store.processingSourceIds, source.id);
    return;
  }
  insertSourceIdByCreatedAt(store.processingSourceIds, source);
};

export const getProjectSourceIdsProxy = (projectId: ProjectId) => {
  const projectSourceIds = store.projectSourceIds[projectId];
  if (projectSourceIds) return projectSourceIds;
  const nextProjectSourceIds = createProjectSourceIdsProxy();
  store.projectSourceIds[projectId] = nextProjectSourceIds;
  return nextProjectSourceIds;
};

export const getProjectSourceSortProxy = (projectId: ProjectId) => {
  const projectSourceSort = store.projectSourceSorts[projectId];
  if (projectSourceSort) return projectSourceSort;
  const nextProjectSourceSort = createProjectSourceSortProxy();
  store.projectSourceSorts[projectId] = nextProjectSourceSort;
  return nextProjectSourceSort;
};

export const setProjectSourceSort = (projectId: ProjectId, sort: ProjectSourceSort) => {
  const nextSort = getProjectSourceSortProxy(projectId);
  nextSort.field = sort.field;
  nextSort.direction = sort.direction;
};

export const getSourceProxy = (sourceId: SourceId) => {
  const source = store.sourcesById[sourceId];
  if (source) return source;
  const nextSource = createSourceProxy();
  store.sourcesById[sourceId] = nextSource;
  return nextSource;
};

export const getJobProxy = (jobId: JobId) => {
  const job = store.jobsById[jobId];
  if (job) return job;
  const nextJob = createJobProxy();
  store.jobsById[jobId] = nextJob;
  return nextJob;
};

export const getProcessingSourceIdsProxy = () => store.processingSourceIds;

export const appendProjectSourceId = (projectId: ProjectId, sourceId: SourceId) => {
  const projectSources = store.projectSourceIds[projectId];
  if (!projectSources || projectSources.includes(sourceId)) return;
  projectSources.push(sourceId);
};

export const deleteSourceFromStore = (sourceId: SourceId) => {
  const source = store.sourcesById[sourceId];
  if (!source) return;
  delete store.sourcesById[sourceId];
  removeSourceId(store.processingSourceIds, sourceId);
  const projectSources = store.projectSourceIds[source.projectId];
  if (!projectSources) return;
  removeSourceId(projectSources, sourceId);
};

export const deleteJobFromStore = (jobId: JobId) => {
  delete store.jobsById[jobId];
};

export function hydrateProjectSources(projectId: ProjectId, sources: Source[]) {
  const nextSourceIds = sources.map((source) => source.id);
  const currentSourceIds = getProjectSourceIdsProxy(projectId);
  currentSourceIds.splice(0, currentSourceIds.length, ...nextSourceIds);
  for (const source of sources) hydrateSource(source);
}

export function hydrateSource(source: Source) {
  const existingSource = getSourceProxy(source.id);
  Object.assign(existingSource, source);
  syncTrackedProcessingSource(existingSource);
}

export function hydrateProcessingSources(sourcesWithJobs: Array<{ source: Source; jobs: Job[] }>) {
  const nextSourceIds = sourcesWithJobs.map(({ source }) => source.id);
  store.processingSourceIds.splice(0, store.processingSourceIds.length, ...nextSourceIds);
  for (const { source, jobs } of sourcesWithJobs) {
    hydrateSource(source);
    hydrateJobs(jobs);
  }
}

export function hydrateJobs(jobs: Job[]) {
  jobs.forEach(hydrateJob);
}

export function hydrateJob(job: Job) {
  const existingJob = getJobProxy(job.id);
  Object.assign(existingJob, job);
}
