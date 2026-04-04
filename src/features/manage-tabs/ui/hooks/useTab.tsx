import { useContext, useMemo } from 'react';
import { useSnapshot } from 'valtio/react';
import { type TabId, tabsStore } from '../../model/tabsStore';
import { TabContext } from '../context-provider';

export const useTabId = (): TabId => {
  const tabId = useContext(TabContext);
  if (!tabId) throw new Error('useTab must be used within a TabContext.Provider');
  return tabId;
};

export const useTabState = () => {
  const tabId = useTabId();
  const tabProxy = tabsStore.getTabState(tabId);
  if (!tabProxy) throw new Error(`Tab not found: ${tabId}`);
  return useSnapshot(tabProxy);
};

export const useTab = () => {
  const tab = useTabState();
  const snap = useSnapshot(tabsStore.state);
  const isTabActive = snap.activeTabId === tab.id;
  return useMemo(() => ({ tab, isTabActive, ...tabsStore.tabActions(tab.id) }), [tab, isTabActive]);
};
