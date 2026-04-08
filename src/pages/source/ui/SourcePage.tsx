import { useEffect, useMemo, useState } from 'react';
import { mutate } from 'swr';
import { useParams, useSearchParams } from 'wouter';
import { useSourceSegments } from '@/entities/segment';
import {
  type Source,
  type SourceId,
  useFetchSource,
  useOptionalSourceSnapshot,
  useSourceSnapshot,
} from '@/entities/source';
import { useTabMetainfo } from '@/features/manage-tabs';
import { createPlayerStore, PlayerProvider } from '@/features/media-player';
import { createSegmentsStore, SegmentsProvider } from '@/features/view-segments';
import { SourceProvider, useSourceId } from '@/features/view-source';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { Segments } from './Segments';
import { SourceArtifactControls } from './SourceArtifactControls';
import { SourceArtifactPanel } from './SourceArtifactPanel';

export const SourcePage = () => {
  const { sourceId } = useParams();
  if (!sourceId)
    return (
      <StatusMessage status="warning" iconId="warning">
        No source id provided
      </StatusMessage>
    );
  return <SourceWrapper sourceId={sourceId} />;
};

export const SourceWrapper = ({ sourceId }: { sourceId: SourceId }) => {
  useFetchSource(sourceId);

  const source = useOptionalSourceSnapshot(sourceId);

  if (!source)
    return (
      <StatusMessage status="warning" iconId="warning">
        There's no such source
      </StatusMessage>
    );

  return <ResolvedSourceWrapper source={source} />;
};

const ResolvedSourceWrapper = ({ source }: { source: Source }) => {
  const [searchParams] = useSearchParams();
  const { segments } = useSourceSegments({ sourceId: source.id });

  const [playerStore] = useState(() => createPlayerStore());
  const segmentsStore = useMemo(() => createSegmentsStore(segments), [segments]);

  // biome-ignore lint: it's fine
  useEffect(() => {
    mutate(['source-artifact', source.id]);
  }, [source.id, source.transcribeJobId]);

  // biome-ignore lint: it's fine
  useEffect(() => {
    mutate(['source-segments', source.id]);
  }, [source.id, source.embedJobId]);

  useEffect(() => {
    const segmentParam = searchParams.get('segment');
    if (!segmentParam) return;

    const segmentId = Number(segmentParam);
    if (!Number.isSafeInteger(segmentId)) return;

    const segment = segmentsStore.getSegmentById(segmentId);
    if (!segment) return;

    // segmentsStore.setActiveSegment(segment.id);
    playerStore.scrollTo(segment.start);
  }, [playerStore, segmentsStore, searchParams]);

  return (
    <SourceProvider value={source.id}>
      <PlayerProvider value={playerStore}>
        <SegmentsProvider value={segmentsStore}>
          <SourceContent />
        </SegmentsProvider>
      </PlayerProvider>
    </SourceProvider>
  );
};

const SourceContent = () => {
  const source = useSourceSnapshot(useSourceId());
  const icon = source.kind === 'remote' ? 'youtube' : source.mediaType;

  useTabMetainfo({ icon, title: source.title || '...' });

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 grow flex-col-reverse lg:flex-row">
        <div className="h-1/3 lg:h-full lg:w-[45%] lg:max-w-225 lg:overflow-y-auto">
          <SourceArtifactPanel />
        </div>
        <div className="min-h-0 grow lg:w-[55%]">
          <Segments />
        </div>
      </div>
      <div className="p-2 text-gray-500 text-xs">
        <SourceArtifactControls />
      </div>
    </div>
  );
};
