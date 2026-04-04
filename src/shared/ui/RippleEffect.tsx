import clsx from 'clsx';
import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react';
import type { Option } from '../types/common';

type Wave = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type Props = {
  ref: RefObject<Option<HTMLElement>>;
  duration?: number; // In seconds
  color?: string; // Tailwind background color class
};

export const RippleEffect = ({ ref, duration = 0.7, color = 'bg-white/10' }: Props) => {
  const [waves, setWaves] = useState<Wave[]>([]);
  const nextId = useRef(0);
  const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    return () => {
      for (const timeoutId of timeouts.current.values()) clearTimeout(timeoutId);
      timeouts.current.clear();
    };
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { x, y, width, height } = element.getBoundingClientRect();
      const size = Math.max(width, height) * Math.SQRT2;
      const id = nextId.current++;
      setWaves((waves) => [
        ...waves,
        { id, x: e.clientX - x - size / 2, y: e.clientY - y - size / 2, size },
      ]);
      timeouts.current.set(
        id,
        setTimeout(
          () => {
            setWaves((waves) => waves.filter((wave) => wave.id !== id));
            timeouts.current.delete(id);
          },
          duration * 1000 + 50
        )
      );
    };

    element.addEventListener('pointerdown', handleMouseDown);
    return () => element.removeEventListener('pointerdown', handleMouseDown);
  }, [ref, duration]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] will-change-transform contain-strict"
      style={{ '--duration': `${duration}s` } as CSSProperties}
    >
      {waves.map(({ id, x, y, size }) => (
        <span
          key={id}
          className={clsx('pointer-events-none absolute animate-ripple rounded-full', color)}
          style={{ left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` }}
        />
      ))}
    </div>
  );
};
