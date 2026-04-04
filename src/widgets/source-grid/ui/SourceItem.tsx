import { motion } from 'motion/react';
import { memo, useMemo, useRef } from 'react';
import { Link } from 'wouter';
import { type SourceId, useSourceSnapshot } from '@/entities/source';
import {
  useCancelProcessingMenuItem,
  useDeleteSourceMenuItem,
  useReprocessSourceMenuItem,
} from '@/features/manage-source';
import { openInNewTabMenuItem } from '@/features/manage-tabs';
import { SourceProgressOverlay } from '@/features/source-progress';
import { SourceProvider, SourceThumbnail, useSourceId } from '@/features/view-source';
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu';
import { Icon } from '@/shared/ui/Icon';
import { LiveTimeDistance } from '@/shared/ui/LiveTimeDistance';
import { SourceDurationBadge } from './SourceDurationBadge';

type Props = {
  sourceId: SourceId;
};

export const SourceItem = memo(({ sourceId }: Props) => {
  const source = useSourceSnapshot(sourceId);
  const containerRef = useRef<HTMLDivElement>(null);
  const deleteSourceMenuItem = useDeleteSourceMenuItem(sourceId);
  const cancelProcessingMenuItem = useCancelProcessingMenuItem(sourceId);
  const reprocessSourceMenuItem = useReprocessSourceMenuItem(sourceId);
  const isProcessing = source.status === 'processing';
  const isSucceeded = source.status === 'succeeded';
  const href = `/source/${sourceId}`;

  const contextMenuItems = useMemo<ContextMenuItem[]>(
    () =>
      isProcessing
        ? [openInNewTabMenuItem(href), cancelProcessingMenuItem]
        : [openInNewTabMenuItem(href), reprocessSourceMenuItem, deleteSourceMenuItem],
    [href, isProcessing, cancelProcessingMenuItem, deleteSourceMenuItem, reprocessSourceMenuItem]
  );

  return (
    <SourceProvider value={sourceId}>
      <motion.div
        ref={containerRef}
        className="will-change-[transform,opacity]"
        layout="position"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="group/source-item relative aspect-video w-full">
          <div className="pointer-events-none absolute -inset-2 scale-85 rounded-t-3xl rounded-b-2xl bg-emerald-900/75 opacity-0 transition-[transform,opacity,scale] duration-350 will-change-[transform,opacity,scale] contain-strict content-[''] group-hover/source-item:scale-100 group-hover/source-item:opacity-100" />
          <Link href={href} className="group relative z-10">
            <SourceThumbnail>
              <SourceProgressOverlay />
              {isSucceeded && <SourceDurationBadge />}
            </SourceThumbnail>
            <SourceMetadata />
          </Link>
        </div>
      </motion.div>
      <ContextMenu anchor={containerRef} items={contextMenuItems} />
    </SourceProvider>
  );
});

const SourceMetadata = () => {
  const source = useSourceSnapshot(useSourceId());

  if (!source.title) return null;

  return (
    <div className="flex flex-col gap-0.5 p-2 pb-1">
      <h2 className="relative truncate text-base leading-6">{source.title}</h2>
      <div className="flex items-center gap-2 text-white/35 text-xs transition-colors duration-300 ease-linear group-hover:text-white/70">
        {source.originCreatedAt && (
          <div className="flex items-center gap-1 truncate">
            {source.kind === 'remote' ? (
              <>
                <Icon className="shrink-0" id="youtube" size={14} /> Published
              </>
            ) : (
              'Created'
            )}{' '}
            <LiveTimeDistance date={source.originCreatedAt} />
          </div>
        )}
        <span>·</span>
        <span className="truncate">
          Imported <LiveTimeDistance date={source.createdAt} />
        </span>
      </div>
    </div>
  );
};
