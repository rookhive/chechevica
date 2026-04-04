import { useContext } from 'react';
import { SourceContext } from './context-provider';

export function useSourceId() {
  const context = useContext(SourceContext);
  if (!context) throw new Error('useSourceId must be used inside SourceProvider');
  return context;
}
