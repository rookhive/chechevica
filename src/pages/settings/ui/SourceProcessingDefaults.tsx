import clsx from 'clsx';
import { Fragment } from 'react';
import {
  allSteps,
  getBackgroundColorByJobKind,
  setRemoteSourceMediaType,
  setSourceParam,
  useSourceSettings,
  useStepParameters,
} from '@/entities/source';
import type { StepParameters } from '@/shared/contract/StepParameters';
import { Select, type SelectItem } from '@/shared/ui/Select';
import { SourceParameterControl } from '@/shared/ui/SourceParameterControl';
import { Spinner } from '@/shared/ui/Spinner';
import { ResetSettingsButton } from './ResetSettingsButton';

const emptyStepParameters: StepParameters = {
  ingest: [],
  download: [],
  transcribe: [],
  embed: [],
};

export const SourceProcessingDefaults = () => {
  const { data: stepParameters, error, isLoading } = useStepParameters();
  const resolvedStepParameters = stepParameters ?? emptyStepParameters;
  const { defaults, remoteSourceMediaType } = useSourceSettings(resolvedStepParameters);

  const remoteMediaTypeItems: SelectItem[] = [
    { id: 'video', label: 'video', onClick: () => setRemoteSourceMediaType('video') },
    { id: 'audio', label: 'audio', onClick: () => setRemoteSourceMediaType('audio') },
  ];

  if (isLoading) return <Spinner />;
  if (error) return null;

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex w-full flex-wrap gap-1">
        {allSteps.map((step) => {
          const stepParams = resolvedStepParameters[step];

          return (
            <Fragment key={step}>
              {step === 'download' && (
                <Select
                  items={remoteMediaTypeItems}
                  selectedId={remoteSourceMediaType}
                  align="end"
                  className="bg-white/5 hover:bg-white/10"
                  renderSelectedItem={(selected) => (
                    <div className="flex items-center gap-1 truncate">
                      <span
                        className={clsx(
                          'mr-1 size-3 shrink-0 rounded-full',
                          getBackgroundColorByJobKind('download')
                        )}
                      />
                      <span className="text-white/60">Media Type:</span> {selected?.label}
                    </div>
                  )}
                />
              )}
              {stepParams.map((param) => (
                <SourceParameterControl
                  key={`${step}-${param.key}`}
                  param={param}
                  value={defaults[step][param.key]}
                  accentColorClassName={getBackgroundColorByJobKind(step)}
                  onChange={(nextValue) => setSourceParam(step, param.key, nextValue)}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
      <ResetSettingsButton />
    </div>
  );
};
