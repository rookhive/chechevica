import { type ProjectId, useProject, useUpdateProject } from '@/entities/project';
import { Spinner } from '@/shared/ui/Spinner';
import { ProjectForm } from './ProjectForm';

type Props = {
  projectId: ProjectId;
  onClose: () => void;
};

export const EditProjectForm = ({ projectId, onClose }: Props) => {
  const updateProject = useUpdateProject();
  const { data: project, isLoading } = useProject({ projectId });

  if (isLoading || !project) {
    return <Spinner absoluteCentered />;
  }

  return (
    <ProjectForm
      initialTitle={project.title}
      initialThumbnail={project.thumbnail}
      submitLabel="Save"
      onSubmit={async ({ title, thumbnailPatch }) => {
        await updateProject({
          projectId,
          title,
          thumbnailPatch,
        });
        onClose();
      }}
    />
  );
};
