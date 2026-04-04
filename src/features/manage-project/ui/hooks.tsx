import { useMemo } from 'react';
import type { ProjectId } from '@/entities/project';
import { useDeleteProject } from '@/entities/project';
import type { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { dialog } from '@/shared/ui/Dialog';
import { modal } from '@/shared/ui/Modal';
import { CreateProjectForm } from './CreateProjectForm';
import { DeleteProjectMessage } from './DeleteProjectMessage';
import { EditProjectForm } from './EditProjectForm';

export const useUpdateProjectMenuItem = (projectId: ProjectId) => {
  return useMemo<ContextMenuItem>(
    () => ({
      id: 'edit',
      label: 'Edit project',
      iconId: 'edit',
      status: 'regular',
      onClick: () => {
        modal.open({
          title: 'Edit project',
          closeOnBackdropClick: false,
          children: ({ close }) => <EditProjectForm projectId={projectId} onClose={close} />,
        });
      },
    }),
    [projectId]
  );
};

export const useDeleteProjectMenuItem = (projectId: ProjectId) => {
  const deleteProject = useDeleteProject();
  return useMemo<ContextMenuItem>(
    () => ({
      id: 'delete',
      label: 'Delete project',
      iconId: 'trash',
      status: 'dangerous',
      onClick: () => {
        dialog.open({
          title: 'Confirm deletion',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          confirmButtonStatus: 'dangerous',
          children: <DeleteProjectMessage projectId={projectId} />,
          onConfirm: () => deleteProject({ projectId }),
        });
      },
    }),
    [deleteProject, projectId]
  );
};

export const useCreateProjectMenuItem = () => {
  return useMemo<ContextMenuItem>(
    () => ({
      id: 'create',
      label: 'Create project',
      iconId: 'project',
      status: 'regular',
      onClick: () => {
        modal.open({
          title: 'Create project',
          closeOnBackdropClick: false,
          children: ({ close }) => <CreateProjectForm onClose={close} />,
        });
      },
    }),
    []
  );
};
