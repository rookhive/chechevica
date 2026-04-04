import { useEffect, useState } from 'react';
import { formatDistanceToNow } from '../lib/time';
import type { Option } from '../types/common';

type Props = {
  date: Option<Date>;
};

export const LiveTimeDistance = ({ date }: Props) => {
  const [time, setTime] = useState<Option<string>>(null);

  useEffect(() => {
    if (!date) return;
    let timerId: ReturnType<typeof setTimeout>;

    (function update() {
      setTime(formatDistanceToNow(date));
      timerId = setTimeout(update, getDelay(date));
    })();

    return () => clearTimeout(timerId);
  }, [date]);

  return time ?? null;
};

const getDelay = (date: Date) => {
  const elapsedMs = Date.now() - date.getTime();
  // If more than an hour has passed, update every hour
  if (elapsedMs > 3600_000) return 3600_000;
  // If more than a minute has passed, update every minute, otherwise - every second
  return elapsedMs < 60_000 ? 1000 : 60_000;
};
