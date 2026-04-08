import useSWR, { mutate } from 'swr';
import { deleteProjectSourcesFromStore } from '@/entities/source/model/store';
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
    const deletedSourceIds = deleteProjectSourcesFromStore(payload.projectId);
    mutate('projects');
    mutate('processing-sources');
    mutate(['project', payload.projectId], null, false);
    mutate(['sources', payload.projectId], undefined, false);
    for (const sourceId of deletedSourceIds) {
      mutate(['source', sourceId], null, false);
      mutate(['source-artifact', sourceId], undefined, false);
      mutate(['source-segments', sourceId], undefined, false);
    }
  };
}
