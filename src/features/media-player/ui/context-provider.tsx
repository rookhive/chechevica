import { createContext, type PropsWithChildren } from 'react';
import type { Option } from '@/shared/types/common';
import type { PlayerStore } from '../model/playerStore';

type ContextValue = PlayerStore;

export const PlayerContext = createContext<Option<ContextValue>>(null);

export function PlayerProvider({ value, children }: PropsWithChildren<{ value: ContextValue }>) {
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
