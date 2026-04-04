import type { SourceId } from '@/entities/source';
import { Button } from '@/shared/ui/Button';
import { openReprocessSourceModal } from './ReprocessSourceModal';

type Props = {
  sourceId: SourceId;
};

export const ReprocessSourceButton = ({ sourceId }: Props) => {
  return (
    <Button
      iconId="restart"
      iconSize={20}
      status="regular"
      isUppercased
      tooltip="Reprocess source"
      onClick={() => openReprocessSourceModal(sourceId)}
    >
      Reprocess
    </Button>
  );
};
