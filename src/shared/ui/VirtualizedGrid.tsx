import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import {
  type CSSProperties,
  type Key,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Props<T> = {
  items: readonly T[];
  minItemWidth: number;
  gap?: number;
  overscan?: number;
  className?: string;
  itemClassName?: string;
  contentClassName?: string;
  itemHeight(itemWidth: number): number;
  getItemKey(item: T, index: number): Key;
  renderItem(item: T, index: number): ReactNode;
};

const getContentWidth = (node: HTMLElement) => {
  const styles = getComputedStyle(node);
  const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  return Math.round(node.clientWidth - horizontalPadding);
};

export const VirtualizedGrid = <T,>({
  items,
  minItemWidth,
  gap = 16,
  overscan = 0,
  className,
  itemClassName,
  contentClassName,
  itemHeight,
  getItemKey,
  renderItem,
}: Props<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const measure = () => {
      setContainerWidth((previousWidth) => {
        const width = getContentWidth(container);
        return width > 0 && width !== previousWidth ? width : previousWidth;
      });
    };

    measure();
    const observer = new ResizeObserver(() => {
      const width = getContentWidth(container);
      if (width <= 0) return;
      setContainerWidth((previousWidth) => (previousWidth === width ? previousWidth : width));
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const { columnCount, itemWidth, rowHeight, rowCount } = useMemo(() => {
    const availableWidth = containerWidth;
    const columnCount = Math.max(1, Math.floor((availableWidth + gap) / (minItemWidth + gap)));
    const itemWidth =
      availableWidth > 0
        ? Math.floor((availableWidth - gap * (columnCount - 1)) / columnCount)
        : minItemWidth;
    const rowHeight = itemHeight(itemWidth) + gap;
    const rowCount = availableWidth > 0 ? Math.ceil(items.length / columnCount) : 0;

    return {
      columnCount,
      itemWidth,
      rowHeight,
      rowCount,
    };
  }, [containerWidth, gap, itemHeight, items.length, minItemWidth]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  useLayoutEffect(() => {
    if (rowHeight <= 0) return;
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer.measure]);

  return (
    <div ref={containerRef} className={className}>
      <div
        className={clsx('relative w-full', contentClassName)}
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        <AnimatePresence>
          {rowVirtualizer.getVirtualItems().flatMap((virtualRow) => {
            const start = virtualRow.index * columnCount;
            const end = Math.min(start + columnCount, items.length);

            return items.slice(start, end).map((item, columnIndex) => {
              const index = start + columnIndex;
              const translateX = columnIndex * itemWidth + columnIndex * gap;
              const translateY = virtualRow.start;
              const style: CSSProperties = {
                width: itemWidth,
                transform: `translate(${translateX}px, ${translateY}px)`,
              };

              return (
                <div
                  key={getItemKey(item, index)}
                  className={clsx('absolute top-0 left-0 will-change-transform', itemClassName)}
                  style={style}
                >
                  {renderItem(item, index)}
                </div>
              );
            });
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
