import { type ProjectId, useProject } from '@/entities/project';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusMessage } from '@/shared/ui/StatusMessage';

type Props = {
  projectId: ProjectId;
};

export const DeleteProjectMessage = ({ projectId }: Props) => {
  const { data: project, isLoading } = useProject({ projectId });

  if (isLoading) return <Spinner />;
  if (!project)
    return (
      <StatusMessage status="dangerous" iconId="warning">
        Project not found
      </StatusMessage>
    );

  return (
    <div className="flex w-120 items-center gap-3 text-sm">
      <div className="rounded-full bg-amber-500/10 p-3">
        <Icon id="warning" size={32} className="shrink-0 text-amber-500" />
      </div>
      <div className="flex w-full min-w-0 flex-col gap-1">
        <span>
          The project and <b className="text-red-400">all its sources</b> will be permanently
          deleted:
        </span>
        <span className="wrap-break-word opacity-80">«{project.title}»</span>
        <span>
          This action <b className="text-red-400">cannot be undone</b>
        </span>
      </div>
    </div>
  );
};

export const DeleteProjectConfirmation = () => {
  return (
    <div className="flex w-110 items-center gap-3 text-sm">
      <div className="rounded-full bg-amber-500/10 p-3">
        <Icon id="warning" size={32} className="shrink-0 text-red-400" />
      </div>
      <div className="flex w-full min-w-0 flex-col gap-1">
        <span>
          This will permanently delete the entire project and{' '}
          <b className="text-red-400">all its sources</b>. This action{' '}
          <b className="text-red-400">cannot be undone</b>
        </span>
        <span>Are you absolutely sure?</span>
      </div>
    </div>
  );
};
