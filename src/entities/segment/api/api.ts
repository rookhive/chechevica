import type { SourceId } from '@/entities/source/@x/segment';
import { sendMessage } from '@/shared/api/ipc';
import type { SegmentDto } from '@/shared/contract/SegmentDto';
import { fromSegmentDto } from './mappers';

export type GetSourceSegmentsPayload = { sourceId: SourceId };
export type ExportSelectedSegmentsPayload = {
  sourceId: SourceId;
  segments: Array<{
    start: number;
    end: number;
  }>;
};
export type ExportSelectedSegmentsResult = {
  path: string;
  filename: string;
};

export function getSourceSegments(payload: GetSourceSegmentsPayload) {
  return sendMessage<SegmentDto[]>('get_source_segments', payload).then((dtos) =>
    dtos.map(fromSegmentDto)
  );
}

export function exportSelectedSegments(payload: ExportSelectedSegmentsPayload) {
  return sendMessage<ExportSelectedSegmentsResult>('export_selected_segments', payload);
}
