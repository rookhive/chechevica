import clsx from 'clsx';
import { useMemo } from 'react';
import { getBackgroundColorByJobKind } from '@/entities/source';
import type { StepParameters } from '@/shared/contract/StepParameters';
import { Select, type SelectItem } from '@/shared/ui/Select';
import { SourceParameterControl } from '@/shared/ui/SourceParameterControl';
import type { ImportStore } from '../model/importStore';
import type { ImportItem } from '../model/types';

type Props = {
  item: ImportItem;
  store: ImportStore;
  stepParameters: StepParameters;
};

export const SourceParameterControls = ({ item, store, stepParameters }: Props) => {
  const mediaTypeItems = useMemo<SelectItem[]>(
    () => [
      { id: 'video', label: 'video', onClick: () => store.setRemoteMediaType(item.id, 'video') },
      { id: 'audio', label: 'audio', onClick: () => store.setRemoteMediaType(item.id, 'audio') },
    ],
    [item.id, store]
  );

  const visibleSteps = (['ingest', 'download', 'transcribe', 'embed'] as const).filter((step) =>
    item.kind === 'local' ? step !== 'download' : step !== 'ingest'
  );

  const stepConfig = {
    ingest: stepParameters.ingest,
    download: stepParameters.download,
    transcribe: stepParameters.transcribe,
    embed: stepParameters.embed,
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {item.kind === 'remote' && (
        <Select
          items={mediaTypeItems}
          selectedId={item.mediaType}
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
      {visibleSteps.flatMap((step) =>
        stepConfig[step].map((param) => (
          <SourceParameterControl
            key={`${item.id}-${step}-${param.key}`}
            param={param}
            value={item.params[step][param.key]}
            accentColorClassName={getBackgroundColorByJobKind(step)}
            onChange={(nextValue) => store.setSourceParam(item.id, step, param.key, nextValue)}
          />
        ))
      )}
    </div>
  );
};
