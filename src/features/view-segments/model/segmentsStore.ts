import { proxy } from 'valtio';
import type { Segment, SegmentId } from '@/entities/segment';

type SelectedSegmentIds = Partial<Record<SegmentId, true>>;

type State = {
  segments: Segment[];
  isSyncing: boolean;
  activeSegmentId?: SegmentId;
  selectedSegmentIds: SelectedSegmentIds;
  readonly isInSelectMode: boolean;
  readonly segmentById: Map<SegmentId, Segment>;
  readonly segmentIndexById: Map<SegmentId, number>;
  readonly selectedSegments: Segment[];
};

export const getDefaultSegmentsState = (): State => ({
  segments: [],
  isSyncing: true,
  activeSegmentId: undefined,
  selectedSegmentIds: {},
  get isInSelectMode() {
    return Object.keys(this.selectedSegmentIds).length > 0;
  },
  get segmentById() {
    return new Map(this.segments.map((segment) => [segment.id, segment]));
  },
  get segmentIndexById() {
    return new Map(this.segments.map((segment, index) => [segment.id, index]));
  },
  get selectedSegments() {
    return getSelectedSegmentIds(this.selectedSegmentIds)
      .map((segmentId) => {
        const segment = this.segmentById.get(segmentId);
        const index = this.segmentIndexById.get(segmentId);
        if (!segment || index == null) return undefined;
        return { segment, index };
      })
      .filter((entry): entry is { segment: Segment; index: number } => entry != null)
      .sort((left, right) => left.index - right.index)
      .map(({ segment }) => segment);
  },
});

const clearSelectedSegmentIds = (selectedSegmentIds: SelectedSegmentIds) => {
  for (const segmentId of Object.keys(selectedSegmentIds)) {
    delete selectedSegmentIds[Number(segmentId)];
  }
};

const getSelectedSegmentIds = (selectedSegmentIds: SelectedSegmentIds): SegmentId[] => {
  return Object.keys(selectedSegmentIds).map(Number);
};

const findSegmentByTime = (segments: Segment[], time: number) => {
  const segmentBoundaryEpsilon = 0.00001;

  if (!segments.length) return undefined;

  let left = 0;
  let right = segments.length - 1;
  let candidate: Segment | undefined;

  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2);
    const segment = segments[middle];

    if (segment.start <= time + segmentBoundaryEpsilon) {
      candidate = segment;
      left = middle + 1;
      continue;
    }

    right = middle - 1;
  }

  if (!candidate) return undefined;
  if (time > candidate.end + segmentBoundaryEpsilon) return undefined;

  return candidate;
};

export type SegmentsStore = ReturnType<typeof createSegmentsStore>;

export const createSegmentsStore = (initialSegments: Segment[] = []) => {
  const state = proxy<State>(getDefaultSegmentsState());
  let lastSelectedSegmentId: SegmentId | undefined;

  state.segments = initialSegments;

  return {
    state,

    resetState() {
      state.segments = [];
      state.isSyncing = true;
      state.activeSegmentId = undefined;
      clearSelectedSegmentIds(state.selectedSegmentIds);
      lastSelectedSegmentId = undefined;
    },

    setActiveSegment(segmentId?: SegmentId) {
      if (!segmentId) {
        if (state.activeSegmentId == null) return;
        state.activeSegmentId = undefined;
        return;
      }
      const nextSegmentId = state.segmentById.has(segmentId) ? segmentId : undefined;
      if (state.activeSegmentId === nextSegmentId) return;
      state.activeSegmentId = nextSegmentId;
    },

    setActiveSegmentByTime(time: number) {
      const nextSegmentId = findSegmentByTime(state.segments, time)?.id;
      if (state.activeSegmentId === nextSegmentId) return;
      state.activeSegmentId = nextSegmentId;
    },

    setIsSyncing(isSyncing: boolean) {
      state.isSyncing = isSyncing;
    },

    clearSelection() {
      clearSelectedSegmentIds(state.selectedSegmentIds);
      lastSelectedSegmentId = undefined;
    },

    setSelectedSegments(segmentIds: SegmentId[] = []) {
      clearSelectedSegmentIds(state.selectedSegmentIds);
      lastSelectedSegmentId = undefined;

      for (const segmentId of segmentIds) {
        if (!state.segmentById.has(segmentId)) continue;
        state.selectedSegmentIds[segmentId] = true;
        lastSelectedSegmentId = segmentId;
      }
    },

    selectSegment(segmentId: SegmentId) {
      if (!state.segmentById.has(segmentId)) return;
      state.selectedSegmentIds[segmentId] = true;
      lastSelectedSegmentId = segmentId;
    },

    unselectSegment(segmentId: SegmentId) {
      if (!state.selectedSegmentIds[segmentId]) return;
      delete state.selectedSegmentIds[segmentId];

      if (!getSelectedSegmentIds(state.selectedSegmentIds).length) {
        lastSelectedSegmentId = undefined;
      }
    },

    selectSegmentsUpTo(segmentId: SegmentId) {
      if (!state.segmentById.has(segmentId)) return;

      const lastSelectedIndex =
        lastSelectedSegmentId == null
          ? undefined
          : state.segmentIndexById.get(lastSelectedSegmentId);
      const currentIndex = state.segmentIndexById.get(segmentId);

      if (lastSelectedIndex == null || currentIndex == null) {
        state.selectedSegmentIds[segmentId] = true;
        lastSelectedSegmentId = segmentId;
        return;
      }

      const startIndex = Math.min(lastSelectedIndex, currentIndex);
      const endIndex = Math.max(lastSelectedIndex, currentIndex);

      for (let index = startIndex; index <= endIndex; index += 1) {
        const rangeSegmentId = state.segments[index]?.id;
        if (rangeSegmentId == null) continue;
        state.selectedSegmentIds[rangeSegmentId] = true;
      }

      lastSelectedSegmentId = segmentId;
    },

    getSegmentById(segmentId: SegmentId) {
      return state.segmentById.get(segmentId);
    },

    getSegmentIndex(segmentId: SegmentId) {
      return state.segmentIndexById.get(segmentId);
    },
  };
};
