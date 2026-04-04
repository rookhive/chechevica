import { downloadDir } from '@tauri-apps/api/path';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { type PropsWithChildren, type ReactNode, useEffect, useRef, useState } from 'react';
import { useSnapshot } from 'valtio';
import { exportSelectedSegments } from '@/entities/segment/api/api';
import { usePlayer } from '@/features/media-player';
import { useSegmentsStore } from '@/features/view-segments';
import { useSourceId } from '@/features/view-source';
import { Icon, type Props as IconProps } from '@/shared/ui/Icon';
import { RippleEffect } from '@/shared/ui/RippleEffect';
import { Spinner } from '@/shared/ui/Spinner';
import { Tooltip, type Props as TooltipProps } from '@/shared/ui/Tooltip';

export const SegmentsPanel = () => {
  const { isInSelectMode } = useSnapshot(useSegmentsStore().state);

  return (
    <motion.div
      layout="position"
      className="absolute bottom-4 left-1/2 flex h-12.5 min-h-0 -translate-x-1/2 items-center gap-2"
      transition={{ duration: 0.35 }}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div key="playback-sync" layout="position">
          <PlaybackSyncPanel />
        </motion.div>
        {isInSelectMode && (
          <motion.div
            key="selected-segments"
            layout="position"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.35 }}
          >
            <SelectedSegmentsPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const PlaybackSyncPanel = () => {
  const player = usePlayer();
  const { isPlaying } = useSnapshot(player.state);
  const segmentsStore = useSegmentsStore();
  const { isSyncing } = useSnapshot(segmentsStore.state);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Panel>
      <button
        ref={buttonRef}
        type="button"
        className="relative flex cursor-pointer items-center gap-2 rounded-full bg-transparent p-2 text-white transition-colors duration-200 hover:bg-white/10"
        onClick={() => segmentsStore.setIsSyncing(!isSyncing)}
      >
        <RippleEffect ref={buttonRef} />
        <div
          className={clsx(
            'after:-translate-1/2 relative flex items-center after:absolute after:top-1/2 after:left-1/2 after:h-0.5 after:w-[120%] after:-rotate-45 after:rounded-xs after:bg-white after:shadow-[0_0_2px_rgb(0_0_0/35%)] after:transition after:duration-350 after:content-[""]',
            isSyncing ? 'after:scale-120 after:opacity-0' : 'after:scale-100 after:opacity-100'
          )}
        >
          <Icon
            className={clsx(
              'pointer-events-none',
              isPlaying && isSyncing && 'animate-spin [animation-duration:2s]'
            )}
            id="sync"
            size={22}
          />
        </div>
        <span className="w-16.25 whitespace-nowrap text-left text-sm">
          Sync is {isSyncing ? 'on' : 'off'}
        </span>
      </button>
      <Tooltip anchorRef={buttonRef} position="top" status="info">
        Sync active segment with playback
      </Tooltip>
    </Panel>
  );
};

const SelectedSegmentsPanel = () => {
  const segmentsStore = useSegmentsStore();
  const { selectedSegments } = useSnapshot(segmentsStore.state);
  const sourceId = useSourceId();
  const selectionKey = selectedSegments.map((segment) => segment.id).join(',');
  const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [exportedFilePath, setExportedFilePath] = useState<string>();

  useEffect(() => {
    if (downloadState !== 'success' && downloadState !== 'error') return;
    const timeout = setTimeout(() => {
      setDownloadState('idle');
    }, 2000);
    return () => clearTimeout(timeout);
  }, [downloadState]);

  useEffect(() => {
    if (selectionKey == null) return;
    setExportedFilePath(undefined);
  }, [selectionKey]);

  return (
    <Panel>
      <PanelButton
        iconId="clear"
        tooltip={selectedSegments.length && 'Unselect all'}
        onClick={() => segmentsStore.clearSelection()}
      >
        {selectedSegments.length} selected
      </PanelButton>
      <CopySelectedSegmentsTextButton />
      <PanelButton
        iconId="download"
        isError={downloadState === 'error'}
        isSuccess={downloadState === 'success'}
        isLoading={downloadState === 'loading'}
        tooltip={
          downloadState === 'success'
            ? 'Downloaded to Downloads'
            : downloadState === 'error'
              ? 'Export failed'
              : 'Download selected segments as single file'
        }
        tooltipStatus={downloadState === 'error' ? 'dangerous' : 'info'}
        onClick={async () => {
          if (!selectedSegments.length || downloadState === 'loading') return;

          setExportedFilePath(undefined);
          setDownloadState('loading');
          try {
            const result = await exportSelectedSegments({
              sourceId,
              segments: selectedSegments.map((segment) => ({
                start: segment.start,
                end: segment.end,
              })),
            });
            await revealItemInDir(result.path);
            setExportedFilePath(result.path);
            setDownloadState('success');
          } catch {
            setDownloadState('error');
          }
        }}
      />
      <PanelButton
        iconId={exportedFilePath ? 'file-in-folder' : 'folder'}
        tooltip={exportedFilePath ? 'Show downloaded file in folder' : 'Open downloads folder'}
        onClick={async () => {
          try {
            if (exportedFilePath) {
              await revealItemInDir(exportedFilePath);
              return;
            }

            await openPath(await downloadDir());
          } catch {}
        }}
      />
    </Panel>
  );
};

const CopySelectedSegmentsTextButton = () => {
  const { selectedSegments } = useSnapshot(useSegmentsStore().state);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  return (
    <PanelButton
      iconId="copy"
      isSuccess={isCopied}
      tooltip={isCopied ? 'Copied!' : 'Copy selected segments text'}
      tooltipStatus="info"
      onClick={async () => {
        try {
          await writeText(selectedSegments.map((segment) => segment.text).join('\n'));
          setIsCopied(true);
        } catch {}
      }}
    />
  );
};

const Panel = ({ children }: PropsWithChildren) => {
  return <div className="flex items-center rounded-3xl bg-sky-500/95 p-1">{children}</div>;
};

const PanelButton = ({
  children,
  iconId,
  isError = false,
  isSuccess = false,
  isLoading = false,
  tooltip,
  tooltipStatus = 'info',
  onClick,
}: PropsWithChildren<{
  iconId: IconProps['id'];
  isError?: boolean;
  isSuccess?: boolean;
  isLoading?: boolean;
  tooltip?: ReactNode;
  tooltipStatus?: TooltipProps['status'];
  onClick: () => void;
}>) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={clsx(
          'relative rounded-full transition-colors duration-200 hover:bg-white/10',
          isLoading ? 'pointer-events-none' : 'cursor-pointer'
        )}
        onClick={onClick}
        disabled={isLoading}
      >
        <RippleEffect ref={buttonRef} />
        <div
          className={clsx(
            'flex items-center gap-2 bg-transparent p-2 transition-opacity duration-300 ease-linear',
            isLoading && 'opacity-0',
            !!children && 'pr-4'
          )}
        >
          <Icon id={iconId} size={22} className="pointer-events-none shrink-0 text-white" />
          {!!children && <span className={clsx('truncate text-sm')}>{children}</span>}
        </div>
        <AnimatePresence>
          {!isLoading && (isError || isSuccess) && (
            <motion.div
              className={clsx(
                'pointer-events-none absolute inset-0 flex items-center justify-center rounded-full text-white',
                isError ? 'bg-red-500/90' : 'bg-emerald-600/90'
              )}
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.75, opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <Icon id={isError ? 'error' : 'check'} size={20} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="-translate-1/2 pointer-events-none absolute top-1/2 left-1/2 flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Spinner size={16} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      <Tooltip anchorRef={buttonRef} position="top" status={tooltipStatus}>
        {tooltip}
      </Tooltip>
    </>
  );
};
