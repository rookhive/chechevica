import { useParams } from 'wouter';
import { type Project, type ProjectId, useProject } from '@/entities/project';
import { useTabMetainfo } from '@/features/manage-tabs';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { Sources } from './Sources';

export const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: ProjectId }>();
  const { data: project } = useProject({ projectId });

  if (!project)
    return (
      <StatusMessage
        status="warning"
        iconId="warning"
        linkHref="/projects"
        linkMessage="Go to Projects"
      >
        There's no such project
      </StatusMessage>
    );

  return <ProjectContent project={project} />;
};

type Props = {
  project: Project;
};

const ProjectContent = ({ project }: Props) => {
  useTabMetainfo({ icon: 'project', title: project.title });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 grow">
        <Sources projectId={project.id} />
      </div>
    </div>
  );
};
