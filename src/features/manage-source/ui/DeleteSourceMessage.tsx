import { useRef } from 'react';
import { type SourceId, useSourceSnapshot } from '@/entities/source';
import { Icon } from '@/shared/ui/Icon';

type Props = {
  sourceId: SourceId;
};

export const DeleteSourceMessage = ({ sourceId }: Props) => {
  const sourceRef = useRef(useSourceSnapshot(sourceId));
  const source = sourceRef.current;

  if (!source) return null;

  return (
    <div className="flex min-w-100 max-w-150 items-center gap-3 text-xs">
      <div className="rounded-full bg-amber-500/10 p-3">
        <Icon id="warning" size={32} className="shrink-0 text-amber-500" />
      </div>
      <div className="flex w-full min-w-0 flex-col gap-1">
        <span className="wrap-break-word leading-tight">
          Source «<b>{source.title}</b>» will be deleted forever
        </span>
        <span>
          This action <b className="text-red-400">cannot be undone</b>!
        </span>
      </div>
    </div>
  );
};
