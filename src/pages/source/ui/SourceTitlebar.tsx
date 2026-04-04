import { useMemo } from 'react';
import { Link } from 'wouter';
import { useSourceSnapshot } from '@/entities/source';
import { openInNewTabMenuItem } from '@/features/manage-tabs';
import { useSourceId } from '@/features/view-source';
import { Button } from '@/shared/ui/Button';

export const SourceTitlebar = () => {
  const sourceId = useSourceId();
  const source = useSourceSnapshot(sourceId);
  const link = `/project/${source.projectId}`;
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem(link)], [link]);

  return (
    <h2 className="my-1 flex items-center gap-2 text-base">
      <Link href={link}>
        <Button
          iconId="project"
          iconSize={20}
          tooltip="Open project containing this source"
          contextMenuItems={contextMenuItems}
        />
      </Link>
      <span className="select-text">{source.title}</span>
    </h2>
  );
};
