import { useContext } from 'react';
import { SegmentsContext } from './context-provider';

export function useSegmentsContext() {
  const context = useContext(SegmentsContext);
  if (!context) throw new Error('useSegmentsStore must be used inside SegmentsProvider');
  return context;
}

export function useSegmentsStore() {
  return useSegmentsContext();
}
