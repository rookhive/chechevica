import { memo, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { useSearchStore } from './hooks';

type Props = {
  text: string;
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SearchHighlighter = memo(({ text }: Props) => {
  const { state } = useSearchStore();
  const { searchResults } = useSnapshot(state);
  const { searchString, isStrictSearch } = searchResults?.request || {};

  const pattern = useMemo(() => {
    if (!searchString) return '';
    if (isStrictSearch) return escapeRegex(searchString);
    const parts = searchString.match(/(\p{L}{3,})|(?<!\p{L})\p{L}{1,2}(?!\p{L})|\p{N}+/gu) || [];
    return parts
      .map((part) => {
        const escaped = escapeRegex(part);
        return part.length < 3 ? `(?<!\\p{L})${escaped}(?!\\p{L})` : escaped;
      })
      .join('|');
  }, [isStrictSearch, searchString]);

  const regex = useMemo(() => (pattern ? new RegExp(`(${pattern})`, 'giu') : null), [pattern]);

  if (!regex) return text;

  return (
    <>
      {text.split(regex).map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="rounded-sm bg-emerald-600 text-white">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
});
