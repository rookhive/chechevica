import { useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { useSnapshot } from 'valtio';
import type { ProjectId } from '@/entities/project/@x/source';
import type { StepParameters } from '@/shared/contract/StepParameters';
import {
  type CancelProcessingPayload,
  cancelProcessing,
  type DeleteSourcePayload,
  deleteSource,
  getActiveJobs,
  getProcessingSources,
  getProjectSources,
  getSource,
  getStepParameters,
  type ReprocessSourcePayload,
  reprocessSource,
} from '../api/api';
import { resolveSourceProcessingDefaults, store as settingsStore } from '../model/settings';
import {
  deleteSourceFromStore,
  getJobProxy,
  getProcessingSourceIdsProxy,
  getProjectSourceIdsProxy,
  getProjectSourceSortProxy,
  getSourceProxy,
  hydrateJobs,
  hydrateProcessingSources,
  hydrateProjectSources,
  hydrateSource,
  setProjectSourceSort,
  store,
} from '../model/store';
import type { Job, JobId, Source, SourceId } from '../model/types';

// Fetches all sources of a project and their active jobs
export function useFetchSources(projectId: ProjectId) {
  const { data, ...props } = useSWR<[Source[], Job[]]>(
    // Keep a single SWR key for both sources and jobs since they are tightly coupled
    ['sources', projectId],
    () => Promise.all([getProjectSources({ projectId }), getActiveJobs({ projectId })]),
    {
      revalidateOnFocus: false,
      suspense: true,
      onSuccess: ([sources, jobs]) => {
        hydrateProjectSources(projectId, sources);
        hydrateJobs(jobs);
      },
    }
  );
  // Don't expose the data directly since it is fully managed by the Valtio's store
  return { ...props };
}

// Fetches a single source by id and its jobs
export function useFetchSource(sourceId: SourceId) {
  const { data, ...props } = useSWR(['source', sourceId], () => getSource({ sourceId }), {
    revalidateOnFocus: false,
    suspense: true,
    onSuccess: (result) => {
      if (!result) {
        deleteSourceFromStore(sourceId);
        return;
      }

      const { source, jobs } = result;
      hydrateSource(source);
      hydrateJobs(jobs);
    },
  });
  // Don't expose the data directly since it is fully managed by the Valtio's store
  return { ...props };
}

// Fetches all sources that have not succeeded yet and their jobs
export function useFetchProcessingSources() {
  const { data, ...props } = useSWR('processing-sources', getProcessingSources, {
    revalidateOnFocus: false,
    onSuccess: (sourcesWithJobs) => {
      hydrateProcessingSources(sourcesWithJobs);
    },
  });

  return { ...props };
}

export function useDeleteSource() {
  return useCallback(async (payload: DeleteSourcePayload) => {
    const source = store.sourcesById[payload.sourceId];
    await deleteSource(payload);
    deleteSourceFromStore(payload.sourceId);
    mutate('processing-sources');
    mutate(['source', payload.sourceId], null, false);
    mutate(['source-artifact', payload.sourceId], undefined, false);
    mutate(['source-segments', payload.sourceId], undefined, false);
    if (source) {
      mutate(['sources', source.projectId]);
    }
  }, []);
}

export function useCancelProcessing() {
  return useCallback(async (payload: CancelProcessingPayload) => {
    await cancelProcessing(payload);
    mutate('processing-sources');
  }, []);
}

export function useReprocessSource(source: Source) {
  return useCallback(
    async (payload: ReprocessSourcePayload) => {
      await reprocessSource(payload);
      mutate('processing-sources');
      mutate(['sources', source.projectId]);
      mutate(['source', payload.sourceId]);
    },
    [source.projectId]
  );
}

export function useStepParameters() {
  return useSWR('step-parameters', () => getStepParameters(), {
    revalidateOnFocus: false,
    suspense: true,
  });
}

export function useSourcesSnapshot(projectId: ProjectId) {
  const sourceIds = useSnapshot(getProjectSourceIdsProxy(projectId));
  const sourcesById = useSnapshot(store.sourcesById);
  const sort = useSnapshot(getProjectSourceSortProxy(projectId));

  return useMemo(() => {
    const getSortValue = (sourceId: SourceId) => sourcesById[sourceId]?.[sort.field];

    return sourceIds.toSorted((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sort.direction === 'asc' ? -1 : 1;

      const aTime = aValue.getTime();
      const bTime = bValue.getTime();

      if (aTime === bTime) return 0;
      if (sort.direction === 'asc') return aTime - bTime;
      return bTime - aTime;
    });
  }, [sourceIds, sourcesById, sort]);
}

export function useProcessingSourceIdsSnapshot() {
  return useSnapshot(getProcessingSourceIdsProxy());
}

export function useSourceSort(projectId: ProjectId) {
  return useSnapshot(getProjectSourceSortProxy(projectId));
}

export function useSortSources(projectId: ProjectId) {
  return useCallback(
    (sortOptions: { field: 'createdAt' | 'originCreatedAt'; direction: 'asc' | 'desc' }) =>
      setProjectSourceSort(projectId, sortOptions),
    [projectId]
  );
}

export function useProcessingSourcesSummary() {
  const sourceIds = useProcessingSourceIdsSnapshot();
  const sourcesById = useSnapshot(store.sourcesById);

  return useMemo(() => {
    let processingCount = 0;

    for (const sourceId of sourceIds) {
      const status = sourcesById[sourceId]?.status;
      if (status === 'processing' || status === 'cancelling') {
        processingCount += 1;
      }
    }

    return {
      processingCount,
      actionableCount: Math.max(0, sourceIds.length - processingCount),
      totalCount: sourceIds.length,
    };
  }, [sourceIds, sourcesById]);
}

export function useSourceSnapshot(sourceId: SourceId) {
  return useSnapshot(getSourceProxy(sourceId));
}

export function useOptionalSourceSnapshot(sourceId: SourceId) {
  const sourcesById = useSnapshot(store.sourcesById);
  return sourcesById[sourceId];
}

export function useJobSnapshot(jobId: JobId) {
  return useSnapshot(getJobProxy(jobId));
}

export const useSourceSettings = (stepParameters: StepParameters) => {
  const { sourceDefaults, remoteSourceMediaType } = useSnapshot(settingsStore);
  const defaults = useMemo(
    () => resolveSourceProcessingDefaults(stepParameters, sourceDefaults),
    [sourceDefaults, stepParameters]
  );
  return { defaults, remoteSourceMediaType };
};
