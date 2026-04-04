import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { proxy, ref } from 'valtio';
import type { Option } from '@/shared/types/common';
import type { UpdateStatus } from './types';

type State = {
  status: UpdateStatus;
  availableUpdate: Option<Update>;
  updateSizeBytes: number;
  downloadedBytes: number;
};

export const state = proxy<State>({
  status: 'idle',
  availableUpdate: null,
  updateSizeBytes: 0,
  downloadedBytes: 0,
});

export const checkForUpdates = async () => {
  try {
    if (['checking', 'downloading', 'installing'].includes(state.status)) return;

    state.availableUpdate = null;
    state.updateSizeBytes = 0;
    state.downloadedBytes = 0;
    state.status = 'checking';

    const update = await check({
      timeout: 60 * 60 * 6 * 1000, // 6 hours
    });

    if (!update) {
      state.status = 'up-to-date';
      return;
    }

    state.status = 'available';
    state.availableUpdate = ref(update);
  } catch {
    state.status = 'error';
  }
};

export const downloadAndInstallUpdate = async () => {
  if (!state.availableUpdate) return;

  try {
    const update = state.availableUpdate;

    state.status = 'downloading';

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          state.updateSizeBytes = event.data.contentLength || 0;
          state.downloadedBytes = 0;
          break;
        case 'Progress':
          state.downloadedBytes = state.downloadedBytes + event.data.chunkLength;
          break;
        case 'Finished':
          state.status = 'installing';
          state.downloadedBytes = state.updateSizeBytes;
          break;
      }
    });

    state.status = 'installed';

    await relaunch();
  } catch {
    state.status = 'error';
  }
};
