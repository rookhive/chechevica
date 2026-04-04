import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useSourceSnapshot } from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import Success from '@/shared/ui/Success';
import { ActiveJobProgress } from './ActiveJobProgress';
import { JobProgressBar } from './JobProgressBar';

export const SourceProgressOverlay = () => {
  const source = useSourceSnapshot(useSourceId());
  const [isJustSucceeded, setIsJustSucceeded] = useState(false);
  const previousStatusRef = useRef(source.status);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    if (previousStatus !== 'succeeded' && source.status === 'succeeded') {
      setIsJustSucceeded(true);
    } else if (previousStatus === 'succeeded' && source.status !== 'succeeded') {
      setIsJustSucceeded(false);
    }
    previousStatusRef.current = source.status;
  }, [source.status]);

  return (
    <AnimatePresence mode="wait">
      {isJustSucceeded ? (
        <Success />
      ) : (
        source.status !== 'succeeded' && (
          <motion.div
            key="source-progress"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0">
              <ActiveJobProgress />
              <JobProgressBar />
            </div>
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
};
