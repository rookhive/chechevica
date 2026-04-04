import { useSnapshot } from 'valtio';
import { state } from '../model/updaterStore';

export const useUpdater = () => useSnapshot(state);
