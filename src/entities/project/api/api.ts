import { sendMessage } from '@/shared/api/ipc';
import type { Patch } from '@/shared/contract/Patch';
import type { ProjectDto } from '@/shared/contract/ProjectDto';
import type { ProjectInfoDto } from '@/shared/contract/ProjectInfoDto';
import type { Option } from '@/shared/types/common';
import type { Project, ProjectId } from '../model/types';
import { fromProjectDto, fromProjectsInfoDto } from './mappers';

// Read all projects
export function getProjects() {
  return sendMessage<ProjectInfoDto[]>('get_projects').then((dtos) =>
    dtos.map(fromProjectsInfoDto)
  );
}

// Create project
export type CreateProjectPayload = {
  title: string;
  thumbnailPath: Option<string>;
};
export function createProject(payload: CreateProjectPayload) {
  return sendMessage<ProjectDto>('create_project', payload).then(fromProjectDto);
}

// Read project
export type GetProjectPayload = { projectId: ProjectId };
export function getProject(payload: GetProjectPayload) {
  return sendMessage<Option<ProjectDto>>('get_project', payload).then(
    (dto): Option<Project> => (dto ? fromProjectDto(dto) : null)
  );
}

// Update project
export type UpdateProjectPayload = {
  projectId: ProjectId;
  title: string;
  thumbnailPatch: Patch<string>;
};
export function updateProject(payload: UpdateProjectPayload) {
  return sendMessage<ProjectDto>('update_project', payload).then(fromProjectDto);
}

// Delete project
export type DeleteProjectPayload = { projectId: ProjectId };
export function deleteProject(payload: DeleteProjectPayload) {
  return sendMessage('delete_project', payload);
}
