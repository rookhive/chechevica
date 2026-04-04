import { motion } from 'motion/react';
import type { StepParameters } from '@/shared/contract/StepParameters';
import { Button } from '@/shared/ui/Button';
import { ExternalLink } from '@/shared/ui/ExternalLink';
import { Icon } from '@/shared/ui/Icon';
import type { ImportStore } from '../model/importStore';
import type { ImportItem } from '../model/types';
import { SourceParameterControls } from './SourceParameterControls';

export const SourceLoaderItem = ({
  item,
  store,
  stepParameters,
}: {
  item: ImportItem;
  store: ImportStore;
  stepParameters: StepParameters;
}) => {
  const isLocal = item.kind === 'local';

  return (
    <motion.div
      className="group"
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex w-160 min-w-0 flex-col gap-2 rounded-3xl p-3 transition-colors ease-linear hover:bg-white/7.5 group-odd:bg-white/5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            id={isLocal ? 'video' : 'youtube'}
            size={18}
            className="size-9 shrink-0 rounded-full border border-white/10 border-dashed p-2"
          />
          <div className="min-w-0 text-sm">{item.label}</div>
          {!isLocal && <ExternalLink href={item.origin} title="Open on YouTube" />}
          <Button
            className="ml-auto shrink-0"
            iconId="trash"
            iconSize={18}
            tooltip="Remove source"
            tooltipPosition="top"
            onClick={() => store.removeSelectedSource(item.id)}
          />
        </div>
        <SourceParameterControls item={item} store={store} stepParameters={stepParameters} />
      </div>
    </motion.div>
  );
};
