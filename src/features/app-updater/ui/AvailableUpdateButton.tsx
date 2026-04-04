import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import { Link } from 'wouter';
import { Animated } from '@/shared/ui/Animated';
import { Button } from '@/shared/ui/Button';
import { downloadAndInstallUpdate } from '../model/updaterStore';
import { useUpdater } from './hooks';

export const AvailableUpdateButton = () => {
  const { status, availableUpdate } = useUpdater();
  const isAvailable = status === 'available';
  const isInstalled = status === 'installed';
  const isLoading = !isAvailable && !isInstalled;

  return (
    <AnimatePresence mode="wait">
      {!!availableUpdate && (
        <Animated ease="linear">
          <Link href="/settings">
            <Button
              className={clsx(isInstalled && 'cursor-default')}
              status="info"
              iconId={isInstalled ? 'check' : 'download'}
              isLoading={isLoading}
              isDisabled={isLoading}
              tooltip={
                isAvailable
                  ? 'New version available. Click to download and install'
                  : isInstalled
                    ? 'Update successfully installed'
                    : 'Downloading and installing...'
              }
              tooltipPosition="bottom"
              tooltipStatus="info"
              onClick={isAvailable && !isInstalled ? downloadAndInstallUpdate : undefined}
            />
          </Link>
        </Animated>
      )}
    </AnimatePresence>
  );
};
