import clsx from 'clsx';
import type { CSSProperties, MouseEvent, ReactNode, RefObject } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Option } from '../types/common';
import { Button, type Props as ButtonProps } from './Button';
import { Dropdown } from './Dropdown';

export type MenuItem = {
  id: number | string;
  label: ReactNode;
  status?: ButtonProps['status'];
  iconId?: ButtonProps['iconId'];
  iconSize?: ButtonProps['iconSize'];
  isDisabled?: boolean;
  className?: string;
  onClick: (e: MouseEvent) => void;
};

type Props = {
  anchorRef: RefObject<Option<HTMLElement>>;
  items: MenuItem[];
  align?: 'start' | 'end' | 'center';
  position?: 'top' | 'bottom';
  open?: boolean;
  openOnHover?: boolean;
  isDisabled?: boolean;
  menuClassName?: string;
  menuStyle?: CSSProperties;
  onOpenChange?: (open: boolean) => void;
};

export const Menu = ({
  items,
  align = 'start',
  position = 'bottom',
  open,
  openOnHover = false,
  isDisabled,
  menuClassName,
  menuStyle,
  anchorRef,
  onOpenChange,
}: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (open === undefined) {
        setInternalOpen(nextOpen);
      }
    },
    [onOpenChange, open]
  );

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  const renderedItems = useMemo(
    () =>
      items.map((item) => {
        const content =
          typeof item.label === 'string' ? (
            <span className="truncate">{item.label}</span>
          ) : (
            item.label
          );

        return (
          <Button
            key={item.id}
            className={clsx(
              'shrink-0 cursor-pointer rounded-xl bg-transparent',
              item.isDisabled && 'cursor-not-allowed opacity-40',
              item.className
            )}
            isDisabled={item.isDisabled}
            iconId={item.iconId}
            iconSize={item.iconSize || 20}
            status={item.status}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              if (item.isDisabled) return;
              item.onClick(e);
              handleClose();
            }}
          >
            {content}
          </Button>
        );
      }),
    [items, handleClose]
  );

  return (
    <Dropdown
      anchorRef={anchorRef}
      menuClassName={menuClassName}
      menuStyle={menuStyle}
      open={isOpen}
      openOnHover={openOnHover}
      align={align}
      position={position}
      isDisabled={isDisabled}
      onOpenChange={setOpen}
    >
      {renderedItems}
    </Dropdown>
  );
};
