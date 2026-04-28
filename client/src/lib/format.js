import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

export function relativeTime(date) {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function absoluteTime(date) {
  if (!date) return '—';
  try {
    return format(new Date(date), 'd MMM yyyy, HH:mm');
  } catch {
    return '—';
  }
}

export function dayLabel(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM yyyy');
}

export function timeOfDay(date) {
  if (!date) return '';
  try {
    return format(new Date(date), 'HH:mm');
  } catch {
    return '';
  }
}

export function formatPhone(number) {
  if (!number) return '';
  const n = String(number);
  if (n.startsWith('358')) return `+${n}`;
  if (n.startsWith('0')) return `+358${n.slice(1)}`;
  return n;
}

export const STATUS_META = {
  booked: { label: 'Booked', color: 'moss' },
  replied: { label: 'Replied', color: 'amber' },
  read: { label: 'Read', color: 'teal' },
  delivered: { label: 'Delivered', color: 'ink-3' },
  sent: { label: 'Sent', color: 'gray' },
  failed: { label: 'Failed', color: 'sienna' },
  stopped: { label: 'Stopped', color: 'sienna' },
};
