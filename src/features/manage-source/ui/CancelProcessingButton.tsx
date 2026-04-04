import type { SourceId } from '@/entities/source';
import { Button } from '@/shared/ui/Button';
import { useOpenCancelProcessingDialog } from './CancelProcessingDialog';

type Props = {
  sourceId: SourceId;
};

export const CancelProcessingButton = ({ sourceId }: Props) => {
  const openCancelProcessingDialog = useOpenCancelProcessingDialog();

  return (
    <Button
      iconId="clear"
      iconSize={20}
      status="dangerous"
      isUppercased
      tooltip="Cancel processing"
      tooltipStatus="dangerous"
      onClick={() => openCancelProcessingDialog(sourceId)}
    >
      Cancel
    </Button>
  );
};
