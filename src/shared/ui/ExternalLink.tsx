import { openUrl } from '@tauri-apps/plugin-opener';
import clsx from 'clsx';
import { useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

type Props = {
  href: string;
  title?: string;
  iconSize?: number;
  className?: string;
};

export const ExternalLink = ({ href, title, iconSize = 20, className }: Props) => {
  const linkRef = useRef<HTMLSpanElement>(null);

  return (
    <>
      <span
        ref={linkRef}
        className={twMerge(
          clsx(
            'inline-flex cursor-pointer items-center rounded-full p-1.25 text-blue-300 transition-colors duration-300 hover:bg-white/15',
            className
          )
        )}
        onClick={async (e) => {
          linkRef.current?.blur();
          e.preventDefault();
          e.stopPropagation();
          await openUrl(href);
        }}
      >
        <Icon id="external-link" size={iconSize} />
      </span>
      <Tooltip anchorRef={linkRef} position="top" status="info">
        {title}
      </Tooltip>
    </>
  );
};
