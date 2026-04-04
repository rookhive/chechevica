import type { Source } from '@/entities/source';

import { getVisibleSteps, type StepKey } from '@/entities/source';

export const getCurrentSourceJobId = (source: Source, step: StepKey) => {
  switch (step) {
    case 'ingest':
      return source.ingestJobId;
    case 'download':
      return source.downloadJobId;
    case 'transcribe':
      return source.transcribeJobId;
    case 'embed':
      return source.embedJobId;
  }
};

export const getAvailableReprocessStartSteps = (source: Source) =>
  getVisibleSteps(source.kind).filter((step) => Boolean(getCurrentSourceJobId(source, step)));
