import { useEffect, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { useKeyDown } from '@/shared/ui/useKeyDown';
import { createSearchStore } from '../model/searchStore';
import type { SearchFilters } from '../model/types';
import { SearchProvider } from './context-provider';
import { useSearchStore } from './hooks';
import { SearchInput } from './SearchInput';
import { SearchOverlay } from './SearchOverlay';

type Props = {
  placeholder: string;
  filters?: SearchFilters;
};

export const Search = ({ placeholder, filters }: Props) => {
  const store = useMemo(() => createSearchStore(), []);

  useEffect(() => {
    store.setSearchFilters(filters || null);
  }, [store, filters]);

  useEffect(() => {
    store.setSearchPlaceholder(placeholder);
  }, [store, placeholder]);

  return (
    <SearchProvider value={store}>
      <SearchContent />
    </SearchProvider>
  );
};

const SearchContent = () => {
  const {
    state,
    search,
    toggleStrictSearch,
    setSearchMode,
    setIsOverlayOpen,
    setIsInputFocused,
    setSearchString,
  } = useSearchStore();
  const { isOverlayOpen, searchMode } = useSnapshot(state);

  useKeyDown(
    useMemo(
      () => [
        {
          code: 'Escape',
          onKeyDown: () => {
            setIsInputFocused(false);
            setIsOverlayOpen(false);
            setSearchString('');
          },
        },
        {
          code: 'KeyW',
          altKey: true,
          onKeyDown: () => {
            if (searchMode !== 'keyword') return;
            toggleStrictSearch();
            search();
          },
        },
        {
          code: 'KeyK',
          altKey: true,
          onKeyDown: () => {
            setSearchMode('keyword');
            search();
          },
        },
        {
          code: 'KeyS',
          altKey: true,
          onKeyDown: () => {
            setSearchMode('semantic');
            search();
          },
        },
      ],
      [
        searchMode,
        toggleStrictSearch,
        setSearchMode,
        setIsOverlayOpen,
        setIsInputFocused,
        setSearchString,
        search,
      ]
    ),
    { enabled: isOverlayOpen }
  );

  return (
    <>
      <SearchOverlay />
      <SearchInput />
    </>
  );
};
