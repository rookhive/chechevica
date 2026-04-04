import type { Option } from '@/shared/types/common';

export type ProjectId = string; // UUIDv7

export type Project = {
  id: ProjectId;
  title: string;
  thumbnail: Option<string>;
  createdAt: Date;
  updatedAt: Option<Date>;
};

export type ProjectInfo = {
  project: Project;
  sourcesCount: number;
};
