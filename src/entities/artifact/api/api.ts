import type { SourceId } from '@/entities/source/@x/artifact';
import { sendMessage } from '@/shared/api/ipc';
import type { ArtifactDto } from '@/shared/contract/ArtifactDto';
import type { Option } from '@/shared/types/common';
import type { Artifact } from '../model/types';

export type GetSourceArtifactPayload = { sourceId: SourceId };
export function getSourceArtifact(payload: GetSourceArtifactPayload) {
  return sendMessage<ArtifactDto>('get_source_artifact', payload).then(
    (artifact) => artifact as Option<Artifact>
  );
}
