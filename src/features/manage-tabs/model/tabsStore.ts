import { proxy, snapshot, subscribe } from 'valtio';
import type { Option } from '@/shared/types/common';
import type { Props as IconProps } from '@/shared/ui/Icon';

export type TabId = string;
export type TabIcon = IconProps['id'];

export type TabState = {
  id: TabId;
  icon: TabIcon;
  title: string;
  location: string;
  history: string[];
  future: string[];
  isLoading: boolean;
  isPlayingMedia: boolean;
};

export type TabsState = {
  order: TabId[];
  activeTabId: Option<TabId>;
  tabsById: Record<TabId, TabState>;
};

export type TabActions = {
  navigateTo: (location: string) => void;
  goBack: () => void;
  goForward: () => void;
  setTitle: (title: string) => void;
  setIcon: (icon: TabIcon) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsPlayingMedia: (isPlayingMedia: boolean) => void;
};

type PersistedTabsState = Pick<TabsState, 'order' | 'activeTabId' | 'tabsById'>;

const STORAGE_KEY = 'chechevica.tabs.v1';

const setHashFromLocation = (location: string) => {
  const nextHash = `#${location}`;
  if (window.location.hash === nextHash) return;
  window.location.hash = nextHash;
};

const getDefaultTab = (tab?: Partial<TabState>): TabState => {
  const location = tab?.location ?? '/new';
  const id = tab?.id ?? crypto.randomUUID();

  return {
    id,
    icon: tab?.icon ?? 'new-tab',
    title: tab?.title ?? '',
    location,
    history: tab?.history ?? [location],
    future: tab?.future ?? [],
    isLoading: tab?.isLoading ?? false,
    isPlayingMedia: tab?.isPlayingMedia ?? false,
  };
};

const state = proxy<TabsState>({
  order: [],
  activeTabId: null,
  tabsById: {},
});

const getTabOrThrow = (tabId: TabId): TabState => {
  const tab = state.tabsById[tabId];
  if (!tab) throw new Error(`Tab not found: ${tabId}`);
  return tab;
};

export const tabsStore = {
  state,

  createTab(location?: string, setActive = true) {
    const tab = getDefaultTab(location ? { location, history: [location] } : undefined);
    state.tabsById[tab.id] = tab;
    state.order.push(tab.id);
    if (setActive) {
      state.activeTabId = tab.id;
      setHashFromLocation(tab.location);
    }
    return tab.id;
  },

  openTab(tabId: TabId) {
    if (!state.tabsById[tabId]) return;
    state.activeTabId = tabId;
    setHashFromLocation(state.tabsById[tabId].location);
  },

  closeTab(tabId: TabId) {
    if (!state.tabsById[tabId]) return;
    const order = [...state.order];
    const index = order.indexOf(tabId);
    state.order = order.filter((id) => id !== tabId);
    if (state.activeTabId !== tabId) return;
    const last = state.order.length ? state.order.at(-1) : null;
    const nearestTabId = (index > 0 ? order[index - 1] : null) ?? order[index + 1] ?? last ?? null;
    state.activeTabId = nearestTabId;
    if (nearestTabId) setHashFromLocation(state.tabsById[nearestTabId]?.location ?? '/');
  },

  getTabState(tabId: TabId) {
    return state.tabsById[tabId];
  },

  navigateTo(tabId: TabId, location: string) {
    const tab = getTabOrThrow(tabId);
    if (tab.location === location) return;
    tab.history.push(location);
    tab.location = location;
    tab.future = [];
    tab.isLoading = true;
    state.activeTabId = tabId;
    setHashFromLocation(location);
  },

  navigateToInActiveTab(location: string) {
    if (!state.activeTabId) return;
    tabsStore.navigateTo(state.activeTabId, location);
  },

  goBack(tabId: TabId) {
    const tab = getTabOrThrow(tabId);
    if (tab.history.length <= 1) return;
    const current = tab.history.pop();
    if (current) tab.future.unshift(current);
    const prev = tab.history.at(-1) ?? '/';
    tab.location = prev;
    tab.isLoading = true;
    state.activeTabId = tabId;
    setHashFromLocation(prev);
  },

  goForward(tabId: TabId) {
    const tab = getTabOrThrow(tabId);
    const next = tab.future.shift();
    if (!next) return;
    tab.history.push(next);
    tab.location = next;
    tab.isLoading = true;
    state.activeTabId = tabId;
    setHashFromLocation(next);
  },

  setTitle(tabId: TabId, title: string) {
    getTabOrThrow(tabId).title = title;
  },

  setIcon(tabId: TabId, icon: TabIcon) {
    getTabOrThrow(tabId).icon = icon;
  },

  setIsLoading(tabId: TabId, isLoading: boolean) {
    getTabOrThrow(tabId).isLoading = isLoading;
  },

  setIsPlayingMedia(tabId: TabId, isPlayingMedia: boolean) {
    getTabOrThrow(tabId).isPlayingMedia = isPlayingMedia;
  },

  tabActions(tabId: TabId): TabActions {
    return {
      navigateTo: (location) => tabsStore.navigateTo(tabId, location),
      goBack: () => tabsStore.goBack(tabId),
      goForward: () => tabsStore.goForward(tabId),
      setTitle: (title) => tabsStore.setTitle(tabId, title),
      setIcon: (icon) => tabsStore.setIcon(tabId, icon),
      setIsLoading: (isLoading) => tabsStore.setIsLoading(tabId, isLoading),
      setIsPlayingMedia: (isPlayingMedia) => tabsStore.setIsPlayingMedia(tabId, isPlayingMedia),
    };
  },
};

// TODO: maybe better validate using zod
const loadPersistedState = (): Option<PersistedTabsState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const maybe = parsed as Partial<PersistedTabsState>;
    if (!Array.isArray(maybe.order)) return null;
    if (!('tabsById' in maybe) || !maybe.tabsById || typeof maybe.tabsById !== 'object') {
      return null;
    }

    return {
      order: maybe.order.filter((x): x is TabId => typeof x === 'string'),
      activeTabId: typeof maybe.activeTabId === 'string' ? maybe.activeTabId : null,
      tabsById: maybe.tabsById as Record<TabId, TabState>,
    };
  } catch {
    return null;
  }
};

const persistState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(state)));
  } catch {}
};

let persistTimer: Option<number> = null;
const schedulePersistState = () => {
  if (persistTimer !== null) return;
  persistTimer = requestIdleCallback(() => {
    if (persistTimer) {
      cancelIdleCallback(persistTimer);
      persistTimer = null;
    }
    persistState();
  });
};

const persisted = loadPersistedState();
if (persisted) {
  state.order = persisted.order;
  state.activeTabId = persisted.activeTabId;
  state.tabsById = persisted.tabsById;
  if (state.activeTabId && !state.tabsById[state.activeTabId]) {
    state.activeTabId = state.order.find((id) => !!state.tabsById[id]) ?? null;
  }
}

if (!tabsStore.state.order.length) {
  tabsStore.createTab();
}

subscribe(state, schedulePersistState);

export const navigateTo = (location: string) => tabsStore.navigateToInActiveTab(location);
