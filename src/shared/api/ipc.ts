import { invoke } from '@tauri-apps/api/core';

export const sendMessage = <T>(command: string, args?: Record<string, unknown>) =>
  invoke<T>(command, args);
