import { fromProjectDto } from '@/entities/project';
import { fromSegmentDto } from '@/entities/segment';
import { fromSourceDto } from '@/entities/source';
import type { SearchResultDto } from '@/shared/contract/SearchResultDto';
import type { SearchHit } from '../model/types';

export const fromSearchResultDto = (dto: SearchResultDto): SearchHit => ({
  project: fromProjectDto(dto.project),
  source: fromSourceDto(dto.source),
  segment: fromSegmentDto(dto.segment),
  score: dto.score,
});
