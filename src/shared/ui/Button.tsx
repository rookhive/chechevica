import clsx from 'clsx';
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { twMerge } from 'tailwind-merge';
import type { Option } from '../types/common';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { Dialog, type Props as DialogProps } from './Dialog';
import { Icon, type Props as IconProps } from './Icon';
import { RippleEffect } from './RippleEffect';
import { Spinner } from './Spinner';
import { Tooltip, type Props as TooltipProps } from './Tooltip';

export type Props = {
  status?: 'regular' | 'success' | 'dangerous' | 'info';
  iconId?: IconProps['id'];
  iconSize?: IconProps['size'];
  iconClassName?: string;
  isDisabled?: boolean;
  isDisabledWhileLoading?: boolean;
  isLoading?: boolean;
  isUppercased?: boolean;
  isCapitalized?: boolean;
  rippleColor?: string;
  tooltip?: ReactNode;
  tooltipStatus?: TooltipProps['status'];
  tooltipPosition?: TooltipProps['position'];
  withConfirmation?: boolean;
  dialogTitle?: DialogProps['title'];
  dialogMessage?: ReactNode;
  dialogConfirmLabel?: DialogProps['confirmLabel'];
  dialogCancelLabel?: DialogProps['cancelLabel'];
  dialogConfirmButtonStatus?: DialogProps['confirmButtonStatus'];
  contextMenuItems?: ContextMenuItem[];
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
} & PropsWithChildren<ComponentPropsWithRef<'button'>>;

export const Button = ({
  ref,
  type = 'button',
  children,
  status,
  iconId,
  iconSize,
  iconClassName,
  className,
  isDisabled,
  isDisabledWhileLoading = true,
  isLoading: externalIsLoading,
  isUppercased,
  isCapitalized,
  rippleColor,
  tooltip,
  tooltipStatus,
  tooltipPosition,
  withConfirmation,
  dialogTitle,
  dialogMessage,
  dialogConfirmLabel,
  dialogCancelLabel,
  dialogConfirmButtonStatus,
  contextMenuItems,
  onClick,
  ...props
}: Props) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isLoading, setIsLoading] = useState(externalIsLoading);
  const hasContent = !!children;
  const hasIcon = !!iconId;

  useEffect(() => {
    setIsLoading(externalIsLoading);
  }, [externalIsLoading]);

  const setButtonRef = useCallback(
    (node: HTMLButtonElement) => {
      buttonRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  const getStylesByStatus = () => {
    switch (status) {
      case 'success':
        return 'bg-emerald-700/20 hover:bg-emerald-700/40 text-emerald-300';
      case 'dangerous':
        return 'bg-red-700/20 hover:bg-red-700/30 text-red-300';
      case 'info':
        return 'bg-sky-500/80 hover:bg-sky-500/90 text-white';
      default:
        return 'bg-white/5 hover:bg-white/10';
    }
  };

  const getRippleColorByStatus = () => {
    switch (status) {
      case 'success':
        return 'bg-emerald-700/30';
      case 'dangerous':
        return 'bg-red-700/30';
      case 'info':
        return 'bg-sky-500/30';
    }
  };

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (isDisabled || (isLoading && isDisabledWhileLoading)) return;
      const result = onClick?.(e);
      if (result && typeof (result as Promise<void>).then === 'function') {
        setIsLoading(true);
        Promise.resolve(result).finally(() => {
          setIsLoading(false);
        });
      }
    },
    [isDisabled, isLoading, isDisabledWhileLoading, onClick]
  );

  return (
    <>
      <button
        ref={setButtonRef}
        {...props}
        type={type}
        disabled={isDisabled || (isLoading && isDisabledWhileLoading)}
        className={twMerge(
          clsx(
            'relative inline-flex h-10 items-center gap-1.5 rounded-full px-4 transition-all duration-200 ease-linear',
            hasIcon && (hasContent ? 'pl-2' : 'size-10 justify-center pr-0 pl-0'),
            isDisabled || (isLoading && isDisabledWhileLoading)
              ? 'cursor-default'
              : 'cursor-pointer',
            isDisabled ? 'opacity-50' : 'opacity-100',
            getStylesByStatus(),
            className
          )
        )}
        onClick={withConfirmation ? undefined : handleClick}
      >
        {!isDisabled && (
          <RippleEffect ref={buttonRef} color={rippleColor || getRippleColorByStatus()} />
        )}
        {hasIcon && (
          <Icon
            id={iconId}
            size={iconSize || 24}
            className={clsx(
              'pointer-events-none relative shrink-0 transition-opacity duration-150',
              isLoading && 'opacity-0',
              iconClassName
            )}
          />
        )}
        {hasContent && (
          <div
            className={clsx(
              'pointer-events-none relative flex grow items-center whitespace-nowrap font-semibold text-xs transition-opacity duration-150',
              isUppercased && 'uppercase',
              isCapitalized && 'capitalize',
              isLoading && 'opacity-0'
            )}
          >
            {children}
          </div>
        )}
        {isLoading && <Spinner size={16} absoluteCentered />}
      </button>
      <Tooltip anchorRef={buttonRef} position={tooltipPosition} status={tooltipStatus}>
        {tooltip}
      </Tooltip>
      {withConfirmation && (
        <ConfirmationDialog
          anchorRef={buttonRef}
          title={dialogTitle!}
          message={dialogMessage}
          confirmLabel={dialogConfirmLabel}
          cancelLabel={dialogCancelLabel}
          confirmButtonStatus={dialogConfirmButtonStatus}
          onConfirm={onClick}
        />
      )}
      {!!contextMenuItems && <ContextMenu anchor={buttonRef} items={contextMenuItems} />}
    </>
  );
};

const ConfirmationDialog = ({
  anchorRef,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmButtonStatus,
  onConfirm,
}: {
  anchorRef: RefObject<Option<HTMLElement>>;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmButtonStatus?: DialogProps['confirmButtonStatus'];
  onConfirm: Props['onClick'];
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: Event) => {
      if (anchorRef.current?.contains(e.target as Node)) {
        setIsDialogOpen(true);
      }
    };
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [anchorRef]);

  const handleConfirm = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      await onConfirm?.(e);
      setIsDialogOpen(false);
    },
    [onConfirm]
  );

  const handleCancel = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  return (
    <Dialog
      title={title}
      isOpen={isDialogOpen}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmButtonStatus={confirmButtonStatus}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    >
      {message}
    </Dialog>
  );
};
