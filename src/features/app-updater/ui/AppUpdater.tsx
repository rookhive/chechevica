import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import { useEffect, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Animated } from '@/shared/ui/Animated';
import { Icon, type Props as IconProps } from '@/shared/ui/Icon';
import { RippleEffect } from '@/shared/ui/RippleEffect';
import { Spinner } from '@/shared/ui/Spinner';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { UpdateStatus } from '../model/types';
import { checkForUpdates, downloadAndInstallUpdate } from '../model/updaterStore';
import { useUpdater } from './hooks';
import { UpdateDownloadProgress } from './UpdateDownloadProgress';

export const AppUpdater = () => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const { status, availableUpdate } = useUpdater();
  const iconId = getIconByStatus(status);
  const isIdle = status === 'idle';
  const isError = status === 'error';
  const isChecking = status === 'checking';
  const isUpToDate = status === 'up-to-date';
  const isAvailable = status === 'available';
  const isInstalling = status === 'installing';
  const isInstalled = status === 'installed';
  const isDownloading = status === 'downloading';
  const isLoading = isChecking || isDownloading || isInstalling;

  useEffect(() => {
    checkForUpdates();
  }, []);

  const handleClick =
    isIdle || isError ? checkForUpdates : isAvailable ? downloadAndInstallUpdate : undefined;

  return (
    <>
      <div
        ref={anchorRef}
        className={twMerge(
          clsx(
            'pointer-events-none relative -ml-1.5 flex select-none items-center gap-2.5 self-center rounded-3xl p-1.5 pr-4 transition-all duration-200 ease-linear',
            typeof handleClick === 'function' && 'pointer-events-auto cursor-pointer',
            isAvailable && 'bg-sky-500/80 text-white hover:bg-sky-500/90',
            isInstalled && 'text-emerald-500/90',
            isIdle && 'hover:bg-white/5',
            isError && 'bg-red-600/10 text-red-400 hover:bg-red-700/20'
          )
        )}
        onClick={handleClick}
      >
        <RippleEffect ref={anchorRef} duration={1} />
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/5">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <Animated key="spinner">
                <Spinner size={18} absoluteCentered />
              </Animated>
            ) : (
              <Animated key="icon">
                <Icon id={iconId} size={24} />
              </Animated>
            )}
          </AnimatePresence>
        </div>
        <div className="text-sm">
          {isIdle && <span>Check for updates</span>}
          {isChecking && <span>Checking for updates...</span>}
          {isUpToDate && <span>Your app is up to date</span>}
          {isAvailable && <span>Version {availableUpdate?.version} is available</span>}
          {isDownloading && (
            <span className="flex flex-col gap-0">
              <span>Downloading...</span>
              <UpdateDownloadProgress />
            </span>
          )}
          {isInstalling && <span>Installing...</span>}
          {isInstalled && <span>Installed successfully</span>}
          {isError && (
            <span className="flex flex-col">
              <span>Something went wrong</span>
              <span className="text-xs opacity-60">Please try again later</span>
            </span>
          )}
        </div>
      </div>
      <Tooltip anchorRef={anchorRef} position="bottom" status="info">
        {isAvailable && 'Click to download and install the update'}
      </Tooltip>
    </>
  );
};

const getIconByStatus = (status: UpdateStatus): IconProps['id'] => {
  switch (status) {
    case 'up-to-date':
      return 'check';
    case 'available':
      return 'download';
    case 'installed':
      return 'check';
    case 'error':
      return 'error';
  }
  return 'sync';
};
