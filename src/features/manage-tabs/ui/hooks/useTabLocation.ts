import { useSnapshot } from 'valtio';
import { type TabId, tabsStore } from '../../model/tabsStore';

type LocationHook = () => [string, (to: string) => void];

type TabLocationHook = LocationHook & {
  searchHook?: () => string;
};

export const createTabLocationHook = (tabId: TabId): LocationHook => {
  const hook: TabLocationHook = () => {
    const tabProxy = tabsStore.getTabState(tabId);
    const tab = useSnapshot(tabProxy);
    const location = tab.location ?? '/';

    // wouter expects a "pathname" without the query string. Trips like
    // "/search?projectId=..." may fail to match routes, so strip the query
    // part before returning the location to the Router.
    const pathname = location.split('?')[0] || '/';

    return [pathname, (to: string) => tabsStore.navigateTo(tabId, to)];
  };

  hook.searchHook = () => {
    const tabProxy = tabsStore.getTabState(tabId);
    const tab = useSnapshot(tabProxy);
    const location = tab.location ?? '/';
    const queryIndex = location.indexOf('?');
    return queryIndex >= 0 ? location.slice(queryIndex) : '';
  };

  return hook;
};
