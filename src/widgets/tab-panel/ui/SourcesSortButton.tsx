import { useRef } from 'react';
import type { ProjectId } from '@/entities/project';
import { useSortSources, useSourceSort } from '@/entities/source';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Menu, type MenuItem } from '@/shared/ui/Menu';

type Props = {
  projectId: ProjectId;
};

export const SourcesSortButton = ({ projectId }: Props) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const sourceSort = useSourceSort(projectId);
  const setSourceSort = useSortSources(projectId);

  const fields: {
    field: 'createdAt' | 'originCreatedAt';
    title: string;
    direction: 'asc' | 'desc';
    description?: string;
  }[] = [
    { field: 'createdAt', title: 'By import date', description: 'newest first', direction: 'desc' },
    { field: 'createdAt', title: 'By import date', description: 'oldest first', direction: 'asc' },
    {
      field: 'originCreatedAt',
      title: 'By creation/publish date',
      description: 'newest first',
      direction: 'desc',
    },
    {
      field: 'originCreatedAt',
      title: 'By creation/publish date',
      description: 'oldest first',
      direction: 'asc',
    },
  ];

  const items: MenuItem[] = fields.map(({ field, title, description, direction }) => {
    const id = `${field}-${direction}`;
    const isActive = sourceSort.field === field && sourceSort.direction === direction;
    const icon = (
      <Icon key={id} id="upward" size={16} className={direction === 'desc' ? 'rotate-180' : ''} />
    );

    return {
      id,
      className: isActive ? 'bg-emerald-700/40' : '',
      label: (
        <span className="flex w-full items-center justify-between gap-2">
          <span>
            {title}
            {description && <span className="font-normal opacity-50"> ({description})</span>}
          </span>
          {icon}
        </span>
      ),
      status: isActive ? 'success' : 'regular',
      onClick: () => setSourceSort({ field, direction }),
    };
  });

  return (
    <>
      <Button
        ref={anchorRef}
        iconId="sort"
        status="regular"
        tooltip="Sort sources"
        tooltipPosition="bottom"
      />
      <Menu anchorRef={anchorRef} items={items} align="end" />
    </>
  );
};
