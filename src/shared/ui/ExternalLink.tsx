import { openUrl } from '@tauri-apps/plugin-opener';
import clsx from 'clsx';
import { Button, type Props as ButtonProps } from './Button';

type Props = {
  href: string;
  tooltip?: ButtonProps['tooltip'];
  iconSize?: ButtonProps['iconSize'];
  className?: string;
};

export const ExternalLink = ({ href, tooltip, iconSize = 20, className }: Props) => {
  return (
    <Button
      className={clsx('size-auto p-1.25 text-blue-300', className)}
      iconId="external-link"
      iconSize={iconSize}
      tooltip={tooltip}
      tooltipStatus="info"
      tooltipPosition="top"
      onClick={async (e) => {
        e.stopPropagation();
        await openUrl(href);
      }}
    />
  );
};
