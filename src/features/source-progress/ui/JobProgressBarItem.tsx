import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { twMerge } from 'tailwind-merge';
import { getBackgroundColorByJobKind, type JobId, useJobSnapshot } from '@/entities/source';
import { Icon } from '@/shared/ui/Icon';

type Props = {
  jobId: JobId;
  isFirst?: boolean;
  isLast?: boolean;
};

export const JobProgressBarItem = ({ jobId, isFirst, isLast }: Props) => {
  const job = useJobSnapshot(jobId);

  if (!job) return null;

  const isError = job.status === 'failed';
  const isCanceled = job.status === 'canceled';

  const backgroundColor = isCanceled
    ? 'bg-white/35'
    : isError
      ? 'bg-red-600'
      : getBackgroundColorByJobKind(job.kind);

  return (
    <div
      key={job.id}
      className={twMerge(
        clsx('absolute inset-0 flex', !isFirst && '-left-2', !isLast && '-right-2')
      )}
    >
      <div
        className="flex grow self-stretch transition-[clip-path] duration-350"
        style={{ clipPath: `inset(0 ${100 - job.progress}% 0 0)` }}
      >
        <div
          className={clsx(
            'skewed grow',
            backgroundColor,
            isFirst && 'skewed-first',
            isLast && 'skewed-last'
          )}
        >
          <AnimatePresence>
            {job.status === 'running' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={clsx('absolute inset-0 animate-stripes bg-stripes', backgroundColor)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      <div
        className={clsx(
          'absolute top-1/2 flex shrink-0 -translate-y-1/2 items-center justify-center text-white opacity-0 transition-opacity duration-750',
          job && job.status === 'succeeded' ? 'opacity-100' : 'opacity-0',
          isFirst ? 'left-1.5' : 'left-3.5'
        )}
      >
        <Icon id="check" size={13} />
      </div>
    </div>
  );
};
