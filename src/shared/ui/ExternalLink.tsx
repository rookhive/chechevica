import clsx from 'clsx';
import { useRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

export const ExternalLink = ({
  href,
  title,
  iconSize = 20,
  className,
}: {
  href: string;
  title?: string;
  iconSize?: number;
  className?: string;
}) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    <>
      <a
        ref={linkRef}
        className={twMerge(
          clsx(
            'inline-flex items-center rounded-full p-1.25 text-blue-300 transition-colors duration-300 hover:bg-white/15',
            className
          )
        )}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon id="external-link" size={iconSize} />
      </a>
      <Tooltip anchorRef={linkRef} position="top" status="info">
        {title}
      </Tooltip>
    </>
  );
};
