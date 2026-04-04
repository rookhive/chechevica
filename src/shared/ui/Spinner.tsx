import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

type Props = {
  direction?: 'clockwise' | 'counter-clockwise';
  size?: number;
  absoluteCentered?: boolean;
  className?: string;
};

export const Spinner = ({
  direction = 'clockwise',
  size = 16,
  absoluteCentered = false,
  className,
}: Props) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const arc = (2 / 3) * circumference;
  const gap = circumference - arc;
  const dasharray = `${arc.toFixed(3)} ${gap.toFixed(3)}`;

  return (
    <div
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center',
          absoluteCentered ? '-translate-1/2 absolute top-1/2 left-1/2' : 'relative',
          className
        )
      )}
      style={{ height: size, width: size }}
    >
      <div
        className={clsx(
          'absolute inset-0 animate-spin',
          '[animation-duration:750ms]',
          '[animation-timing-function:linear]',
          '[animation-iteration-count:infinite]',
          direction === 'clockwise'
            ? '[animation-direction:normal]'
            : '[animation-direction:reverse] [animation-duration:1500ms]'
        )}
      >
        <svg viewBox="0 0 32 32">
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeDasharray={dasharray}
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="currentColor"
          />
        </svg>
      </div>
    </div>
  );
};
