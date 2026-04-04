import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Icon } from './Icon';
import { Menu, type MenuItem } from './Menu';
import { RippleEffect } from './RippleEffect';

export type SelectItem = {
  id: number | string;
  label: ReactNode;
  isDisabled?: boolean;
  onClick: MenuItem['onClick'];
};

export type Props = {
  items: SelectItem[];
  selectedId?: SelectItem['id'];
  placeholder?: string;
  position?: 'top' | 'bottom';
  align?: 'start' | 'end' | 'center';
  openOnHover?: boolean;
  isDisabled?: boolean;
  className?: string;
  menuClassName?: string;
  renderSelectedItem?: (item?: SelectItem) => ReactNode;
};

export const Select = ({
  items,
  selectedId,
  placeholder = 'Select',
  position = 'bottom',
  align = 'start',
  openOnHover = false,
  isDisabled,
  className,
  menuClassName,
  renderSelectedItem,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId),
    [items, selectedId]
  );

  const menuItems = useMemo<MenuItem[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        isDisabled: item.isDisabled,
        className: clsx(item.id === selectedId && 'bg-emerald-700/40!'),
        status: item.id === selectedId ? 'success' : 'regular',
        label: (
          <>
            <span className="truncate">{item.label}</span>
            {item.id === selectedId && (
              <Icon id="check" size={16} className="ml-auto w-auto pl-1.5 text-emerald-300" />
            )}
          </>
        ),
        onClick: (e) => item.onClick(e),
      })),
    [items, selectedId]
  );

  return (
    <div className="relative inline-flex">
      <div ref={anchorRef}>
        <div
          className={twMerge(
            clsx(
              'relative inline-flex h-9.5 cursor-pointer select-none items-center gap-1 rounded-full bg-white/10 px-3 text-white text-xs transition-all duration-350 ease-linear hover:bg-white/20',
              isDisabled && 'pointer-events-none cursor-default opacity-50',
              className
            )
          )}
        >
          {!isDisabled && <RippleEffect ref={anchorRef} />}
          {renderSelectedItem ? (
            renderSelectedItem(selectedItem)
          ) : (
            <span className="truncate">{selectedItem?.label ?? placeholder}</span>
          )}
          <Icon
            id="expand"
            size={22}
            className={clsx(
              'transition-transform duration-350 ease-in-out',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>
      <Menu
        anchorRef={anchorRef}
        menuClassName={menuClassName}
        open={isOpen}
        openOnHover={openOnHover}
        align={align}
        position={position}
        items={menuItems}
        isDisabled={isDisabled}
        onOpenChange={setIsOpen}
      />
    </div>
  );
};
