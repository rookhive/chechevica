import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { type RefObject, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { RippleEffect } from '@/shared/ui/RippleEffect';
import { type TabId, tabsStore } from '../model/tabsStore';
import { TabItemContent } from './TabItemContent';

type Props = {
  tabId: TabId;
  isActive: boolean;
  tabsCountRef: RefObject<number>;
};

export const TabItem = ({ tabId, isActive, tabsCountRef }: Props) => {
  const tabRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={tabRef}
      className={clsx(
        'flex w-full items-center gap-2 rounded-2xl p-2 pl-1 transition duration-300 ease-linear',
        isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-white/70 hover:bg-emerald-700/20'
      )}
    >
      <RippleEffect ref={tabRef} color="bg-white/5" />
      <TabItemContent tabId={tabId} />
      <AnimatePresence initial={false} mode="popLayout">
        {tabsCountRef.current > 1 && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative flex items-center justify-center rounded-full p-0.5 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              tabsStore.closeTab(tabId);
            }}
          >
            <Icon id="clear" size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
