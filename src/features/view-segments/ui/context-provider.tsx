import { createContext, type PropsWithChildren } from 'react';
import type { Option } from '@/shared/types/common';
import type { SegmentsStore } from '../model/segmentsStore';

export type SegmentsContextValue = SegmentsStore;

export const SegmentsContext = createContext<Option<SegmentsContextValue>>(null);

export function SegmentsProvider({
  value,
  children,
}: PropsWithChildren<{ value: SegmentsContextValue }>) {
  return <SegmentsContext.Provider value={value}>{children}</SegmentsContext.Provider>;
}
