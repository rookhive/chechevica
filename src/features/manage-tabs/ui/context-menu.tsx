import type { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { tabsStore } from '../model/tabsStore';

export const openInNewTabMenuItem = (link: string): ContextMenuItem => ({
  id: 'open-in-new-tab',
  label: 'Open in new tab',
  iconId: 'new-tab',
  status: 'regular',
  onClick: () => {
    tabsStore.createTab(link, false);
  },
});
