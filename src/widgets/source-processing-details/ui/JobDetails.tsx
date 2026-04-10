import clsx from 'clsx';
import { motion } from 'motion/react';
import {
  getBackgroundColorByJobKind,
  getLabelByJobKind,
  getTextColorByJobKind,
  type JobId,
  useJobSnapshot,
} from '@/entities/source';
import { Animated } from '@/shared/ui/Animated';
import { formatCompletedDuration } from '../lib/time';
import { JobParameters } from './JobParameters';
import { JobStatusIcon } from './JobStatusIcon';

type Props = {
  jobId: JobId;
};

export const JobDetails = ({ jobId }: Props) => {
  const job = useJobSnapshot(jobId);
  const label = getLabelByJobKind(job.kind);
  const textColor = getTextColorByJobKind(job.kind);
  const backgroundColor = getBackgroundColorByJobKind(job.kind);
  const isQueued = job.status === 'queued';
  const isRunning = job.status === 'running';
  const isFailed = job.status === 'failed';
  const isCanceled = job.status === 'canceled';
  const isCancelling = job.status === 'cancelling';
  const isSucceeded = job.status === 'succeeded';
  const isPreparing =
    isRunning && !job.readyAt && (job.kind === 'transcribe' || job.kind === 'embed');
  const completedDuration = isSucceeded ? formatCompletedDuration(job) : null;

  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center">
        <Animated className="flex gap-2">
          <div
            className={clsx(
              'flex size-4.5 shrink-0 items-center justify-center rounded-full',
              isSucceeded ? 'text-white' : isQueued || isCancelling ? 'text-white/40' : textColor,
              isSucceeded ? backgroundColor : isFailed ? 'bg-red-600/30' : 'bg-white/10'
            )}
          >
            <JobStatusIcon jobStatus={job.status} />
          </div>
        </Animated>
        <div
          className={clsx(
            'w-0 border-white/15 border-r border-dashed transition-[height] duration-1000 ease-in-out',
            isSucceeded ? 'h-full' : 'h-0'
          )}
        />
      </div>
      <div>
        <Animated className="flex items-center gap-2 text-sm">{label}</Animated>
        <motion.div
          layout="preserve-aspect"
          className="flex flex-col gap-1.5 py-1 pb-2.5 text-white/40 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          {completedDuration && <span className="text-white/60 text-xs">{completedDuration}</span>}
          {isPreparing && <span className="text-white/60 text-xs">Model is preparing...</span>}
          {isRunning && !isPreparing && <span className="text-white/60 text-xs">Running...</span>}
          {isQueued && <span className="text-white/60 text-xs">Queued...</span>}
          {isFailed && <span className="text-red-600">Job failed miserably</span>}
          {isCanceled && <span className="text-yellow-500">Job was canceled</span>}
          {isCancelling && <span className="text-yellow-600">Job is cancelling..</span>}
          <Animated>
            <JobParameters jobId={jobId} />
          </Animated>
        </motion.div>
      </div>
    </div>
  );
};
