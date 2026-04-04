import useSWR from 'swr';
import { type GetSourceArtifactPayload, getSourceArtifact } from '../api/api';

export const useSourceArtifact = (payload: GetSourceArtifactPayload) => {
  const { data: artifact, ...rest } = useSWR(
    ['source-artifact', payload.sourceId],
    () => getSourceArtifact(payload),
    { suspense: true, revalidateOnFocus: false }
  );
  return { artifact, ...rest };
};
