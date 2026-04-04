import { useEffect } from 'react';
import type { Option } from '@/shared/types/common';
import { useTab } from './useTab';

type KeyDownBinding = {
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
};

type UseKeyDownOptions = {
  enabled?: boolean;
  target?: Option<EventTarget>;
};

const matchesModifier = (expected: boolean | undefined, actual: boolean) =>
  expected === undefined ? true : expected === actual;

const matchesBinding = (binding: KeyDownBinding, e: KeyboardEvent) => {
  if (binding.code !== e.code) return false;

  return (
    matchesModifier(binding.altKey, e.altKey) &&
    matchesModifier(binding.ctrlKey, e.ctrlKey) &&
    matchesModifier(binding.shiftKey, e.shiftKey)
  );
};

export const useKeyDown = (
  bindings: KeyDownBinding[],
  { enabled = true, target = window }: UseKeyDownOptions = {}
) => {
  const { isTabActive } = useTab();

  useEffect(() => {
    if (!isTabActive || !enabled || !target || bindings.length === 0) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const binding of bindings) {
        if (!matchesBinding(binding, e)) continue;
        if (binding.preventDefault !== false) e.preventDefault();
        if (binding.stopPropagation) e.stopPropagation();
        binding.onKeyDown(e);
        break;
      }
    };

    (target as HTMLElement).addEventListener('keydown', handleKeyDown);
    return () => {
      (target as HTMLElement).removeEventListener('keydown', handleKeyDown);
    };
  }, [bindings, enabled, target, isTabActive]);
};
