import { resetSettings } from '@/entities/source';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export const ResetSettingsButton = () => {
  return (
    <Button
      status="dangerous"
      isUppercased
      withConfirmation
      dialogTitle="Confirm reset"
      dialogMessage={
        <div className="flex w-110 items-center gap-3 text-sm">
          <div className="rounded-full bg-amber-500/10 p-3">
            <Icon id="warning" size={32} className="shrink-0 text-amber-500" />
          </div>
          <div>
            Are you sure you want to reset all settings to their default values? This action cannot
            be undone
          </div>
        </div>
      }
      dialogConfirmLabel="Reset"
      dialogCancelLabel="Cancel"
      dialogConfirmButtonStatus="dangerous"
      onClick={resetSettings}
    >
      Reset to defaults
    </Button>
  );
};
