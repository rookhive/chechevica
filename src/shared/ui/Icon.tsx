import clsx from 'clsx';
import { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';
import sprite from './assets/icons.svg?raw';

export type Props = {
  id:
    | 'window-minimize'
    | 'window-maximize'
    | 'window-restore'
    | 'window-close'
    | 'check'
    | 'youtube'
    | 'back'
    | 'forward'
    | 'search'
    | 'settings'
    | 'play'
    | 'pause'
    | 'volume'
    | 'external-link'
    | 'audio'
    | 'video'
    | 'sync'
    | 'download'
    | 'folder'
    | 'file-in-folder'
    | 'select-items'
    | 'clear'
    | 'replay-10'
    | 'forward-10'
    | 'expand'
    | 'add'
    | 'remove'
    | 'projects'
    | 'project'
    | 'new-tab'
    | 'collection'
    | 'more'
    | 'trash'
    | 'error'
    | 'warning'
    | 'image'
    | 'edit'
    | 'space'
    | 'magic'
    | 'keyword'
    | 'star'
    | 'job'
    | 'restart'
    | 'copy'
    | 'sort'
    | 'upward'
    | 'downward';
  size?: number;
  className?: string;
};

export const Icon = ({ id, size = 24, className }: Props) => {
  useEffect(() => {
    const spriteId = 'icons-sprite';
    if (document.getElementById(spriteId)) return;
    document.body.prepend(
      Object.assign(document.createElement('div'), {
        id: spriteId,
        style: 'display: none;',
        innerHTML: sprite,
      })
    );
  }, []);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={twMerge(clsx('inline-flex fill-current', className))}
    >
      <use href={`#${id}`} />
    </svg>
  );
};
