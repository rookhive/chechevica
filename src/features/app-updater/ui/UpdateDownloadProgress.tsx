import { formatProgressBytes } from '@/shared/lib/file';
import { useUpdater } from './hooks';

export const UpdateDownloadProgress = () => {
  const { downloadedBytes, updateSizeBytes } = useUpdater();
  const progressValue =
    updateSizeBytes > 0 ? Math.min((downloadedBytes / updateSizeBytes) * 100, 100) : 0;

  return (
    <span className="text-white/60 text-xs">
      {formatProgressBytes(downloadedBytes, updateSizeBytes)} /{' '}
      {formatProgressBytes(updateSizeBytes, updateSizeBytes)} ({Math.floor(progressValue)}%)
    </span>
  );
};
