import { AnimatePresence } from 'motion/react';
import { useSourceSnapshot } from '@/entities/source';
import { CancelProcessingButton, ReprocessSourceButton } from '@/features/manage-source';
import { useSourceId } from '@/features/view-source';
import { Animated } from '@/shared/ui/Animated';

export const SourceControls = () => {
  const sourceId = useSourceId();
  const source = useSourceSnapshot(sourceId);
  const isProcessing = source.status === 'processing';

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isProcessing && (
        <Animated key="cancel">
          <CancelProcessingButton sourceId={source.id} />
        </Animated>
      )}
      {!isProcessing && (
        <Animated key="reprocess">
          <ReprocessSourceButton sourceId={source.id} />
        </Animated>
      )}
    </AnimatePresence>
  );
};
