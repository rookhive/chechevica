import { formatDistanceToNowStrict } from 'date-fns';
import type { Option } from '../types/common';

// Format seconds to HH:MM:SS
export const formatSeconds = (duration: Option<number>) => {
  if (duration == null) return null;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  const parts = [minutes, seconds];
  if (hours > 0) parts.unshift(hours);
  return parts.map((n) => String(n).padStart(2, '0')).join(':');
};

export const formatMilliseconds = (milliseconds: Option<number>) => {
  if (milliseconds == null) return null;
  return formatSeconds(milliseconds / 1000);
};

// Format milliseconds to format like "1h 2m 3s" or "less than a second"
export const formatDuration = (milliseconds: number) => {
  const duration = milliseconds / 1000;
  if (duration < 1) return 'less than a second';
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration / 60) % 60);
  const seconds = Math.floor(duration % 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ');
};

export const formatDistanceToNow = (timestamp: Option<number | Date>) => {
  if (timestamp == null) return null;
  return formatDistanceToNowStrict(timestamp, { addSuffix: true });
};
