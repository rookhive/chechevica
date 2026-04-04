import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useMemo, useState } from 'react';
import { WindowControlButton } from './WindowControlButton';

export const WindowControls = () => {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: undefined | (() => void);

    const sync = async () => setIsMaximized(await appWindow.isMaximized());

    sync();

    appWindow.onResized(sync).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [appWindow]);

  return (
    <div className="flex items-center [app-region:no-drag]">
      <WindowControlButton iconId="window-minimize" onClick={() => appWindow.minimize()} />
      <WindowControlButton
        iconId={isMaximized ? 'window-restore' : 'window-maximize'}
        onClick={() => appWindow.toggleMaximize()}
      />
      <WindowControlButton iconId="window-close" isClose onClick={() => appWindow.close()} />
    </div>
  );
};
