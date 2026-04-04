import { useCreateProject } from '@/entities/project';
import { Button } from '@/shared/ui/Button';
import { modal } from '@/shared/ui/Modal';
import { ProjectForm } from './ProjectForm';

export const AddProjectButton = () => {
  const createProject = useCreateProject();

  const handleOpen = () => {
    modal.open({
      title: 'Create project',
      closeOnBackdropClick: false,
      children: ({ close }) => (
        <ProjectForm
          submitLabel="Create"
          onSubmit={async ({ title, thumbnailPatch }) => {
            await createProject({
              title,
              thumbnailPath: thumbnailPatch.type === 'set' ? thumbnailPatch.value : null,
            });
            close();
          }}
        />
      ),
    });
  };

  return (
    <Button iconId="add" status="success" isUppercased onClick={handleOpen}>
      New Project
    </Button>
  );
};
