import { proxy } from 'valtio';
import type { ProjectId } from '@/entities/project';
import {
  buildDefaultsByStep,
  cloneParams,
  getKindLabel,
  getRemoteSourceMetadata,
  getVisibleSteps,
  importSources,
  type RemoteSourceMediaType,
  type SourceParamsByStep,
  type StepKey,
  supportsStep,
} from '@/entities/source';
import type { JobParam } from '@/shared/contract/JobParam';
import type { JobParamKind } from '@/shared/contract/JobParamKind';
import type { RemoteSourceMetadata } from '@/shared/contract/RemoteSourceMetadata';
import type { StepParameters } from '@/shared/contract/StepParameters';
import type { Option } from '@/shared/types/common';
import type { ImportItem, LocalImportItem, RemoteCandidate, RemoteImportItem } from './types';

type State = {
  selectedSources: ImportItem[];
  remoteCandidates: RemoteCandidate[];
  remoteLink: string;
  remoteError: Option<string>;
  isRemoteLoaderOpen: boolean;
  isRemoteLoading: boolean;
  isImporting: boolean;
  importError: Option<string>;
};

export type ImportStore = ReturnType<typeof createImportStore>;

export const getDefaultState = (): State => ({
  selectedSources: [],
  remoteCandidates: [],
  remoteLink: '',
  remoteError: null,
  isRemoteLoaderOpen: false,
  isRemoteLoading: false,
  isImporting: false,
  importError: null,
});

const createItemId = () => crypto.randomUUID();

const candidateId = (item: RemoteSourceMetadata) => item.url;

const getSourceParams = (params: SourceParamsByStep): Record<StepKey, Record<string, unknown>> => ({
  ingest: { ...params.ingest },
  download: { ...params.download },
  transcribe: { ...params.transcribe },
  embed: { ...params.embed },
});

export const createImportStore = (
  stepParameters: StepParameters,
  initialParams: SourceParamsByStep = buildDefaultsByStep(stepParameters),
  initialRemoteMediaType: RemoteSourceMediaType = 'video'
) => {
  const defaultParams = cloneParams(initialParams);

  const state = proxy<State>(getDefaultState());

  const setSelectedSources = (selectedSources: ImportItem[]) =>
    (state.selectedSources = selectedSources);
  const setRemoteCandidates = (remoteCandidates: RemoteCandidate[]) =>
    (state.remoteCandidates = remoteCandidates);
  const setRemoteLink = (remoteLink: string) => (state.remoteLink = remoteLink);
  const setRemoteError = (remoteError: Option<string>) => (state.remoteError = remoteError);
  const setIsRemoteLoaderOpen = (isRemoteLoaderOpen: boolean) =>
    (state.isRemoteLoaderOpen = isRemoteLoaderOpen);
  const setIsRemoteLoading = (isRemoteLoading: boolean) =>
    (state.isRemoteLoading = isRemoteLoading);
  const setIsImporting = (isImporting: boolean) => (state.isImporting = isImporting);
  const setImportError = (importError: Option<string>) => (state.importError = importError);

  return {
    state,
    setRemoteLink,

    addLocalPaths(paths: string[]) {
      const existingOrigins = new Set(state.selectedSources.map((item) => item.origin));
      const nextItems = paths
        .map((path) => path.trim())
        .filter(Boolean)
        .filter((path) => !existingOrigins.has(path))
        .map<LocalImportItem>((path) => ({
          id: createItemId(),
          kind: 'local',
          origin: path,
          label: path.split(/[/\\]/).pop() || path,
          params: cloneParams(defaultParams),
        }));

      if (!nextItems.length) return;
      setSelectedSources([...state.selectedSources, ...nextItems]);
    },

    removeSelectedSource(sourceId: string) {
      setSelectedSources(state.selectedSources.filter((item) => item.id !== sourceId));
    },

    setSourceParam(sourceId: string, step: StepKey, key: string, value: unknown) {
      const source = state.selectedSources.find((item) => item.id === sourceId);
      if (!source) return;
      source.params[step][key] = value;
    },

    setRemoteMediaType(sourceId: string, mediaType: RemoteSourceMediaType) {
      const source = state.selectedSources.find((item) => item.id === sourceId);
      if (!source || source.kind !== 'remote') return;
      source.mediaType = mediaType;
    },

    openRemoteLoader() {
      setIsRemoteLoaderOpen(true);
    },

    closeRemoteLoader() {
      setIsRemoteLoaderOpen(false);
      setRemoteError(null);
      setIsRemoteLoading(false);
    },

    resetRemoteLoader() {
      setRemoteLink('');
      setRemoteCandidates([]);
      setRemoteError(null);
      setIsRemoteLoading(false);
    },

    removeRemoteCandidate(index: number) {
      setRemoteCandidates(state.remoteCandidates.filter((_, itemIndex) => itemIndex !== index));
    },

    async fetchRemoteCandidates() {
      const link = state.remoteLink.trim();
      if (!link) return;

      setIsRemoteLoading(true);
      setRemoteError(null);

      try {
        const items = await getRemoteSourceMetadata({ link });
        setRemoteCandidates(
          items.map((item) => ({
            id: candidateId(item),
            title: item.title,
            url: item.url,
          }))
        );
      } catch (error) {
        setRemoteError(error instanceof Error ? error.message : 'Failed to load remote videos');
      } finally {
        setIsRemoteLoading(false);
      }
    },

    addRemoteItems(items: RemoteCandidate[]) {
      const existingOrigins = new Set(state.selectedSources.map((item) => item.origin));
      const nextItems = items
        .filter((item) => !existingOrigins.has(item.url))
        .map<RemoteImportItem>((item) => ({
          id: createItemId(),
          kind: 'remote',
          origin: item.url,
          label: item.title,
          mediaType: initialRemoteMediaType,
          params: cloneParams(defaultParams),
        }));

      if (!nextItems.length) return;
      setSelectedSources([...state.selectedSources, ...nextItems]);
    },

    async importSelectedSources(projectId: ProjectId) {
      if (!state.selectedSources.length || state.isImporting) return;
      setIsImporting(true);
      setImportError(null);

      try {
        await importSources({
          projectId,
          sources: state.selectedSources.map((item) => {
            const params = getSourceParams(item.params);

            if (item.kind === 'local') {
              return {
                kind: 'local' as const,
                origin: item.origin,
                params,
              };
            }

            return {
              kind: 'remote' as const,
              origin: item.origin,
              mediaType: item.mediaType,
              params,
            };
          }),
        });
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Failed to import sources');
        throw error;
      } finally {
        setIsImporting(false);
      }
    },

    getStepParams: (step: StepKey): JobParam[] => stepParameters[step],
    supportsStep: (item: ImportItem, step: StepKey) => supportsStep(item.kind, step),
    getKindLabel: (kind: JobParamKind) => getKindLabel(kind),
    getVisibleSteps: (item: ImportItem): StepKey[] => getVisibleSteps(item.kind),
  };
};
