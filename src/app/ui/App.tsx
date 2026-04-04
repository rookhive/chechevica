import '@/app/styles/fonts.css';
import '@/app/styles/global.css';

import { useEffect } from 'react';
import { initRuntimeListeners } from '@/entities/source';
import { checkForUpdates } from '@/features/app-updater';
import { ModalHost } from '@/shared/ui/Modal';
import { Titlebar, WindowControls } from '@/widgets/titlebar';
import { AppViewport } from './AppViewport';

export const App = () => {
  useEffect(() => {
    checkForUpdates();
    initRuntimeListeners();
  }, []);

  return (
    <>
      <div className="fixed inset-0 flex select-none flex-col overflow-hidden">
        <div className="shrink-0">
          <Titlebar />
        </div>
        <div className="min-h-0 grow">
          <AppViewport />
          <ModalHost />
        </div>
      </div>
      <div className="fixed top-0 right-0 z-9000">
        <WindowControls />
      </div>
    </>
  );
};
