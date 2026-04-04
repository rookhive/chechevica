import { AnimatePresence } from 'motion/react';
import { memo, useCallback, useLayoutEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import type { Option } from '@/shared/types/common';
import { Animated } from '@/shared/ui/Animated';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { VirtualizedList, type VirtualizedListHandle } from '@/shared/ui/VirtualizedList';
import type { SearchHit } from '../model/types';
import { useSearchStore } from './hooks';
import { SearchResultItem } from './SearchResultItem';
import { SearchResultsPanel } from './SearchResultsPanel';

export const SearchOverlay = memo(() => {
  const { state, reset } = useSearchStore();
  const { isOverlayOpen } = useSnapshot(state);

  return (
    <AnimatePresence onExitComplete={reset}>
      {isOverlayOpen && (
        <Animated
          className="absolute inset-0 z-20 flex min-h-0 flex-col items-center bg-black/70 pt-25 backdrop-blur-lg will-change-[opacity]"
          ease="linear"
        >
          <SearchResultsPanel />
          <SearchResults />
        </Animated>
      )}
    </AnimatePresence>
  );
});

const SearchResults = () => {
  const { state, setIsOverlayOpen, setIsInputFocused } = useSearchStore();
  const { searchResults } = useSnapshot(state);
  const { results } = searchResults || {};
  const listHandleRef = useRef<Option<VirtualizedListHandle>>(null);

  const setListHandle = useCallback(
    (handle: Option<VirtualizedListHandle>) => (listHandleRef.current = handle),
    []
  );

  const handleNavigate = useCallback(() => {
    setIsOverlayOpen(false);
    setIsInputFocused(false);
  }, [setIsOverlayOpen, setIsInputFocused]);

  const renderItem = useCallback(
    (searchHit: SearchHit) => (
      <SearchResultItem searchHit={searchHit} onNavigate={handleNavigate} />
    ),
    [handleNavigate]
  );

  // biome-ignore lint: it's fine
  useLayoutEffect(() => listHandleRef.current?.scrollToIndex(0), [results]);

  return (
    <>
      {!!results && !results.length && (
        <StatusMessage status="regular" iconId="search" iconSize={32}>
          No results found
        </StatusMessage>
      )}
      <VirtualizedList<SearchHit>
        className="scrollable max-h-full w-full px-1 pb-3"
        items={results || []}
        overscan={1}
        itemHeight={() => 100}
        getItemKey={(searchHit) => searchHit.segment.id}
        renderItem={renderItem}
        onReady={setListHandle}
      />
    </>
  );
};
