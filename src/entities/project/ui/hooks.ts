import useSWR, { mutate } from 'swr';
import {
  type CreateProjectPayload,
  createProject,
  type DeleteProjectPayload,
  deleteProject,
  type GetProjectPayload,
  getProject,
  getProjects,
  type UpdateProjectPayload,
  updateProject,
} from '../api/api';

export function useProjects() {
  return useSWR('projects', getProjects, { suspense: true });
}

export function useCreateProject() {
  return async (payload: CreateProjectPayload) => {
    await createProject(payload);
    mutate('projects');
  };
}

export function useProject(payload: GetProjectPayload) {
  return useSWR(['project', payload.projectId], () => getProject(payload), { suspense: true });
}

export function useUpdateProject() {
  return async (payload: UpdateProjectPayload) => {
    await updateProject(payload);
    mutate('projects');
    mutate(['project', payload.projectId]);
  };
}

export function useDeleteProject() {
  return async (payload: DeleteProjectPayload) => {
    await deleteProject(payload);
    mutate('projects');
    mutate(['project', payload.projectId]);
  };
}
