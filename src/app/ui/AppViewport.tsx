import clsx from 'clsx';
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { Router } from 'wouter';
import { createTabLocationHook, type TabId, TabProvider, tabsStore } from '@/features/manage-tabs';
import { TabPanel } from '@/widgets/tab-panel';
import { AppRoutes } from './AppRoutes';

export const AppViewport = () => {
  const { order, activeTabId } = useSnapshot(tabsStore.state);

  if (!order.length) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {activeTabId && <ActiveTabPanel tabId={activeTabId} />}
      <div className="relative min-h-0 grow">
        {order.map((tabId) => (
          <TabPane key={tabId} tabId={tabId} isActive={tabId === activeTabId} />
        ))}
      </div>
    </div>
  );
};

const ActiveTabPanel = ({ tabId }: { tabId: TabId }) => {
  const hook = useMemo(() => createTabLocationHook(tabId), [tabId]);

  return (
    <TabProvider tabId={tabId}>
      <Router hook={hook}>
        <TabPanel />
      </Router>
    </TabProvider>
  );
};

const TabPane = ({ tabId, isActive }: { tabId: TabId; isActive: boolean }) => {
  const hook = useMemo(() => createTabLocationHook(tabId), [tabId]);

  return (
    <div
      className={clsx(
        'absolute inset-0 min-h-0',
        isActive ? 'visible z-10' : 'pointer-events-none invisible select-none **:transition-none!'
      )}
    >
      <TabProvider tabId={tabId}>
        <Router hook={hook}>
          <AppRoutes />
        </Router>
      </TabProvider>
    </div>
  );
};
