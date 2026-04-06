import { AnimatePresence } from 'motion/react';
import { useMemo, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { useSourceArtifact } from '@/entities/artifact';
import { useSourceSnapshot } from '@/entities/source';
import { usePlayer } from '@/features/media-player';
import { useSourceId } from '@/features/view-source';
import { Animated } from '@/shared/ui/Animated';
import { Icon } from '@/shared/ui/Icon';
import { Tooltip } from '@/shared/ui/Tooltip';

export const UnsupportedTypeIndicator = () => {
  const sourceId = useSourceId();
  const source = useSourceSnapshot(sourceId);
  const { artifact } = useSourceArtifact({ sourceId });
  const iconRef = useRef<HTMLDivElement>(null);
  const player = usePlayer();
  const { isPlaying } = useSnapshot(player.state);

  const isSupportedType = useMemo(() => {
    if (!artifact?.mimeType) return true;
    const mediaElement = document.createElement(source.mediaType);
    const canPlay = mediaElement.canPlayType(artifact.mimeType);
    return canPlay === 'probably' || canPlay === 'maybe';
  }, [artifact, source]);

  return (
    <AnimatePresence mode="wait">
      {!isPlaying && !isSupportedType && (
        <Animated>
          <div
            ref={iconRef}
            className="absolute top-2 right-2 z-50 flex size-10 items-center justify-center rounded-full bg-black/70 backdrop-blur-lg"
          >
            <Icon id="warning" size={22} className="text-yellow-500" />
          </div>
          <Tooltip anchorRef={iconRef} position="bottom" status="warning">
            <span className="block text-center">
              This {source.mediaType} format is not fully supported
              <br />
              and may not play correctly
            </span>
          </Tooltip>
        </Animated>
      )}
    </AnimatePresence>
  );
};
