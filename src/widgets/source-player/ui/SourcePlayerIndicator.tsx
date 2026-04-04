import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { useSourceSnapshot } from '@/entities/source';
import { usePlayer } from '@/features/media-player';
import { useSourceId } from '@/features/view-source';

export const SourcePlayerIndicator = () => {
  const { status } = useSourceSnapshot(useSourceId());
  const { isPlaying } = useSnapshot(usePlayer().state);
  const isProcessing = status === 'processing';

  const scales = useMemo(
    () => [
      [0.9, 0.4, 1, 0.5, 0.75],
      [0.45, 1, 0.35, 0.85, 0.55],
      [0.35, 0.8, 0.55, 1, 0.4],
    ],
    []
  );

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div
          className={clsx(
            'absolute right-2 flex items-end gap-1.25 rounded-xl bg-black/75 px-2.5 py-2',
            isProcessing ? 'bottom-8' : 'bottom-2'
          )}
          layout="position"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.35, ease: 'easeIn' }}
        >
          {scales.map((scaleY, i) => (
            <motion.span
              key={i}
              className="h-2.5 w-0.5 origin-bottom rounded-t-full bg-white/90 will-change-transform"
              initial={{ scaleY: scaleY[0] }}
              animate={{ scaleY }}
              transition={{
                ease: 'easeInOut',
                duration: 1 + i * 0.2,
                delay: i * 0.2,
                repeat: Infinity,
                repeatType: 'mirror',
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
