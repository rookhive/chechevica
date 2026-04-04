import { createContext, type PropsWithChildren } from 'react';
import type { SourceId } from '@/entities/source';
import type { Option } from '@/shared/types/common';

type ContextValue = SourceId;

export const SourceContext = createContext<Option<ContextValue>>(null);

export function SourceProvider({ value, children }: PropsWithChildren<{ value: ContextValue }>) {
  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}
