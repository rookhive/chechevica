import { useCallback } from 'react';
import { type SourceId, useCancelProcessing } from '@/entities/source';
import { dialog } from '@/shared/ui/Dialog';
import { CancelProcessingMessage } from './CancelProcessingMessage';

export const useOpenCancelProcessingDialog = () => {
  const cancelProcessing = useCancelProcessing();

  return useCallback(
    (sourceId: SourceId, onConfirm?: () => void | Promise<void>) => {
      dialog.open({
        title: 'Confirm cancellation',
        confirmLabel: 'Cancel processing',
        cancelLabel: 'Keep running',
        confirmButtonStatus: 'dangerous',
        children: <CancelProcessingMessage sourceId={sourceId} />,
        onConfirm: async () => {
          await cancelProcessing({ sourceId });
          await onConfirm?.();
        },
      });
    },
    [cancelProcessing]
  );
};
