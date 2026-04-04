import type { SourceId } from '@/entities/source/@x/segment';

export type SegmentId = number;

export type Segment = {
  id: SegmentId;
  sourceId: SourceId;
  start: number;
  end: number;
  text: string;
};
