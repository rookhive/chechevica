import { motion } from 'motion/react';
import { useSourceSnapshot } from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import { JobProgressBarItem } from './JobProgressBarItem';

export const JobProgressBar = () => {
  const source = useSourceSnapshot(useSourceId());
  const hasIngestJob = source.kind === 'local' && !!source.ingestJobId;
  const hasDownloadJob = source.kind === 'remote' && !!source.downloadJobId;
  const hasTranscribeJob = !!source.transcribeJobId;
  const hasEmbedJob = !!source.embedJobId;

  return (
    <motion.div
      className="absolute right-2 bottom-2 left-2"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative h-4 overflow-hidden rounded-full">
        <div className="absolute -inset-px flex rounded-full bg-black/75">
          <div className="relative grow">
            {hasIngestJob && <JobProgressBarItem jobId={source.ingestJobId!} isFirst />}
            {hasDownloadJob && <JobProgressBarItem jobId={source.downloadJobId!} isFirst />}
          </div>
          <div className="relative grow">
            {hasTranscribeJob && <JobProgressBarItem jobId={source.transcribeJobId!} />}
          </div>
          <div className="relative grow">
            {hasEmbedJob && <JobProgressBarItem jobId={source.embedJobId!} isLast />}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
