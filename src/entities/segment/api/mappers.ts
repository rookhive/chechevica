import type { SegmentDto } from '@/shared/contract/SegmentDto';
import type { Segment } from '../model/types';

export const fromSegmentDto = (dto: SegmentDto): Segment => ({
  id: dto.id,
  sourceId: dto.sourceId,
  start: dto.start,
  end: dto.end,
  text: dto.text,
});
