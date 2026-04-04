import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties, PropsWithChildren, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Option } from '../types/common';

type TooltipPosition = 'top' | 'left' | 'bottom' | 'right';
type TooltipStatus = 'regular' | 'dangerous' | 'success' | 'info';

export type Props = {
  anchorRef: RefObject<Option<HTMLElement>>;
  position?: TooltipPosition;
  status?: TooltipStatus;
};

const OFFSET = 6;
const VIEWPORT_PADDING = 8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getStatusClasses = (status: TooltipStatus) => {
  switch (status) {
    case 'success':
      return 'bg-emerald-700/80';
    case 'dangerous':
      return 'bg-red-700/80';
    case 'info':
      return 'bg-sky-500/80';
    default:
      return 'bg-black/80';
  }
};

export const Tooltip = ({
  children,
  anchorRef,
  position = 'top',
  status = 'regular',
}: PropsWithChildren<Props>) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const anchorCenterY = anchorRect.top + anchorRect.height / 2;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'bottom':
        top = anchorRect.bottom + OFFSET;
        left = anchorCenterX - tooltipRect.width / 2;
        break;
      case 'left':
        top = anchorCenterY - tooltipRect.height / 2;
        left = anchorRect.left - tooltipRect.width - OFFSET;
        break;
      case 'right':
        top = anchorCenterY - tooltipRect.height / 2;
        left = anchorRect.right + OFFSET;
        break;
      default:
        top = anchorRect.top - tooltipRect.height - OFFSET;
        left = anchorCenterX - tooltipRect.width / 2;
        break;
    }

    const clampedLeft = clamp(
      left,
      VIEWPORT_PADDING,
      window.innerWidth - tooltipRect.width - VIEWPORT_PADDING
    );
    const clampedTop = clamp(
      top,
      VIEWPORT_PADDING,
      window.innerHeight - tooltipRect.height - VIEWPORT_PADDING
    );

    setStyle({ top: clampedTop, left: clampedLeft });
    setIsPositioned(true);
  }, [anchorRef, position]);

  // biome-ignore lint: it's fine
  useLayoutEffect(updatePosition, [children, updatePosition]);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const handleMouseEnter = () => setIsOpen(true);
    const handleMouseLeave = () => setIsOpen(false);
    const handleFocusIn = () => setIsOpen(true);
    const handleFocusOut = () => setIsOpen(false);

    anchor.addEventListener('mouseenter', handleMouseEnter);
    anchor.addEventListener('mouseleave', handleMouseLeave);
    anchor.addEventListener('focusin', handleFocusIn);
    anchor.addEventListener('focusout', handleFocusOut);

    return () => {
      anchor.removeEventListener('mouseenter', handleMouseEnter);
      anchor.removeEventListener('mouseleave', handleMouseLeave);
      anchor.removeEventListener('focusin', handleFocusIn);
      anchor.removeEventListener('focusout', handleFocusOut);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setIsPositioned(false);
      return;
    }

    const raf = requestAnimationFrame(updatePosition);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleClose, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [isOpen, updatePosition]);

  return createPortal(
    <AnimatePresence>
      {isOpen && !!children && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: isPositioned ? 1 : 0, scale: isPositioned ? 1 : 0.95 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          className={clsx(
            'pointer-events-none fixed z-999 max-w-100 rounded-2xl px-2.5 py-1.5 text-white text-xs ring-2 ring-white/10 backdrop-blur-lg',
            getStatusClasses(status),
            !isPositioned && 'opacity-0'
          )}
          style={style}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
