import clsx from 'clsx';
import type { PropsWithChildren } from 'react';
import { Button, type Props as ButtonProps } from '@/shared/ui/Button';

type Props = PropsWithChildren<{
  onClick: () => void;
  isClose?: boolean;
  iconId: ButtonProps['iconId'];
}>;

export const WindowControlButton = ({ iconId, isClose = false, onClick }: Props) => {
  return (
    <Button
      className={clsx(
        'size-10 rounded-lg bg-transparent transition-colors duration-300 ease-out',
        isClose ? 'hover:bg-red-600/90' : 'hover:bg-white/10'
      )}
      iconId={iconId}
      iconSize={20}
      iconClassName="fill-none"
      onClick={onClick}
    />
  );
};
