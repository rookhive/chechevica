import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useSnapshot } from 'valtio';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import { type TabId, tabsStore } from '../model/tabsStore';

type Props = { tabId: TabId };

export const TabItemContent = ({ tabId }: Props) => {
  const { icon, title, isLoading, isPlayingMedia } = useSnapshot(tabsStore.getTabState(tabId));

  return (
    <div className="flex min-w-0 grow items-center gap-1">
      <div className="relative flex shrink-0 items-center justify-center rounded-full border border-white/5 border-dashed bg-white/2 p-1">
        <Icon
          id={icon}
          size={18}
          className={clsx('transition-opacity duration-300', isLoading && 'opacity-0')}
        />
        <AnimatePresence initial={false}>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Spinner size={12} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="min-w-0 shrink grow truncate px-1 text-xs">{title}</div>
      <AnimatePresence initial={false} mode="popLayout">
        {isPlayingMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex items-center justify-center rounded-full p-0.5"
          >
            <Icon id="volume" size={16} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
