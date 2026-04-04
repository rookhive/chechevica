import { proxy } from 'valtio';
import type { Option } from '@/shared/types/common';
import { keywordSearch, semanticSearch } from '../api/api';
import type { SearchFilters, SearchMode, SearchResults } from './types';

type State = {
  searchString: string;
  searchPlaceholder: string;
  searchResults: Option<SearchResults>;
  searchFilters: Option<SearchFilters>;
  searchMode: SearchMode;
  isOverlayOpen: boolean;
  isInputFocused: boolean;
  isStrictSearch: boolean;
  isSearching: boolean;
};

export const getDefaultState = (): State => ({
  searchString: '',
  searchPlaceholder: '',
  searchResults: null,
  searchFilters: null,
  searchMode: 'keyword',
  isOverlayOpen: false,
  isInputFocused: false,
  isStrictSearch: false,
  isSearching: false,
});

export type SearchStore = ReturnType<typeof createSearchStore>;

export const createSearchStore = () => {
  const state = proxy<State>(getDefaultState());

  let requestIdCounter = 0;

  const setSearchString = (searchString: string) => (state.searchString = searchString);
  const setSearchPlaceholder = (placeholder: string) => (state.searchPlaceholder = placeholder);
  const setSearchResults = (results: Option<SearchResults>) => (state.searchResults = results);
  const setSearchFilters = (filters: Option<SearchFilters>) => (state.searchFilters = filters);
  const setSearchMode = (mode: SearchMode) => (state.searchMode = mode);
  const setIsOverlayOpen = (isOpen: boolean) => (state.isOverlayOpen = isOpen);
  const setIsInputFocused = (isFocused: boolean) => (state.isInputFocused = isFocused);
  const setIsSearching = (isSearching: boolean) => (state.isSearching = isSearching);
  const toggleStrictSearch = () => (state.isStrictSearch = !state.isStrictSearch);

  const reset = () => {
    requestIdCounter++;
    setSearchString('');
    setSearchResults(null);
    setIsOverlayOpen(false);
    setIsSearching(false);
  };

  return {
    state,

    reset,
    setSearchString,
    setSearchPlaceholder,
    setSearchResults,
    setSearchFilters,
    setSearchMode,
    setIsOverlayOpen,
    setIsInputFocused,
    setIsSearching,
    toggleStrictSearch,

    async search() {
      if (!state.searchString.length) return;
      setIsSearching(true);
      setIsInputFocused(false);
      const requestId = ++requestIdCounter;
      const searchMode = state.searchMode;
      const searchString = state.searchString;
      const isStrictSearch = state.isStrictSearch;
      const searchArea = state.searchFilters?.projectIds?.length
        ? 'in this project'
        : state.searchFilters?.sourceIds?.length
          ? 'in this source'
          : 'in all projects';
      try {
        const results =
          searchMode === 'semantic'
            ? await semanticSearch({ filters: state.searchFilters ?? {}, text: searchString })
            : await keywordSearch({
                filters: { ...(state.searchFilters ?? {}), strict: isStrictSearch },
                text: searchString,
              });
        if (requestId !== requestIdCounter) return;
        setSearchResults({
          request: {
            searchMode,
            searchString,
            isStrictSearch,
            searchArea,
          },
          results,
        });
        setIsInputFocused(true);
      } finally {
        if (requestId === requestIdCounter) {
          setIsSearching(false);
        }
      }
    },
  };
};
