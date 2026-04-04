import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import type { Option } from '../types/common';
import { Icon, type Props as IconProps } from './Icon';

type Props = {
  path?: Option<string>;
  iconId?: IconProps['id'];
  iconSize?: IconProps['size'];
};

export const Thumbnail = ({ path, iconId, iconSize }: Props) => {
  const [resolvedPath, setResolvedPath] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (!path) {
      setResolvedPath('');
      setIsLoaded(false);
      return () => {
        isCancelled = true;
      };
    }

    const fetchThumbnailPath = async (sourcePath: string) => {
      if (!isCancelled) setResolvedPath(convertFileSrc(sourcePath));
    };
    fetchThumbnailPath(path).catch(() => {
      if (!isCancelled) setResolvedPath('');
    });

    return () => {
      isCancelled = true;
    };
  }, [path]);

  return (
    <div className="absolute inset-0 bg-neutral-900 bg-radial from-neutral-900 to-neutral-950">
      {!resolvedPath && !!iconId && (
        <Icon
          id={iconId}
          size={iconSize || 48}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-15"
        />
      )}
      {!!resolvedPath && (
        <img
          className={clsx(
            'h-full w-full object-cover transition-opacity duration-500',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          src={resolvedPath}
          alt="Thumbnail"
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
};
