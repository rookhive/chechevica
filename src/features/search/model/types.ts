import type { Project, ProjectId } from '@/entities/project';
import type { Segment } from '@/entities/segment';
import type { Source, SourceId } from '@/entities/source';

export type SearchMode = 'semantic' | 'keyword';

export type SearchFilters = {
  projectIds?: ProjectId[];
  sourceIds?: SourceId[];
  strict?: boolean;
};

export type SearchResults = {
  request: {
    searchMode: SearchMode;
    searchString: string;
    isStrictSearch: boolean;
    searchArea: string;
  };
  results: SearchHit[];
};

export type SearchHit = {
  project: Project;
  source: Source;
  segment: Segment;
  score: number;
};
