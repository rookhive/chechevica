import type { RemoteSourceMediaType, SourceParamsByStep } from '@/entities/source';

export type LocalImportItem = {
  id: string;
  kind: 'local';
  origin: string;
  label: string;
  params: SourceParamsByStep;
};

export type RemoteImportItem = {
  id: string;
  kind: 'remote';
  origin: string;
  label: string;
  mediaType: RemoteSourceMediaType;
  params: SourceParamsByStep;
};

export type ImportItem = LocalImportItem | RemoteImportItem;

export type RemoteCandidate = {
  id: string;
  title: string;
  url: string;
};
