import { type Easing, motion } from 'motion/react';
import type { PropsWithChildren } from 'react';

type Props = {
  className?: string;
  duration?: number;
  ease?: Easing;
};

export const Animated = ({
  children,
  className,
  duration = 0.35, // In seconds
  ease = 'linear',
}: PropsWithChildren<Props>) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, ease }}
    >
      {children}
    </motion.div>
  );
};
