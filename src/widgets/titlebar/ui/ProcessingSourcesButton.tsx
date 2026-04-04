import clsx from 'clsx';
import { useMemo, useRef } from 'react';
import { Link } from 'wouter';
import { useFetchProcessingSources, useProcessingSourcesSummary } from '@/entities/source';
import { navigateTo, openInNewTabMenuItem } from '@/features/manage-tabs';
import { Button } from '@/shared/ui/Button';

const getTooltip = (processingCount: number, actionableCount: number) => {
  const result =
    processingCount > 0
      ? processingCount === 1
        ? '1 source is processing'
        : `${processingCount} sources are processing`
      : actionableCount > 0
        ? actionableCount === 1
          ? '1 source needs attention'
          : `${actionableCount} sources need attention`
        : 'All completed';

  return `Processing sources (${result})`;
};

export const ProcessingSourcesButton = () => {
  useFetchProcessingSources();

  return <ProcessingSourcesIndicator />;
};

const ProcessingSourcesIndicator = () => {
  const { processingCount, actionableCount } = useProcessingSourcesSummary();
  const wrapperRef = useRef<HTMLButtonElement>(null);
  const isWorking = processingCount > 0;
  const hasFailed = actionableCount > 0;
  const tooltip = getTooltip(processingCount, actionableCount);
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem('/processing-sources')], []);

  return (
    <Link href="/processing-sources" className="text-[0px]">
      <Button
        ref={wrapperRef}
        className={clsx(
          'size-10 shrink-0',
          isWorking
            ? 'bg-sky-500 hover:bg-sky-400'
            : hasFailed
              ? 'bg-red-700/20 text-red-400 hover:bg-red-700/40'
              : 'bg-emerald-700/20 text-emerald-400 hover:bg-emerald-700/40'
        )}
        isLoading={isWorking}
        isDisabledWhileLoading={false}
        iconId={!isWorking ? (hasFailed ? 'warning' : 'check') : undefined}
        iconSize={20}
        tooltip={tooltip}
        tooltipPosition="bottom"
        tooltipStatus={isWorking ? 'info' : hasFailed ? 'dangerous' : 'success'}
        contextMenuItems={contextMenuItems}
        onClick={() => navigateTo('/processing-sources')}
      />
    </Link>
  );
};
