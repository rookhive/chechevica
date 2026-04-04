import useSWR from 'swr';
import { type GetSourceSegmentsPayload, getSourceSegments } from '../api/api';

export function useSourceSegments(payload: GetSourceSegmentsPayload) {
  const { data: segments, ...rest } = useSWR(
    ['source-segments', payload.sourceId],
    () => getSourceSegments(payload),
    {
      suspense: true,
      revalidateOnFocus: false,
    }
  );
  return { segments, ...rest };
}
