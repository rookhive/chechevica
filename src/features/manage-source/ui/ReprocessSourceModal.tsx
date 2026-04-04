import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  buildDefaultsByStep,
  getBackgroundColorByJobKind,
  getLabelByJobKind,
  getReprocessSteps,
  getVisibleSteps,
  isStepDisabled,
  parseSourceParams,
  type SourceId,
  type SourceParamsByStep,
  type StepKey,
  useReprocessSource,
  useSourceSettings,
  useSourceSnapshot,
  useStepParameters,
} from '@/entities/source';
import type { StepParameters } from '@/shared/contract/StepParameters';
import type { Option } from '@/shared/types/common';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { dialog } from '@/shared/ui/Dialog';
import { Icon } from '@/shared/ui/Icon';
import { modal } from '@/shared/ui/Modal';
import { Select, type SelectItem } from '@/shared/ui/Select';
import { SourceParameterControl } from '@/shared/ui/SourceParameterControl';
import { getAvailableReprocessStartSteps } from '../model/sourceProcessing';

type Props = {
  sourceId: SourceId;
  onComplete: () => void;
};

const emptyStepParameters: StepParameters = {
  ingest: [],
  download: [],
  transcribe: [],
  embed: [],
};

export const openReprocessSourceModal = (sourceId: SourceId) => {
  modal.open({
    title: 'Reprocess source',
    closeOnBackdropClick: false,
    children: ({ close }) => <ReprocessSourceModalContent sourceId={sourceId} onComplete={close} />,
  });
};

export const ReprocessSourceModalContent = ({ sourceId, onComplete }: Props) => {
  const {
    data: stepParameters,
    error: stepParametersError,
    isLoading: areStepParametersLoading,
  } = useStepParameters();
  const source = useSourceSnapshot(sourceId);
  const reprocessSource = useReprocessSource(source);
  const resolvedStepParameters = stepParameters ?? emptyStepParameters;
  const { defaults } = useSourceSettings(resolvedStepParameters);
  const hasSource = Boolean(source.id);
  const visibleSteps = useMemo(
    () => (hasSource ? getVisibleSteps(source.kind) : []),
    [hasSource, source.kind]
  );
  const availableStartSteps = useMemo(
    () => (hasSource ? getAvailableReprocessStartSteps(source) : []),
    [hasSource, source]
  );
  const [selectedStartStep, setSelectedStartStep] = useState<Option<StepKey>>(null);
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [params, setParams] = useState<SourceParamsByStep>(() =>
    buildDefaultsByStep(emptyStepParameters)
  );
  const [submitError, setSubmitError] = useState<Option<string>>(null);

  useEffect(() => {
    if (!hasSource) return;
    setSelectedStartStep((current) =>
      current && availableStartSteps.includes(current) ? current : (availableStartSteps[0] ?? null)
    );
    setMediaType(source.mediaType);
  }, [availableStartSteps, hasSource, source.mediaType]);

  useEffect(() => {
    if (!hasSource) return;
    setParams(parseSourceParams(source, resolvedStepParameters, defaults));
  }, [defaults, hasSource, resolvedStepParameters, source]);

  const selectedStep = selectedStartStep ?? availableStartSteps[0] ?? null;
  const reprocessSteps =
    selectedStep && hasSource ? getReprocessSteps(source.kind, selectedStep) : [];
  const isSubmitDisabled =
    !hasSource ||
    !selectedStep ||
    !availableStartSteps.includes(selectedStep) ||
    !reprocessSteps.length;

  const mediaTypeItems = useMemo<SelectItem[]>(
    () => [
      { id: 'video', label: 'video', onClick: () => setMediaType('video') },
      { id: 'audio', label: 'audio', onClick: () => setMediaType('audio') },
    ],
    []
  );

  if (!hasSource) return <div className="min-w-160">Source is not available</div>;
  if (areStepParametersLoading) return <div className="min-w-160">Loading step parameters...</div>;
  if (stepParametersError) return <div className="min-w-160">Failed to load step parameters</div>;

  const handleParamChange = (step: StepKey, key: string, value: unknown) => {
    setParams((current) => ({
      ...current,
      [step]: {
        ...current[step],
        [key]: value,
      },
    }));
  };

  const handleSubmit = () => {
    if (!selectedStep || !reprocessSteps.length) return;

    dialog.open({
      title: 'Confirm reprocessing',
      confirmLabel: 'Start reprocessing',
      cancelLabel: 'Cancel',
      confirmButtonStatus: 'success',
      children: (
        <ReprocessSummary
          title={source.title ?? source.origin ?? 'Untitled source'}
          mediaType={mediaType}
          params={params}
          stepParameters={resolvedStepParameters}
          steps={reprocessSteps}
        />
      ),
      onConfirm: async () => {
        setSubmitError(null);
        try {
          await reprocessSource({
            sourceId,
            startStep: selectedStep,
            mediaType,
            params,
          });
          onComplete();
        } catch (submitError) {
          setSubmitError(
            submitError instanceof Error ? submitError.message : 'Failed to start reprocessing'
          );
        }
      },
    });
  };

  return (
    <div className="flex min-h-0 w-162.5 flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        <div className="text-sm">Choose where to restart the pipeline</div>
        <div className="text-white/60 text-xs">
          Selected step and all subsequent steps will be re-run with the parameters you set
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleSteps.map((step) => {
          const isAvailable = availableStartSteps.includes(step);
          const isSelected = selectedStep === step;
          const isPlanned = reprocessSteps.includes(step);
          return (
            <Button
              key={step}
              status={isAvailable && (isSelected || isPlanned) ? 'success' : 'regular'}
              isDisabled={!isAvailable}
              tooltip={!isAvailable && 'This step currently cannot be re-run for this source'}
              onClick={() => {
                if (!isAvailable) return;
                setSelectedStartStep(step);
              }}
            >
              <StepIndicator step={step} />
              <span className="ml-2">{getLabelByJobKind(step)}</span>
            </Button>
          );
        })}
      </div>
      {!availableStartSteps.length && (
        <div className="rounded-2xl bg-white/5 px-4 py-3 text-white/60 text-xs">
          No available reprocess step is available for this source
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {visibleSteps.map((step) => {
          const stepParams = resolvedStepParameters[step];
          const isDisabled =
            !selectedStep ||
            !availableStartSteps.includes(selectedStep) ||
            isStepDisabled(source.kind, selectedStep, step);

          return (
            <Fragment key={step}>
              {source.kind === 'remote' && step === 'download' && (
                <Select
                  items={mediaTypeItems}
                  selectedId={mediaType}
                  align="end"
                  isDisabled={isDisabled}
                  className="bg-white/5 hover:bg-white/10"
                  renderSelectedItem={(selected) => (
                    <div className="flex items-center gap-1 truncate">
                      <StepIndicator step="download" />
                      <span className="text-white/60">Media Type:</span> {selected?.label}
                    </div>
                  )}
                />
              )}
              {stepParams.map((param) => (
                <SourceParameterControl
                  key={`${step}-${param.key}`}
                  param={param}
                  value={params[step][param.key]}
                  isDisabled={isDisabled}
                  accentColorClassName={getBackgroundColorByJobKind(step)}
                  onChange={(nextValue) => handleParamChange(step, param.key, nextValue)}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
      {submitError && (
        <div className="rounded-2xl bg-red-600/10 px-4 py-3 text-red-300 text-xs">
          {submitError}
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button
          status={isSubmitDisabled ? 'regular' : 'success'}
          isDisabled={isSubmitDisabled}
          isUppercased
          onClick={handleSubmit}
        >
          Reprocess
        </Button>
      </div>
    </div>
  );
};

const StepIndicator = ({ step }: { step: StepKey }) => (
  <span className={clsx('size-3 shrink-0 rounded-full', getBackgroundColorByJobKind(step))} />
);

const ReprocessSummary = ({
  title,
  mediaType,
  params,
  stepParameters,
  steps,
}: {
  title: string;
  mediaType: 'video' | 'audio';
  params: SourceParamsByStep;
  stepParameters: StepParameters;
  steps: StepKey[];
}) => {
  return (
    <div className="flex w-full max-w-120 flex-col gap-3 text-xs">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-500/10 p-3">
          <Icon id="warning" size={32} className="shrink-0 text-amber-500" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="wrap-break-word text-sm leading-tight">
            Source «<b>{title}</b>» will be reprocessed
          </div>
          <div className="text-white/80">
            The following steps will be run with selected parameters:
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(params).map(([step, stepParams]) => {
              if (!steps.includes(step as StepKey)) return null;

              return (
                <div key={step} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm">
                    <StepIndicator step={step as StepKey} />
                    <span>{getLabelByJobKind(step as StepKey)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 py-1">
                    {step === 'download' && <Chip label="Media Type" value={mediaType} />}
                    {Object.entries(stepParams).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={
                          stepParameters[step as StepKey].find((param) => param.key === key)
                            ?.label ?? key
                        }
                        value={String(value)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
