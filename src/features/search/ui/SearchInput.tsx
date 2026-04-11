import clsx from 'clsx';
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { useSnapshot } from 'valtio';
import { useProcessingSourcesSummary } from '@/entities/source';
import { Input } from '@/shared/ui/Input';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useKeyDown } from '@/shared/ui/useKeyDown';
import { useSearchStore } from './hooks';
import { SearchControls } from './SearchControls';

export const SearchInput = () => {
  const { processingCount } = useProcessingSourcesSummary();
  const { state, search, setSearchString, setIsInputFocused, setIsOverlayOpen } = useSearchStore();
  const { searchString, searchPlaceholder, isSearching, isInputFocused } = useSnapshot(state);
  const [value, setValue] = useState(searchString);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isWorking = processingCount > 0;

  const handleFocus = () => {
    setIsInputFocused(true);
    setIsOverlayOpen(true);
  };

  const handleBlur = () => {
    setIsInputFocused(false);
    if (!value) {
      setIsOverlayOpen(false);
    }
  };

  const handleChange = (value: string) => {
    setValue(value);
    setSearchString(value);
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    search();
  };

  useEffect(() => {
    setValue((value) => (value !== searchString ? searchString : value));
  }, [searchString]);

  useEffect(() => {
    if (!isInputFocused) {
      inputRef.current?.blur();
      return;
    }
    const rafTimer = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(rafTimer);
  }, [isInputFocused]);

  useKeyDown(
    useMemo(
      () => [
        {
          code: 'KeyF',
          ctrlKey: true,
          onKeyDown: () => inputRef.current?.focus(),
        },
      ],
      []
    )
  );

  return (
    <form
      ref={formRef}
      className={twMerge(
        clsx(
          'relative z-20 flex w-full min-w-0 items-center rounded-full bg-emerald-700/20 text-sm transition-all duration-350 ease-out will-change-contents hover:bg-emerald-700/30',
          (isInputFocused || !!value) &&
            'translate-y-2 scale-105 bg-emerald-700/40 shadow-lg hover:bg-emerald-700/40',
          isSearching && 'pointer-events-none'
        )
      )}
      onSubmit={isSearching || isWorking ? undefined : handleSubmit}
    >
      <Input
        inputRef={inputRef}
        className="grow bg-transparent! text-emerald-200 hover:bg-transparent!"
        iconId="search"
        value={value}
        placeholder={searchPlaceholder}
        isDisabled={isSearching || isWorking}
        isLoading={isSearching}
        rippleDuration={1.5}
        rightSlot={<SearchControls />}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <Tooltip anchorRef={formRef} position="bottom" status="info">
        {isWorking && 'Search is unavailable while sources are processing'}
      </Tooltip>
    </form>
  );
};
