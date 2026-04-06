import type { SourceId } from '@/entities/source/@x/artifact';

export type ArtifactId = string; // UUIDv7

export type Artifact = {
  id: ArtifactId;
  sourceId: SourceId;
  path: string;
  size: number;
  mimeType: string;
};
