import type { ProjectId } from '@/entities/project';
import { AddSourceButton } from '@/features/manage-source';
import { SourcesSortButton } from './SourcesSortButton';

type Props = {
  projectId: ProjectId;
};

export const ProjectPageActions = ({ projectId }: Props) => {
  return (
    <div className="flex items-center gap-1">
      <SourcesSortButton projectId={projectId} />
      <AddSourceButton projectId={projectId} />
    </div>
  );
};
