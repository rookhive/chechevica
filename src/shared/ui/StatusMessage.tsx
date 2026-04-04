import clsx from 'clsx';
import { motion } from 'motion/react';
import type { PropsWithChildren } from 'react';
import { twMerge } from 'tailwind-merge';
import { Link } from 'wouter';
import { Button } from './Button';
import { Icon, type Props as IconProps } from './Icon';

type Props = {
  status: 'regular' | 'success' | 'warning' | 'dangerous';
  iconId?: IconProps['id'];
  iconSize?: IconProps['size'];
  linkHref?: string;
  linkMessage?: string;
  className?: string;
};

export const StatusMessage = ({
  children,
  status = 'warning',
  iconId = 'warning',
  iconSize = 38,
  linkHref,
  linkMessage,
  className,
}: PropsWithChildren<Props>) => {
  const getStylesByStatus = () => {
    switch (status) {
      case 'success':
        return 'bg-emerald-600/15 text-emerald-500';
      case 'warning':
        return 'bg-yellow-400/15 text-yellow-400';
      case 'dangerous':
        return 'bg-red-700/15 text-red-600';
      default:
        return 'bg-white/7.5 text-white';
    }
  };

  return (
    <motion.div
      className={twMerge(
        clsx('absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2', className)
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col items-center gap-2 p-4">
        <div className={clsx('rounded-full p-3.5', getStylesByStatus())}>
          <Icon id={iconId} size={iconSize} className="opacity-80" />
        </div>
        <div className="flex flex-col items-center gap-2.5 text-base">{children}</div>
        {!!linkHref && (
          <Link href={linkHref} className="mt-0.5 text-emerald-400">
            <Button isUppercased>{linkMessage}</Button>
          </Link>
        )}
      </div>
    </motion.div>
  );
};
