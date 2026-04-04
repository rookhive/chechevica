import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { useTab } from '@/features/manage-tabs';
import { usePlayer } from '@/features/media-player';
import type { Option } from '@/shared/types/common';
import { Icon } from '@/shared/ui/Icon';

export const SourcePlayerOverlay = () => {
  const player = usePlayer();
  const snap = useSnapshot(player.state);
  const { setIsPlayingMedia } = useTab();
  const [overlayType, setOverlayType] = useState<Option<'play' | 'pause'>>(null);
  const hideTimeoutRef = useRef<Option<ReturnType<typeof setTimeout>>>(null);
  const prevIsPlayingRef = useRef<Option<boolean>>(null);

  useEffect(() => {
    setIsPlayingMedia(snap.isPlaying);
    if (prevIsPlayingRef.current === null) {
      prevIsPlayingRef.current = snap.isPlaying;
      return;
    }
    if (prevIsPlayingRef.current === snap.isPlaying) return;
    prevIsPlayingRef.current = snap.isPlaying;

    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setOverlayType(snap.isPlaying ? 'play' : 'pause');
    hideTimeoutRef.current = setTimeout(() => setOverlayType(null), 1000);
    return () => {
      setIsPlayingMedia(false);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [snap.isPlaying, setIsPlayingMedia]);

  const handleClick = () => {
    snap.isPlaying ? player.pause() : player.play();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center" onClick={handleClick}>
      <AnimatePresence initial={false}>
        {overlayType && (
          <motion.div
            key={overlayType}
            className="-translate-1/2 pointer-events-none absolute top-1/2 left-1/2 flex items-center justify-center rounded-full bg-black/75 p-5"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <Icon id={overlayType} size={64} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
