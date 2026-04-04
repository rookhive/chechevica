import { useContext } from 'react';
import { SearchContext } from './context-provider';

export function useSearchStore() {
  const context = useContext(SearchContext);
  if (!context) throw new Error('useSearchStore must be used inside SearchProvider');
  return context;
}
