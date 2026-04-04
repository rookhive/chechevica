import { AvailableUpdateButton } from '@/features/app-updater';
import { Tabs } from '@/features/manage-tabs';
import { ProcessingSourcesButton } from './ProcessingSourcesButton';
import { ProjectsButton } from './ProjectsButton';
import { SettingsButton } from './SettingsButton';

export const Titlebar = () => {
  return (
    <div className="flex py-0.5">
      <div className="flex min-w-0 grow items-center px-2" data-tauri-drag-region>
        <div className="flex w-full grow items-center gap-3">
          <div className="flex items-center gap-1 [app-region:no-drag]">
            <AvailableUpdateButton />
            <ProjectsButton />
            <SettingsButton />
            <ProcessingSourcesButton />
          </div>
          <nav className="min-w-0 [app-region:no-drag]">
            <Tabs />
          </nav>
        </div>
      </div>
      {/* A placeholder for window controls */}
      <div className="ml-auto w-30 shrink-0 self-stretch" />
    </div>
  );
};
