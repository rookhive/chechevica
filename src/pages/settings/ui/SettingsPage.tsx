import { AppUpdater } from '@/features/app-updater';
import { useTabMetainfo } from '@/features/manage-tabs';
import { AboutApp } from './AboutApp';
import { SettingsSection } from './SettingsSection';
import { SourceProcessingDefaults } from './SourceProcessingDefaults';

export const SettingsPage = () => {
  useTabMetainfo({ icon: 'settings', title: 'Settings' });

  return (
    <div className="scrollable h-full min-h-0">
      <div className="mx-auto flex max-w-200 flex-col gap-2 p-3">
        <div className="flex w-full flex-0 gap-2 *:basis-1/2">
          <SettingsSection title="About app">
            <AboutApp />
          </SettingsSection>
          <SettingsSection title="Updates">
            <AppUpdater />
          </SettingsSection>
        </div>
        <SettingsSection
          title="Source processing defaults"
          description="Default parameters for source processing. You will be able to override these per source"
        >
          <SourceProcessingDefaults />
        </SettingsSection>
      </div>
    </div>
  );
};
