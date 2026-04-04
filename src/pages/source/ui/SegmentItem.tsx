import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { type MouseEvent, type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSnapshot } from 'valtio';
import type { Segment } from '@/entities/segment';
import { type SourceId, useSourceSnapshot } from '@/entities/source';
import { usePlayer } from '@/features/media-player';
import { useSegmentsStore } from '@/features/view-segments';
import { formatSeconds } from '@/shared/lib/time';
import { Button, type Props as ButtonProps } from '@/shared/ui/Button';
import { ExternalLink } from '@/shared/ui/ExternalLink';
import { RippleEffect } from '@/shared/ui/RippleEffect';

type Props = {
  sourceId: SourceId;
  segment: Segment;
};

export const SegmentItem = ({ sourceId, segment }: Props) => {
  const segmentsStore = useSegmentsStore();
  const { selectSegment, selectSegmentsUpTo, unselectSegment } = segmentsStore;
  const source = useSourceSnapshot(sourceId);
  const { isInSelectMode, selectedSegmentIds, activeSegmentId } = useSnapshot(segmentsStore.state);
  const { scrollTo } = usePlayer();
  const segmentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = !!selectedSegmentIds[segment.id];
  const isActive = activeSegmentId === segment.id;
  const isRemoteSource = source.kind === 'remote';

  return (
    <div
      ref={segmentRef}
      key={segment.id}
      className="group/segment-item relative mx-auto flex w-200 min-w-0 max-w-full cursor-pointer items-center self-center px-4 py-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => scrollTo(segment.start)}
    >
      <div
        className={twMerge(
          clsx(
            'pointer-events-none absolute inset-0 scale-85 rounded-2xl bg-emerald-900/50 opacity-0 transition-all duration-500 ease-out will-change-[transform,opacity,scale] contain-strict group-hover/segment-item:scale-100 group-hover/segment-item:opacity-100',
            isActive && 'scale-100 bg-emerald-900/90 opacity-100'
          )
        )}
      >
        <RippleEffect ref={segmentRef} duration={1} color="bg-white/5" />
        {isActive && <CurrentTimeIndicator start={segment.start} end={segment.end} />}
      </div>
      <div className="relative flex min-w-0 grow flex-col gap-2">
        <p className="wrap-break-word text-sm leading-normal">{segment.text}</p>
        <div className="flex items-center gap-2">
          <div className="flex h-5.5 items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-gray-400 text-xs">
            <span>{formatSeconds(segment.start)}</span> - <span>{formatSeconds(segment.end)}</span>
          </div>
          {isRemoteSource && (
            <div className="ml-auto scale-85 opacity-0 transition duration-200 ease-linear group-hover/segment-item:scale-100 group-hover/segment-item:opacity-100">
              <ExternalLink
                iconSize={18}
                // Currently remote sources are Youtube ones only
                href={`${source.origin}&t=${Math.floor(segment.start)}`}
                title="Open this segment on YouTube"
              />
            </div>
          )}
          <AnimatePresence>
            {(isHovered || isInSelectMode) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'linear' }}
                className={clsx(
                  'flex items-center justify-end gap-2',
                  !isRemoteSource && 'ml-auto'
                )}
              >
                <CopySegmentTextButton segment={segment} />
                <SegmentButton
                  iconId="check"
                  iconSize={18}
                  isSelected={isSelected}
                  isHighlighted={isInSelectMode}
                  tooltip={
                    !isSelected &&
                    (isInSelectMode ? 'Shift+Click to select range' : 'Select segment')
                  }
                  onClick={(e) => {
                    if (isSelected) {
                      unselectSegment(segment.id);
                      return;
                    }
                    if (e.shiftKey) {
                      selectSegmentsUpTo(segment.id);
                    } else {
                      selectSegment(segment.id);
                    }
                  }}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </SegmentButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const SegmentButton = ({
  children,
  className,
  isSelected,
  isHighlighted,
  iconId,
  iconSize,
  tooltip,
  tooltipStatus,
  onClick,
}: PropsWithChildren<{
  className?: string;
  isSelected?: boolean;
  isHighlighted?: boolean;
  iconId?: ButtonProps['iconId'];
  iconSize?: ButtonProps['iconSize'];
  tooltip?: ButtonProps['tooltip'];
  tooltipStatus?: ButtonProps['tooltipStatus'];
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}>) => {
  return (
    <Button
      className={clsx(
        'h-5.5 gap-1 rounded-md py-0.5 text-gray-400 opacity-0 outline-none transition duration-500 ease-out group-hover/segment-item:opacity-100',
        isSelected ? 'bg-sky-600 text-white hover:bg-sky-400' : 'bg-white/10 hover:bg-white/20',
        isHighlighted && 'opacity-100!',
        children ? 'px-1 pr-2' : 'size-5.5',
        className
      )}
      iconId={iconId}
      iconSize={iconSize}
      tooltip={tooltip}
      tooltipStatus={tooltipStatus}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {!!children && <span className="font-normal!">{children}</span>}
    </Button>
  );
};

const CopySegmentTextButton = ({ segment }: { segment: Segment }) => {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  return (
    <SegmentButton
      iconId="copy"
      iconSize={14}
      tooltip={isCopied ? 'Copied!' : 'Copy segment text'}
      onClick={async () => {
        try {
          await writeText(segment.text);
          setIsCopied(true);
        } catch {}
      }}
    >
      Copy
    </SegmentButton>
  );
};

const CurrentTimeIndicator = ({ start, end }: { start: number; end: number }) => {
  const player = usePlayer();
  const { currentTime } = useSnapshot(player.state);
  const progress = ((currentTime - start) / (end - start)) * 100;

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 left-0 bg-white/10 duration-300 ease-linear will-change-contents"
      style={{
        width: `${Math.min(Math.max(progress, 0), 100)}%`,
      }}
    />
  );
};
