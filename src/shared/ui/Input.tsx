import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import { type MouseEvent, type ReactNode, type RefObject, useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import type { Option } from '../types/common';
import { Animated } from './Animated';
import { Button } from './Button';
import { Icon, type Props as IconProps } from './Icon';
import { RippleEffect } from './RippleEffect';
import { Spinner } from './Spinner';

type Props = {
  inputRef?: RefObject<Option<HTMLInputElement>>;
  value: string;
  className?: string;
  iconClassName?: string;
  inputClassName?: string;
  iconId?: IconProps['id'];
  placeholder?: string;
  autoFocus?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  rightSlot?: ReactNode;
  rippleDuration?: number; // In seconds
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

export const Input = ({
  inputRef,
  value,
  className,
  iconClassName,
  inputClassName,
  iconId,
  placeholder,
  autoFocus,
  isDisabled,
  isLoading,
  rightSlot,
  rippleDuration,
  onChange,
  onFocus,
  onBlur,
}: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const hasIcon = !!iconId;

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    const inputNode = inputRef?.current ?? internalInputRef.current;
    if (!inputNode || e.target === inputNode) return;
    e.preventDefault();
    inputNode.focus();
  };

  return (
    <div
      ref={wrapperRef}
      className={twMerge(
        'group/input relative flex h-10 cursor-text items-center rounded-full bg-white/5 pr-1 pl-2 shadow-[inset_0_0_4px_2px_rgb(255_255_255/5%)] outline-2 outline-transparent transition-all duration-350 ease-linear focus-within:bg-emerald-700/40 focus-within:outline-2 focus-within:outline-emerald-700 hover:bg-emerald-700/30',
        isDisabled && 'pointer-events-none! opacity-50!',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      <RippleEffect ref={wrapperRef} color="bg-white/5" duration={rippleDuration} />
      {hasIcon && (
        <div
          className={clsx(
            'relative ml-1 inline-flex size-6 shrink-0 items-center justify-center text-current/60',
            iconClassName
          )}
        >
          <AnimatePresence initial={false}>
            {isLoading ? (
              <Animated key="spinner" duration={0.2}>
                <Spinner absoluteCentered size={16} />
              </Animated>
            ) : (
              <Animated key="icon" duration={0.2}>
                <Icon id={iconId} size={20} />
              </Animated>
            )}
          </AnimatePresence>
        </div>
      )}
      <input
        ref={inputRef ?? internalInputRef}
        type="text"
        value={value}
        className={twMerge(
          'relative min-w-0 grow self-stretch border-none bg-transparent px-2 text-sm outline-none focus:border-none focus:outline-none',
          inputClassName
        )}
        autoFocus={autoFocus}
        disabled={isDisabled}
        onChange={isDisabled ? undefined : (e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <Button
        className="size-8 shrink-0 bg-transparent opacity-15 transition duration-200 group-hover/input:opacity-50"
        iconId="clear"
        iconSize={18}
        onClick={isDisabled ? undefined : () => onChange?.('')}
      />
      {rightSlot}
      <div
        className={clsx(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 select-none text-current/60 text-sm transition-all duration-200 ease-linear',
          value && 'translate-x-2 opacity-0',
          hasIcon ? 'left-11' : 'left-4'
        )}
      >
        {placeholder}
      </div>
    </div>
  );
};
