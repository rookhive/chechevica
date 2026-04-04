import { useCreateProject } from '@/entities/project';
import { ProjectForm } from './ProjectForm';

type Props = {
  onClose: () => void;
};

export const CreateProjectForm = ({ onClose }: Props) => {
  const createProject = useCreateProject();
  return (
    <ProjectForm
      submitLabel="Create"
      onSubmit={async ({ title, thumbnailPatch }) => {
        await createProject({
          title,
          thumbnailPath: thumbnailPatch.type === 'set' ? thumbnailPatch.value : null,
        });
        onClose();
      }}
    />
  );
};
