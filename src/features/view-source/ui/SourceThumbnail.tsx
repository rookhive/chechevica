import type { PropsWithChildren } from 'react';
import { useSourceSnapshot } from '@/entities/source';
import { Thumbnail } from '@/shared/ui/Thumbnail';
import { useSourceId } from './hooks';

type Props = {
  iconSize?: number;
};

export const SourceThumbnail = ({ children, iconSize }: PropsWithChildren<Props>) => {
  const source = useSourceSnapshot(useSourceId());

  return (
    <div className="relative size-full overflow-hidden rounded-2xl ring-1 ring-neutral-800/60">
      <div className="absolute inset-0 transition-transform duration-600 ease-out group-hover:scale-110">
        <Thumbnail
          path={source.thumbnail}
          iconId={source.kind === 'remote' ? 'youtube' : source.mediaType}
          iconSize={iconSize ?? 48}
        />
      </div>
      {children}
    </div>
  );
};
