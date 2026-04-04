import { createContext, type PropsWithChildren } from 'react';
import type { Option } from '@/shared/types/common';
import type { SearchStore } from '../model/searchStore';

type ContextValue = SearchStore;

export const SearchContext = createContext<Option<ContextValue>>(null);

export function SearchProvider({ value, children }: PropsWithChildren<{ value: ContextValue }>) {
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
