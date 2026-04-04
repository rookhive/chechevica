import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties, MouseEvent, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Option } from '../types/common';
import { Button, type Props as ButtonProps } from './Button';
import type { Props as IconProps } from './Icon';

export type ContextMenuItem = {
  id: number | string;
  label: string;
  iconId: IconProps['id'];
  status?: ButtonProps['status'];
  isDisabled?: boolean;
  onClick: ButtonProps['onClick'];
};

export type Props = {
  anchor: RefObject<Option<HTMLElement>>;
  items: ContextMenuItem[];
};

type MenuState = {
  isOpen: boolean;
  x: number;
  y: number;
};

export const ContextMenu = ({ anchor, items }: Props) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuState, setMenuState] = useState<Option<MenuState>>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const close = useCallback(() => {
    setMenuState((current) => (current ? { ...current, isOpen: false } : null));
  }, []);

  useEffect(() => {
    const anchorElement = anchor.current;
    if (!anchorElement) return;

    const handleContextMenu = (e: PointerEvent) => {
      e.preventDefault();
      setMenuState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
      });
    };

    anchorElement.addEventListener('contextmenu', handleContextMenu);
    return () => {
      anchorElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    if (!menuState?.isOpen) return;

    const updatePosition = () => {
      const menu = menuRef.current;
      if (!menu) return;

      const { innerWidth, innerHeight } = window;
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const padding = 8;

      let left = menuState.x;
      let top = menuState.y;

      if (left + menuWidth > innerWidth - padding) {
        left = Math.max(padding, innerWidth - menuWidth - padding);
      }

      if (top + menuHeight > innerHeight - padding) {
        top = Math.max(padding, innerHeight - menuHeight - padding);
      }

      setMenuStyle({
        position: 'fixed',
        left,
        top,
        zIndex: 1000,
      });
    };

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [menuState]);

  useEffect(() => {
    if (!menuState?.isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Option<Node>;
      if (!target) return close();
      if (anchor.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    const closeOnLayoutChange = (e: Event) => {
      const target = e.target as Option<Node>;
      if (anchor.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeOnLayoutChange, true);
    window.addEventListener('resize', closeOnLayoutChange);
    window.addEventListener('orientationchange', closeOnLayoutChange);
    window.addEventListener('wheel', closeOnLayoutChange, { passive: true });
    window.addEventListener('touchmove', closeOnLayoutChange, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeOnLayoutChange, true);
      window.removeEventListener('resize', closeOnLayoutChange);
      window.removeEventListener('orientationchange', closeOnLayoutChange);
      window.removeEventListener('wheel', closeOnLayoutChange);
      window.removeEventListener('touchmove', closeOnLayoutChange);
    };
  }, [anchor, close, menuState?.isOpen]);

  return createPortal(
    <AnimatePresence mode="popLayout">
      {menuState?.isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex flex-col rounded-2xl bg-black/30 p-1 text-white ring-2 ring-white/10 backdrop-blur-lg"
          style={menuStyle}
        >
          {items.map((item) => (
            <Button
              key={item.id}
              status={item.status || 'regular'}
              iconId={item.iconId}
              iconSize={20}
              isDisabled={item.isDisabled}
              className="rounded-xl bg-transparent"
              onClick={async (e: MouseEvent<HTMLButtonElement>) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.isDisabled) return;
                await item.onClick?.(e);
                close();
              }}
            >
              {item.label}
            </Button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
