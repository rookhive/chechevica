import { proxy, snapshot, subscribe } from 'valtio';
import type { StepParameters } from '@/shared/contract/StepParameters';
import type { Option } from '@/shared/types/common';
import {
  createEmptySourceParamsByStep,
  normalizeSourceParams,
  type SourceParamsByStep,
  type StepKey,
} from './params';

export type RemoteSourceMediaType = 'video' | 'audio';

type SettingsState = {
  sourceDefaults: SourceParamsByStep;
  remoteSourceMediaType: RemoteSourceMediaType;
};

type PersistedSettingsState = Partial<SettingsState>;

const STORAGE_KEY = 'chechevica.source-settings.v1';

export const store = proxy<SettingsState>({
  sourceDefaults: createEmptySourceParamsByStep(),
  remoteSourceMediaType: 'video',
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const sanitizeSourceDefaults = (value: unknown): Option<SourceParamsByStep> => {
  if (!isRecord(value)) return null;

  return {
    ingest: isRecord(value.ingest) ? value.ingest : {},
    download: isRecord(value.download) ? value.download : {},
    transcribe: isRecord(value.transcribe) ? value.transcribe : {},
    embed: isRecord(value.embed) ? value.embed : {},
  };
};

const loadPersistedState = (): Option<PersistedSettingsState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const sourceDefaults = sanitizeSourceDefaults(parsed.sourceDefaults);
    if (!sourceDefaults) return null;

    return {
      sourceDefaults,
      remoteSourceMediaType: parsed.remoteSourceMediaType === 'audio' ? 'audio' : 'video',
    };
  } catch {
    return null;
  }
};

const persistState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(store)));
  } catch {}
};

let persistTimer: Option<number> = null;
const schedulePersistState = () => {
  if (persistTimer !== null) return;

  persistTimer = requestIdleCallback(() => {
    if (persistTimer) {
      cancelIdleCallback(persistTimer);
      persistTimer = null;
    }

    persistState();
  });
};

const persisted = loadPersistedState();
if (persisted?.sourceDefaults) {
  store.sourceDefaults = persisted.sourceDefaults;
}

if (persisted?.remoteSourceMediaType) {
  store.remoteSourceMediaType = persisted.remoteSourceMediaType;
}

subscribe(store, schedulePersistState);

export const resolveSourceProcessingDefaults = (
  stepParameters: StepParameters,
  rawDefaults: SourceParamsByStep
) => normalizeSourceParams(stepParameters, rawDefaults);

export const getResolvedSourceProcessingDefaults = (stepParameters: StepParameters) =>
  resolveSourceProcessingDefaults(stepParameters, snapshot(store).sourceDefaults);

export const setSourceParam = (step: StepKey, key: string, value: unknown) => {
  store.sourceDefaults[step][key] = value;
};

export const setRemoteSourceMediaType = (value: RemoteSourceMediaType) => {
  store.remoteSourceMediaType = value;
};

export const resetSettings = () => {
  store.sourceDefaults = createEmptySourceParamsByStep();
  store.remoteSourceMediaType = 'video';
};
