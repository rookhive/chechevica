import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties, PropsWithChildren, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Option } from '../types/common';

export type DropdownAlign = 'start' | 'end' | 'center';
export type DropdownPosition = 'top' | 'bottom';

const OFFSET = 6;
const VIEWPORT_PADDING = 8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type Props = {
  anchorRef: RefObject<Option<HTMLElement>>;
  open: boolean;
  align?: DropdownAlign;
  position?: DropdownPosition;
  openOnHover?: boolean;
  isDisabled?: boolean;
  menuClassName?: string;
  menuStyle?: CSSProperties;
  onOpenChange: (open: boolean) => void;
};

export const Dropdown = ({
  children,
  anchorRef,
  open,
  align = 'start',
  position = 'bottom',
  openOnHover = false,
  isDisabled,
  menuClassName,
  menuStyle,
  onOpenChange,
}: PropsWithChildren<Props>) => {
  const [computedStyle, setComputedStyle] = useState<CSSProperties>({});
  const [computedPosition, setComputedPosition] = useState<DropdownPosition>(position);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const updateMenuPosition = useCallback(() => {
    const anchorElement = anchorRef.current;
    if (!anchorElement) return;

    const rect = anchorElement.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? rect.width;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    let nextPosition = position;
    if (menuHeight > 0) {
      if (position === 'bottom' && spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        nextPosition = 'top';
      }
      if (position === 'top' && spaceAbove < menuHeight && spaceBelow > spaceAbove) {
        nextPosition = 'bottom';
      }
    }
    const left =
      align === 'end'
        ? rect.right - menuWidth
        : align === 'center'
          ? rect.left + rect.width / 2 - menuWidth / 2
          : rect.left;
    const naturalTop =
      nextPosition === 'bottom'
        ? rect.bottom + OFFSET
        : rect.top - OFFSET - Math.max(menuHeight, 0);
    const top = clamp(naturalTop, VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING);
    const maxHeight = Math.max(0, viewportHeight - VIEWPORT_PADDING - top);

    setComputedPosition(nextPosition);
    setComputedStyle({
      position: 'fixed',
      top,
      left,
      maxHeight,
      maxWidth: Math.max(0, viewportWidth - VIEWPORT_PADDING * 2),
      zIndex: 999,
    });
  }, [align, position, anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const rafId = requestAnimationFrame(updateMenuPosition);
    return () => cancelAnimationFrame(rafId);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Option<Node>;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      handleClose();
    };

    const closeOnLayoutChange = (event: Event) => {
      const target = event.target as Option<Node>;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      handleClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', closeOnLayoutChange, true);
    window.addEventListener('resize', closeOnLayoutChange);
    window.addEventListener('orientationchange', closeOnLayoutChange);
    window.addEventListener('wheel', closeOnLayoutChange, { passive: true });
    window.addEventListener('touchmove', closeOnLayoutChange, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', closeOnLayoutChange, true);
      window.removeEventListener('resize', closeOnLayoutChange);
      window.removeEventListener('orientationchange', closeOnLayoutChange);
      window.removeEventListener('wheel', closeOnLayoutChange);
      window.removeEventListener('touchmove', closeOnLayoutChange);
    };
  }, [handleClose, open, anchorRef]);

  useEffect(() => {
    const anchorElement = anchorRef.current;
    if (!anchorElement || isDisabled) return;

    const handleClick = () => {
      if (openOnHover) return;
      onOpenChange(!open);
    };

    const handlePointerEnter = () => {
      if (!openOnHover) return;
      onOpenChange(true);
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (!openOnHover) return;
      const next = event.relatedTarget as Option<Node>;
      if (next && menuRef.current?.contains(next)) return;
      onOpenChange(false);
    };

    anchorElement.addEventListener('click', handleClick);
    anchorElement.addEventListener('pointerenter', handlePointerEnter);
    anchorElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      anchorElement.removeEventListener('click', handleClick);
      anchorElement.removeEventListener('pointerenter', handlePointerEnter);
      anchorElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [anchorRef, open, openOnHover, isDisabled, onOpenChange]);

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, translateY: computedPosition === 'bottom' ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'linear' }}
              className={clsx(
                'flex flex-col overflow-y-auto rounded-2xl bg-black/30 p-1 text-white ring-2 ring-white/10 backdrop-blur-lg',
                menuClassName
              )}
              style={{ ...menuStyle, ...computedStyle }}
              onPointerLeave={(event) => {
                if (!openOnHover) return;
                const next = event.relatedTarget as Option<Node>;
                if (next && anchorRef.current?.contains(next)) return;
                onOpenChange(false);
              }}
              onPointerEnter={() => {
                if (!openOnHover) return;
                onOpenChange(true);
              }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
