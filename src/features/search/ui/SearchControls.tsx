import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useSnapshot } from 'valtio';
import { Button } from '@/shared/ui/Button';
import { useSearchStore } from './hooks';
import { SearchModeSelector } from './SearchModeSelector';

export const SearchControls = () => {
  const { state, toggleStrictSearch, setSearchMode, search } = useSearchStore();
  const { searchMode, isStrictSearch } = useSnapshot(state);

  return (
    <div className="ml-auto flex items-center pl-2">
      <AnimatePresence mode="wait" initial={false}>
        {searchMode === 'keyword' && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 40 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="shrink-0 overflow-hidden"
          >
            <Button
              iconId="space"
              className={clsx(
                'size-8 bg-transparent hover:bg-[unset]',
                isStrictSearch && 'bg-emerald-600/30! text-white!'
              )}
              tooltip="Match strict substrings (Alt+W)"
              tooltipStatus="regular"
              tooltipPosition="bottom"
              onClick={() => {
                toggleStrictSearch();
                search();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <SearchModeSelector
        selectedItem={searchMode}
        items={[
          {
            id: 'keyword',
            iconId: 'keyword',
            label: 'Keyword',
            description: 'Keyword search (Alt+K)',
            onClick: () => {
              setSearchMode('keyword');
              search();
            },
          },
          {
            id: 'semantic',
            iconId: 'magic',
            label: 'Semantic',
            description: 'Semantic search (Alt+S)',
            onClick: () => {
              setSearchMode('semantic');
              search();
            },
          },
        ]}
      />
    </div>
  );
};
