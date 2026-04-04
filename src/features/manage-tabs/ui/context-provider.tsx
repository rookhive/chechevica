import { createContext, type PropsWithChildren } from 'react';
import type { Option } from '@/shared/types/common';
import type { TabId } from '../model/tabsStore';

export const TabContext = createContext<Option<TabId>>(null);

export const TabProvider = ({ tabId, children }: PropsWithChildren<{ tabId: TabId }>) => {
  return <TabContext.Provider value={tabId}>{children}</TabContext.Provider>;
};
