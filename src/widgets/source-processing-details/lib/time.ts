import type { Job } from '@/entities/source';
import { formatDuration } from '@/shared/lib/time';

export const formatCompletedDuration = (job: Job) => {
  if (!job.finishedAt || !job.startedAt) return null;

  const completedIn = Math.floor(job.finishedAt.getTime() - job.startedAt.getTime());

  if (
    !job.readyAt ||
    (job.kind !== 'transcribe' && job.kind !== 'embed') ||
    // Don't show prepared/executed details if the model was prepared in less than a second
    job.readyAt.getTime() - job.startedAt.getTime() < 1000
  ) {
    return `Completed in ${formatDuration(completedIn)}`;
  }

  const preparedIn = Math.floor(job.readyAt.getTime() - job.startedAt.getTime());
  const executedIn = Math.floor(job.finishedAt.getTime() - job.readyAt.getTime());
  const action = job.kind === 'transcribe' ? 'transcribed' : 'embedded';

  return `Completed in ${formatDuration(completedIn)} (model prepared in ${formatDuration(
    preparedIn
  )}, ${action} in ${formatDuration(executedIn)})`;
};
