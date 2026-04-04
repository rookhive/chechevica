import type { ProjectDto } from '@/shared/contract/ProjectDto';
import type { ProjectInfoDto } from '@/shared/contract/ProjectInfoDto';
import type { Project, ProjectInfo } from '../model/types';

export const fromProjectDto = (dto: ProjectDto): Project => ({
  id: dto.id,
  title: dto.title,
  thumbnail: dto.thumbnail,
  createdAt: new Date(dto.createdAt),
  updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
});

export const fromProjectsInfoDto = (dto: ProjectInfoDto): ProjectInfo => ({
  project: fromProjectDto(dto.project),
  sourcesCount: dto.sourcesCount,
});
