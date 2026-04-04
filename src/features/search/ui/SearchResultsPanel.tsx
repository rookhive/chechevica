import { AnimatePresence } from 'motion/react';
import { useSnapshot } from 'valtio';
import { Animated } from '@/shared/ui/Animated';
import { Icon } from '@/shared/ui/Icon';
import { useSearchStore } from './hooks';

export const SearchResultsPanel = () => {
  const { state } = useSearchStore();
  const { searchResults } = useSnapshot(state);
  const { searchMode, searchString, isStrictSearch, searchArea } = searchResults?.request || {};

  return (
    <AnimatePresence>
      {!!searchResults && (
        <Animated className="flex w-full max-w-200 flex-col items-center pt-4 pb-3">
          <div className="text-center text-emerald-600 text-sm">
            <Icon id="search" size={20} className="mr-1" />
            Results for{' '}
            <span className="wrap-break-word rounded-full bg-emerald-600/10 px-2.5 py-1">
              {searchString}
            </span>{' '}
            ({isStrictSearch && 'strict'} {searchMode} search {searchArea})
          </div>
        </Animated>
      )}
    </AnimatePresence>
  );
};
