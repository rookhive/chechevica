import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

type Props = {
  isOpen?: boolean;
  duration?: number; // In seconds
  onClose?: () => void;
};

export default function Success({ isOpen = true, duration = 3, onClose }: Props) {
  const [open, setOpen] = useState(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      setOpen(false);
      onClose?.();
    }, duration * 1000);
    return () => clearTimeout(timeout);
  }, [isOpen, duration, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="-translate-1/2 absolute top-1/2 left-1/2 h-1/2 max-h-27 min-h-17">
          <div className="h-full pl-full">
            <motion.div
              className="-translate-1/2 absolute top-1/2 left-1/2 size-full rounded-full bg-black/75"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                transition: { type: 'spring', stiffness: 100, damping: 10 },
              }}
              exit={{
                opacity: 0,
                scale: 1.5,
                transition: { duration: 0.75, ease: 'easeInOut' },
              }}
            />
            <motion.svg
              className="relative"
              width="100%"
              height="100%"
              viewBox="0 0 50 50"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <motion.path
                d="M14.583 27.083l6.25 6.25 14.583-16.667"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, pathOffset: 0, opacity: 1 }}
                exit={{ pathLength: 1, pathOffset: 1, opacity: 0 }}
                transition={{ duration: 0.75, ease: 'easeInOut' }}
              />
            </motion.svg>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
