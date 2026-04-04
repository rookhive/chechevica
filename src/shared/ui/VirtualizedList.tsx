import { elementScroll, useVirtualizer, type VirtualizerOptions } from '@tanstack/react-virtual';
import { type Key, type ReactNode, useCallback, useEffect, useRef } from 'react';
import type { Option } from '../types/common';

export type VirtualizedListVisibleRange = {
  startIndex: number;
  endIndex: number;
};

export type VirtualizedListHandle = {
  scrollToIndex(
    index: number,
    options?: {
      align?: 'auto' | 'start' | 'center' | 'end';
      behavior?: 'auto' | 'smooth';
    }
  ): void;
  getVisibleRange(): Option<VirtualizedListVisibleRange>;
};

const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;

type Props<T> = {
  className?: string;
  items: readonly T[];
  overscan?: number;
  itemHeight(item: T, index: number): number;
  getItemKey(item: T, index: number): Key;
  renderItem(item: T, index: number): ReactNode;
  onReady?: (handle: Option<VirtualizedListHandle>) => void;
};

export const VirtualizedList = <T,>({
  className,
  items,
  overscan = 0,
  itemHeight,
  getItemKey,
  renderItem,
  onReady,
}: Props<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measuredSizeByKeyRef = useRef(new Map<Key, number>());
  const scrollingTokenRef = useRef<Option<number>>(null);

  const scrollToFn: VirtualizerOptions<HTMLDivElement, HTMLDivElement>['scrollToFn'] = useCallback(
    (offset, { behavior, adjustments }, instance) => {
      const scrollElement = containerRef.current;
      if (!scrollElement) return;

      if (behavior !== 'smooth') {
        scrollingTokenRef.current = null;
        elementScroll(offset, { behavior: 'auto', adjustments }, instance);
        return;
      }

      const start = scrollElement.scrollTop;
      const startToken = (scrollingTokenRef.current = Date.now());

      const run = () => {
        if (scrollingTokenRef.current !== startToken) return;

        const duration = 500;
        const elapsed = Date.now() - startToken;
        const interpolated =
          start + (offset - start) * easeInOutQuint(Math.min(elapsed / duration, 1));

        elementScroll(interpolated, { behavior: 'auto', adjustments }, instance);

        if (elapsed < duration) {
          requestAnimationFrame(run);
        }
      };

      requestAnimationFrame(run);
    },
    []
  );

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => {
      const item = items[index]!;
      const itemKey = getItemKey(item, index);
      return measuredSizeByKeyRef.current.get(itemKey) ?? itemHeight(item, index);
    },
    getItemKey: (index) => getItemKey(items[index]!, index),
    overscan,
    scrollToFn,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const measureRowElement = useCallback(
    (node: Option<HTMLDivElement>) => {
      rowVirtualizer.measureElement(node);

      const index = Number(node?.dataset.index);
      if (!node || !Number.isInteger(index) || index < 0 || index >= items.length) return;

      measuredSizeByKeyRef.current.set(
        getItemKey(items[index]!, index),
        node.getBoundingClientRect().height
      );
    },
    [getItemKey, items, rowVirtualizer]
  );

  useEffect(() => {
    if (!onReady) return;

    onReady({
      scrollToIndex(index, options) {
        if (index < 0 || index >= items.length) return;

        rowVirtualizer.scrollToIndex(index, {
          align: options?.align ?? 'auto',
          behavior: options?.behavior ?? 'auto',
        });
      },
      getVisibleRange() {
        const visibleItems = rowVirtualizer.getVirtualItems();
        const firstVisibleItem = visibleItems[0];
        const lastVisibleItem = visibleItems.at(-1);

        if (!firstVisibleItem || !lastVisibleItem) return null;

        return {
          startIndex: firstVisibleItem.index,
          endIndex: lastVisibleItem.index,
        };
      },
    });
    return () => onReady(null);
  }, [items.length, onReady, rowVirtualizer]);

  return (
    <div ref={containerRef} className={className} style={{ overflowAnchor: 'none' }}>
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        <div
          className="relative w-full"
          style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index]!;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={measureRowElement}
                className="w-full"
              >
                {renderItem(item, virtualRow.index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
