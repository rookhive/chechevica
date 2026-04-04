import { useMemo } from 'react';
import { Link } from 'wouter';
import { navigateTo, openInNewTabMenuItem } from '@/features/manage-tabs';
import { Button } from '@/shared/ui/Button';

export const ProjectsButton = () => {
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem('/projects')], []);

  return (
    <Link href="/projects">
      <Button
        iconId="projects"
        iconSize={20}
        tooltip="Open projects"
        tooltipPosition="bottom"
        contextMenuItems={contextMenuItems}
        onClick={() => navigateTo('/projects')}
      />
    </Link>
  );
};
