import type { JobParam } from '@/shared/contract/JobParam';
import type { JobParamKind } from '@/shared/contract/JobParamKind';
import type { StepParameters } from '@/shared/contract/StepParameters';
import type { Source } from './types';

export type StepKey = 'ingest' | 'download' | 'transcribe' | 'embed';
export type SourceProcessingKind = 'local' | 'remote';
export type StepParamValues = Record<string, unknown>;
export type SourceParamsByStep = Record<StepKey, StepParamValues>;

export const allSteps: StepKey[] = ['ingest', 'download', 'transcribe', 'embed'];

export const createEmptySourceParamsByStep = (): SourceParamsByStep => ({
  ingest: {},
  download: {},
  transcribe: {},
  embed: {},
});

export const getVisibleSteps = (kind: SourceProcessingKind): StepKey[] =>
  allSteps.filter((step) => (kind === 'local' ? step !== 'download' : step !== 'ingest'));

export const supportsStep = (kind: SourceProcessingKind, step: StepKey) =>
  kind === 'local' ? step !== 'download' : step !== 'ingest';

export const getReprocessSteps = (kind: SourceProcessingKind, startStep: StepKey): StepKey[] => {
  const visibleSteps = getVisibleSteps(kind);
  const startIndex = visibleSteps.indexOf(startStep);
  return startIndex >= 0 ? visibleSteps.slice(startIndex) : [];
};

export const isStepDisabled = (
  kind: SourceProcessingKind,
  selectedStartStep: StepKey,
  step: StepKey
) => {
  const visibleSteps = getVisibleSteps(kind);
  return visibleSteps.indexOf(step) < visibleSteps.indexOf(selectedStartStep);
};

export const getKindLabel = (kind: JobParamKind) => {
  if ('integer' in kind) return 'integer';
  if ('boolean' in kind) return 'boolean';
  return 'select';
};

const normalizeCheckboxValue = (value: unknown, fallbackValue = false) => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true') return true;
    if (normalizedValue === 'false') return false;
  }

  return fallbackValue;
};

const normalizeParamValue = (param: JobParam, value: unknown, fallbackValue: unknown) => {
  if ('boolean' in param.kind) {
    return normalizeCheckboxValue(value, normalizeCheckboxValue(fallbackValue));
  }

  return value;
};

export const buildStepDefaults = (params: JobParam[]): StepParamValues =>
  Object.fromEntries(
    params.map((param) => [param.key, normalizeParamValue(param, param.default, param.default)])
  );

export const buildDefaultsByStep = (stepParameters: StepParameters): SourceParamsByStep => ({
  ingest: buildStepDefaults(stepParameters.ingest),
  download: buildStepDefaults(stepParameters.download),
  transcribe: buildStepDefaults(stepParameters.transcribe),
  embed: buildStepDefaults(stepParameters.embed),
});

export const cloneParams = (params: SourceParamsByStep): SourceParamsByStep => ({
  ingest: { ...params.ingest },
  download: { ...params.download },
  transcribe: { ...params.transcribe },
  embed: { ...params.embed },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeSourceParams = (
  stepParameters: StepParameters,
  rawParams: unknown,
  fallbackDefaults: SourceParamsByStep = buildDefaultsByStep(stepParameters)
): SourceParamsByStep => {
  if (!isRecord(rawParams)) return fallbackDefaults;

  const normalizeStep = (step: StepKey) => {
    const stepRawParams = isRecord(rawParams[step]) ? rawParams[step] : {};

    return Object.fromEntries(
      stepParameters[step].map((param) => [
        param.key,
        normalizeParamValue(
          param,
          param.key in stepRawParams ? stepRawParams[param.key] : fallbackDefaults[step][param.key],
          fallbackDefaults[step][param.key]
        ),
      ])
    );
  };

  return {
    ingest: normalizeStep('ingest'),
    download: normalizeStep('download'),
    transcribe: normalizeStep('transcribe'),
    embed: normalizeStep('embed'),
  };
};

export const parseSourceParams = (
  source: Source,
  stepParameters: StepParameters,
  fallbackDefaults: SourceParamsByStep = buildDefaultsByStep(stepParameters)
): SourceParamsByStep => {
  try {
    return normalizeSourceParams(stepParameters, JSON.parse(source.paramsJson), fallbackDefaults);
  } catch {
    return fallbackDefaults;
  }
};
