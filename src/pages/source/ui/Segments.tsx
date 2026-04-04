import { memo, useCallback, useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import type { Segment } from '@/entities/segment';
import { useSourceSnapshot } from '@/entities/source';
import { usePlayer } from '@/features/media-player';
import { useSegmentsStore } from '@/features/view-segments';
import { useSourceId } from '@/features/view-source';
import type { Option } from '@/shared/types/common';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { VirtualizedList, type VirtualizedListHandle } from '@/shared/ui/VirtualizedList';
import { SegmentItem } from './SegmentItem';
import { SegmentsPanel } from './SegmentsPanel';

export const Segments = () => {
  const sourceId = useSourceId();
  const source = useSourceSnapshot(sourceId);
  const segmentsStore = useSegmentsStore();
  const { segments, activeSegmentId, isSyncing } = useSnapshot(segmentsStore.state);
  const listHandleRef = useRef<VirtualizedListHandle>(null);

  const setListHandle = useCallback((handle: Option<VirtualizedListHandle>) => {
    listHandleRef.current = handle;
  }, []);

  useEffect(() => {
    if (!segments.length || !isSyncing || activeSegmentId == null) return;
    const activeIndex = segmentsStore.getSegmentIndex(activeSegmentId);
    if (activeIndex == null) return;
    listHandleRef.current?.scrollToIndex(activeIndex, {
      align: 'center',
      behavior: 'smooth',
    });
  }, [activeSegmentId, isSyncing, segments.length, segmentsStore]);

  return (
    <div className="relative h-full">
      {segments.length ? (
        <>
          <VirtualizedList<Segment>
            className="scrollable h-full p-3 pb-20.5"
            items={segments}
            overscan={5}
            itemHeight={() => 100}
            getItemKey={({ id }) => id}
            renderItem={(segment) => <SegmentItem sourceId={source.id} segment={segment} />}
            onReady={setListHandle}
          />
          <SegmentsPanel />
        </>
      ) : (
        source.status !== 'processing' && (
          <StatusMessage status="regular" iconId="warning" iconSize={28}>
            <span className="text-sm">No segments available</span>
          </StatusMessage>
        )
      )}
      <PlaybackSyncer />
    </div>
  );
};

const PlaybackSyncer = memo(() => {
  const segmentsStore = useSegmentsStore();
  const { setActiveSegmentByTime } = segmentsStore;
  const { segments } = useSnapshot(segmentsStore.state);
  const { currentTime } = useSnapshot(usePlayer().state);

  useEffect(() => {
    if (!segments.length) return;
    setActiveSegmentByTime(currentTime);
  }, [segments, currentTime, setActiveSegmentByTime]);

  return null;
});
