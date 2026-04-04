import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { Button } from '@/shared/ui/Button';
import { tabsStore } from '../model/tabsStore';
import { TabItem } from './TabItem';

export const Tabs = () => {
  const { order, activeTabId } = useSnapshot(tabsStore.state);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsCountRef = useRef(0);

  tabsCountRef.current = order.length;

  useEffect(() => {
    const tabsNode = tabsRef.current;
    if (!tabsNode || order.length <= 10) return;
    const activeTabNode = tabsNode.querySelector<HTMLDivElement>(`[data-tab-id="${activeTabId}"]`);
    if (!activeTabNode) return;

    let rafTimer = requestAnimationFrame(() => {
      rafTimer = requestAnimationFrame(() => {
        activeTabNode.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'smooth',
        });
      });
    });

    return () => {
      cancelAnimationFrame(rafTimer);
    };
  }, [activeTabId, order.length]);

  if (order.length === 0) return null;

  return (
    <motion.div
      className="flex items-center gap-1"
      layout="size"
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.div
        ref={tabsRef}
        className={clsx(
          'relative flex items-center gap-1',
          order.length > 10 ? 'overflow-x-scroll' : 'overflow-x-hidden'
        )}
        style={{ scrollbarWidth: 'none' }}
        layout="size"
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {order.map((tabId) => (
            <motion.div
              key={tabId}
              layout
              data-tab-id={tabId}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="relative flex h-9 min-w-25 shrink overflow-hidden"
              style={{ width: 250 }}
              onClick={() => tabsStore.openTab(tabId)}
            >
              <TabItem
                key={tabId}
                tabId={tabId}
                isActive={tabId === activeTabId}
                tabsCountRef={tabsCountRef}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      <motion.div className="shrink-0" layout>
        <Button
          className="size-8"
          iconId="add"
          iconSize={22}
          tooltip="New Tab"
          tooltipStatus="regular"
          tooltipPosition="bottom"
          onClick={() => {
            tabsStore.createTab();
          }}
        />
      </motion.div>
    </motion.div>
  );
};
