import { AnimatePresence } from 'motion/react';
import { useMemo } from 'react';
import { mutate } from 'swr';
import type { ProjectId } from '@/entities/project';
import { useSourceSettings, useStepParameters } from '@/entities/source';
import type { StepParameters } from '@/shared/contract/StepParameters';
import { Animated } from '@/shared/ui/Animated';
import { Button } from '@/shared/ui/Button';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { createImportStore } from '../model/importStore';
import { useSourceImportStore } from './hooks';
import { RemoteLoaderModal } from './RemoteLoaderModal';
import { SourceImportButtons } from './SourceImportButtons';
import { SourceLoaderItem } from './SourceLoaderItem';

type Props = {
  projectId: ProjectId;
  onComplete: () => void;
};

const emptyStepParameters: StepParameters = {
  ingest: [],
  download: [],
  transcribe: [],
  embed: [],
};

export const SourceLoader = ({ projectId, onComplete }: Props) => {
  const { data: stepParameters, error } = useStepParameters();
  const resolvedStepParameters = stepParameters ?? emptyStepParameters;
  const { defaults, remoteSourceMediaType } = useSourceSettings(resolvedStepParameters);
  const store = useMemo(
    () => createImportStore(resolvedStepParameters, defaults, remoteSourceMediaType),
    [defaults, remoteSourceMediaType, resolvedStepParameters]
  );
  const { selectedSources, isImporting } = useSourceImportStore(store);
  const hasSelectedSources = selectedSources.length > 0;
  const isInvalid = !selectedSources.length || isImporting;

  if (error) {
    return (
      <StatusMessage status="warning" iconId="warning">
        Failed to load step parameters
      </StatusMessage>
    );
  }

  const handleImportSources = async () => {
    await store.importSelectedSources(projectId);
    onComplete();
    mutate(['sources', projectId]);
  };

  return (
    <div className="-mx-3 flex flex-col gap-3">
      <div className="scrollable flex min-h-35 items-center justify-center pb-0">
        <div className="flex w-full flex-col gap-1 self-start">
          <AnimatePresence mode="popLayout">
            {selectedSources.map((item) => (
              <SourceLoaderItem
                key={item.id}
                item={item}
                store={store}
                stepParameters={resolvedStepParameters}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {!hasSelectedSources && (
          <StatusMessage status="regular" iconId="collection" iconSize={24}>
            <span className="whitespace-nowrap text-sm opacity-80">No sources selected</span>
          </StatusMessage>
        )}
      </AnimatePresence>
      <div className="relative px-3">
        <SourceImportButtons store={store} />
        <AnimatePresence>
          {hasSelectedSources && (
            <Animated className="absolute right-3 bottom-0">
              <Button
                className="ml-auto"
                status={isInvalid ? 'regular' : 'success'}
                isDisabled={isInvalid}
                isUppercased
                onClick={handleImportSources}
              >
                Import selected sources
              </Button>
            </Animated>
          )}
        </AnimatePresence>
      </div>
      <RemoteLoaderModal store={store} />
    </div>
  );
};
