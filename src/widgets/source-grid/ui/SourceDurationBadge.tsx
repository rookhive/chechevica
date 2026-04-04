import { motion } from 'motion/react';
import { useSourceSnapshot } from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import { formatSeconds } from '@/shared/lib/time';
import { Icon } from '@/shared/ui/Icon';

export const SourceDurationBadge = () => {
  const source = useSourceSnapshot(useSourceId());

  return (
    !!source.duration && (
      <motion.div
        className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-lg bg-black/75 px-2 py-1 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.75 }}
      >
        {source.mediaType === 'audio' && <Icon id="audio" size={14} />}
        <span>{formatSeconds(source.duration)}</span>
      </motion.div>
    )
  );
};
