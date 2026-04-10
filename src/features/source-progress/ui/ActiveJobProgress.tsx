import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import {
  getLabelByJobKind,
  getTextColorByJobKind,
  type JobId,
  useJobSnapshot,
  useSourceSnapshot,
} from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';

export const ActiveJobProgress = () => {
  const source = useSourceSnapshot(useSourceId());
  const jobIds = [
    source.ingestJobId,
    source.downloadJobId,
    source.transcribeJobId,
    source.embedJobId,
  ];

  return (
    <div className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1">
      <AnimatePresence>
        {jobIds
          .filter(Boolean)
          .reverse()
          .map((jobId) => (
            <JobProgress key={jobId} jobId={jobId!} />
          ))}
      </AnimatePresence>
    </div>
  );
};

const JobProgress = ({ jobId }: { jobId: JobId }) => {
  const job = useJobSnapshot(jobId);
  const isQueued = job.status === 'queued';
  const isRunning = job.status === 'running';
  const isPreparing =
    isRunning && !job.readyAt && (job.kind === 'transcribe' || job.kind === 'embed');
  const isSucceeded = job.status === 'succeeded';
  const isFailed = job.status === 'failed';
  const isCancelling = job.status === 'cancelling';
  const isCanceled = job.status === 'canceled';

  return (
    <motion.div
      key={job.id}
      layout="preserve-aspect"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex h-8 items-center gap-2 overflow-hidden rounded-2xl bg-black/75 pr-1 pl-2 text-xs"
    >
      <div
        className={clsx(
          'flex items-center',
          isQueued || isCancelling ? 'opacity-35' : getTextColorByJobKind(job.kind)
        )}
      >
        {(isRunning || isQueued || isCancelling) && (
          <Spinner direction={isRunning ? 'clockwise' : 'counter-clockwise'} size={16} />
        )}
        {isSucceeded && <Icon id="check" size={16} />}
        {isFailed && <Icon id="error" size={16} className="text-red-600" />}
        {isCanceled && <Icon id="clear" size={16} className="text-white/50" />}
      </div>
      <span className={clsx('whitespace-nowrap', (isPreparing || !isRunning) && 'pr-2')}>
        {getLabelByJobKind(job.kind)}
        {isRunning && '...'}
        {isQueued && ' queued'}
        {isFailed && ' failed'}
        {isCancelling && ' cancelling'}
        {isCanceled && ' canceled'}
      </span>
      {isRunning && !isPreparing && (
        <span className="rounded-full bg-white/5 px-2 py-1">{job.progress || 0}%</span>
      )}
    </motion.div>
  );
};
