import { type JobId, useJobSnapshot, useStepParameters } from '@/entities/source';
import { Chip } from '@/shared/ui/Chip';

type Props = {
  jobId: JobId;
};

export const JobParameters = ({ jobId }: Props) => {
  const { data: stepParameters } = useStepParameters();
  const job = useJobSnapshot(jobId);

  if (!stepParameters) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {(stepParameters[job.kind] || []).map((jobParam) => {
        const value = job.params[jobParam.key];
        if (value == null) return null;
        return <Chip key={jobParam.key} label={jobParam.label} value={String(value)} />;
      })}
    </div>
  );
};
