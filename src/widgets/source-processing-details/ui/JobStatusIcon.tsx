import type { JobStatus } from '@/entities/source';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';

type Props = {
  jobStatus: JobStatus;
};

export const JobStatusIcon = ({ jobStatus }: Props) => {
  const iconSize = 16;

  switch (jobStatus) {
    case 'queued':
    case 'cancelling':
      return <Spinner direction="counter-clockwise" size={iconSize - 4} />;
    case 'running':
      return <Spinner direction="clockwise" size={iconSize - 4} />;
    case 'succeeded':
      return <Icon id="check" size={iconSize} />;
    case 'failed':
      return <Icon id="error" size={iconSize} className="text-red-600" />;
    case 'canceled':
      return <Icon id="clear" size={iconSize} className="text-white/50" />;
  }
};
