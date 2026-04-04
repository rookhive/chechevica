import { useMemo } from 'react';
import { Link } from 'wouter';
import { navigateTo, openInNewTabMenuItem } from '@/features/manage-tabs';
import { Button } from '@/shared/ui/Button';

export const SettingsButton = () => {
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem('/settings')], []);

  return (
    <Link href="/settings">
      <Button
        iconId="settings"
        iconSize={20}
        tooltip="Open settings"
        tooltipPosition="bottom"
        contextMenuItems={contextMenuItems}
        onClick={() => navigateTo('/settings')}
      />
    </Link>
  );
};
