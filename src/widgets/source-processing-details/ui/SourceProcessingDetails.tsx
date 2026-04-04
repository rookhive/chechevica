import { useEffect, useRef, useState } from 'react';
import { type JobId, useSourceSnapshot } from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import { Animated } from '@/shared/ui/Animated';
import { AllJobsCompletedMessage } from './AllJobsCompletedMessage';
import { JobDetails } from './JobDetails';

export const SourceProcessingDetails = () => {
  const source = useSourceSnapshot(useSourceId());
  const [isJustSucceeded, setIsJustSucceeded] = useState(false);
  const isSucceeded = source.status === 'succeeded';
  const previousStatusRef = useRef(source.status);
  const jobIds = [
    source.ingestJobId,
    source.downloadJobId,
    source.transcribeJobId,
    source.embedJobId,
  ].filter(Boolean) as JobId[];

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    if (previousStatus !== 'succeeded' && source.status === 'succeeded') {
      setIsJustSucceeded(true);
    } else if (previousStatus === 'succeeded' && source.status !== 'succeeded') {
      setIsJustSucceeded(false);
    }
    previousStatusRef.current = source.status;
  }, [source.status]);

  return (
    <div className="relative px-1">
      {jobIds.map((jobId) => (
        <JobDetails key={jobId} jobId={jobId} />
      ))}
      {(isJustSucceeded || isSucceeded) && (
        <Animated>
          <AllJobsCompletedMessage />
        </Animated>
      )}
    </div>
  );
};
