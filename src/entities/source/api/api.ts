import type { ProjectId } from '@/entities/project/@x/source';
import { sendMessage } from '@/shared/api/ipc';
import type { JobDto } from '@/shared/contract/JobDto';
import type { RemoteSourceMetadata } from '@/shared/contract/RemoteSourceMetadata';
import type { SourceDto } from '@/shared/contract/SourceDto';
import type { SourceWithJobsDto } from '@/shared/contract/SourceWithJobsDto';
import type { StepParameters } from '@/shared/contract/StepParameters';
import type { Option } from '@/shared/types/common';
import type { JobKind, SourceId, SourceType } from '../model/types';
import { fromJobDto, fromSourceDto, fromSourceWithJobsDto } from './mappers';

// Read all sources of a project
export type GetProjectSourcesPayload = { projectId: ProjectId };
export function getProjectSources(payload: GetProjectSourcesPayload) {
  return sendMessage<SourceDto[]>('get_sources', payload).then((dtos) => dtos.map(fromSourceDto));
}

// Read a single source by id
export type GetSourcePayload = { sourceId: SourceId };
export function getSource(payload: GetSourcePayload) {
  return sendMessage<Option<SourceWithJobsDto>>('get_source', payload).then((dto) =>
    dto ? fromSourceWithJobsDto(dto) : null
  );
}

// Read all sources that have not succeeded yet and their jobs
export function getProcessingSources() {
  return sendMessage<SourceWithJobsDto[]>('get_processing_sources').then((dtos) =>
    dtos.map(fromSourceWithJobsDto)
  );
}

// Read active jobs of a project (all jobs that are not succeeded)
export type GetActiveJobsPayload = { projectId: ProjectId };
export function getActiveJobs(payload: GetActiveJobsPayload) {
  return sendMessage<JobDto[]>('get_active_jobs', payload).then((dtos) => dtos.map(fromJobDto));
}

// Import sources
export type SourceImport = {
  origin: string;
  params: Record<JobKind, Record<string, unknown>>;
} & ({ kind: 'local' } | { kind: 'remote'; mediaType: SourceType });
export type ImportSourcesPayload = { projectId: ProjectId; sources: SourceImport[] };
export function importSources(payload: ImportSourcesPayload) {
  return sendMessage('import_sources', payload);
}

export type ReprocessSourcePayload = {
  sourceId: SourceId;
  startStep: JobKind;
  mediaType: SourceType;
  params: Record<JobKind, Record<string, unknown>>;
};
export function reprocessSource(payload: ReprocessSourcePayload) {
  return sendMessage('reprocess_source', payload);
}

export type GetRemoteSourceMetadataPayload = { link: string };
export function getRemoteSourceMetadata(payload: GetRemoteSourceMetadataPayload) {
  return sendMessage<RemoteSourceMetadata[]>('get_remote_source_metadata', payload);
}

// Processing parameters
export function getStepParameters() {
  return sendMessage<StepParameters>('get_step_parameters');
}

// Delete source
export type DeleteSourcePayload = { sourceId: SourceId };
export function deleteSource(payload: DeleteSourcePayload) {
  return sendMessage('delete_source', payload);
}

// Cancel source processing
export type CancelProcessingPayload = { sourceId: SourceId };
export function cancelProcessing(payload: CancelProcessingPayload) {
  return sendMessage('cancel_processing', payload);
}
