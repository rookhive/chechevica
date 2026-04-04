import { sendMessage } from '@/shared/api/ipc';
import type { SearchResultDto } from '@/shared/contract/SearchResultDto';
import type { SearchFilters } from '../model/types';
import { fromSearchResultDto } from './mappers';

type SemanticSearchPayload = { text: string; filters: SearchFilters };
export function semanticSearch(payload: SemanticSearchPayload) {
  return sendMessage<SearchResultDto[]>('semantic_search', payload).then((dtos) =>
    dtos.map(fromSearchResultDto)
  );
}

type KeywordSearchPayload = { text: string; filters: SearchFilters };
export function keywordSearch(payload: KeywordSearchPayload) {
  return sendMessage<SearchResultDto[]>('keyword_search', payload).then((dtos) =>
    dtos.map(fromSearchResultDto)
  );
}
