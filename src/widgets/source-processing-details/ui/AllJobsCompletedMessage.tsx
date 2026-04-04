import clsx from 'clsx';
import {
  getTextColorByJobKind,
  type JobKind,
  useJobSnapshot,
  useSourceSnapshot,
} from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import { formatDuration } from '@/shared/lib/time';
import { Icon } from '@/shared/ui/Icon';

export const AllJobsCompletedMessage = () => {
  const source = useSourceSnapshot(useSourceId());
  const ingestJobId = source.kind === 'remote' ? source.downloadJobId : source.ingestJobId;
  const totalDuration = [
    useJobSnapshot(ingestJobId!),
    useJobSnapshot(source.transcribeJobId!),
    useJobSnapshot(source.embedJobId!),
  ].reduce((total, job) => {
    const effectiveStartedAt = job.readyAt || job.startedAt;
    if (job.finishedAt && effectiveStartedAt) {
      return total + (job.finishedAt.getTime() - effectiveStartedAt.getTime());
    }
    return total;
  }, 0);

  return (
    <div className="-ml-1.25 inline-flex items-center gap-2 rounded-4xl bg-emerald-900/50 p-1 pr-3 pl-1.25">
      <div
        className={clsx(
          'flex size-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-emerald-400',
          getTextColorByJobKind('succeeded' as JobKind)
        )}
      >
        <Icon id="check" size={16} />
      </div>
      <span className="text-emerald-300 text-xs">Completed in {formatDuration(totalDuration)}</span>
    </div>
  );
};
