import type { JobKind } from '../model/types';

export const getBackgroundColorByJobKind = (kind: JobKind) => {
  switch (kind) {
    case 'ingest':
      return 'bg-yellow-500';
    case 'download':
      return 'bg-red-400';
    case 'transcribe':
      return 'bg-cyan-600';
    case 'embed':
      return 'bg-emerald-600';
  }
};

export const getTextColorByJobKind = (kind: JobKind) => {
  switch (kind) {
    case 'ingest':
      return 'text-yellow-500';
    case 'download':
      return 'text-red-400';
    case 'transcribe':
      return 'text-cyan-600';
    case 'embed':
      return 'text-emerald-600';
  }
};

export const getLabelByJobKind = (kind: JobKind) => {
  switch (kind) {
    case 'ingest':
      return 'Ingestion';
    case 'download':
      return 'Downloading';
    case 'transcribe':
      return 'Transcribing';
    case 'embed':
      return 'Embedding';
  }
};
