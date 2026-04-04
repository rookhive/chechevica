import { useEffect } from 'react';
import type { Option } from '../types/common';

export type KeyDownBinding = {
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
};

export type UseKeyDownOptions = {
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
  { enabled = true, target }: UseKeyDownOptions = {}
) => {
  useEffect(() => {
    const resolvedTarget = target ?? window;
    if (!enabled || !resolvedTarget || bindings.length === 0) {
      return;
    }

    const handleKeyDown = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;

      for (const binding of bindings) {
        if (!matchesBinding(binding, keyboardEvent)) continue;
        if (binding.preventDefault !== false) keyboardEvent.preventDefault();
        if (binding.stopPropagation) keyboardEvent.stopPropagation();
        binding.onKeyDown(keyboardEvent);
        break;
      }
    };

    resolvedTarget.addEventListener('keydown', handleKeyDown);
    return () => {
      resolvedTarget.removeEventListener('keydown', handleKeyDown);
    };
  }, [bindings, enabled, target]);
};
