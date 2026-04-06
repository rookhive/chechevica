import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSourceArtifact } from '@/entities/artifact';
import { useSourceSnapshot } from '@/entities/source';
import { usePlayer } from '@/features/media-player';
import { SourceThumbnail, useSourceId } from '@/features/view-source';
import { SourcePlayerIndicator } from './SourcePlayerIndicator';
import { SourcePlayerOverlay } from './SourcePlayerOverlay';
import { UnsupportedTypeIndicator } from './UnsupportedTypeIndicator';

export const SourcePlayer = () => {
  const sourceId = useSourceId();
  const source = useSourceSnapshot(sourceId);
  const { artifact } = useSourceArtifact({ sourceId });
  const player = usePlayer();
  const elementRef = useRef<HTMLMediaElement>(null);
  const isAudio = source.mediaType === 'audio';
  const MediaComponent = isAudio ? 'audio' : 'video';
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const hasThumbnail = !!source.thumbnail;

  // biome-ignore lint: it's fine
  useEffect(() => {
    const mediaNode = elementRef.current;
    if (!artifact || !mediaNode || isAudio) return;
    const handlePlay = () => {
      setHasStartedPlaying(true);
    };
    mediaNode?.addEventListener('play', handlePlay, { once: true });
    return () => mediaNode?.removeEventListener('play', handlePlay);
  }, [artifact?.path, isAudio]);

  // biome-ignore lint: it's fine
  useEffect(() => {
    if (!artifact || !elementRef.current) return;
    player.setMediaElement(elementRef.current);
    return () => {
      player.resetState();
      setHasStartedPlaying(false);
    };
  }, [artifact?.path, artifact?.mimeType, player]);

  return (
    <div
      className={twMerge(
        clsx(
          'relative aspect-video h-full overflow-hidden rounded-2xl ring-1 ring-neutral-800/60 lg:h-auto lg:w-full',
          isAudio && !hasThumbnail && 'w-full lg:h-45'
        )
      )}
    >
      {!hasStartedPlaying && (
        <div className="absolute inset-0">
          <SourceThumbnail iconSize={80} />
        </div>
      )}
      {!!artifact && artifact.path && (
        <>
          <MediaComponent
            key={artifact.path}
            // @ts-expect-error: very strange error which should not happen, ref is valid here
            ref={elementRef}
            className={clsx(
              'relative h-full w-full rounded-2xl',
              !hasStartedPlaying && 'invisible'
            )}
            src={convertFileSrc(artifact.path)}
            controls={false}
            autoPlay={false}
          />
          <SourcePlayerIndicator />
          <SourcePlayerOverlay />
        </>
      )}
      {!!artifact && <UnsupportedTypeIndicator />}
    </div>
  );
};
