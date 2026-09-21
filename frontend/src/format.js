// Display helpers. Missing values render as "-".

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '-';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

// mm:ss for the live quiz timer
export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined) return '-';
  return `${Math.round(ratio * 100)}%`;
}

export function formatDate(iso, { time = false } = {}) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
};

export function typeLabel(type) {
  return QUESTION_TYPES[type] ?? type;
}

// "Today", "Yesterday", "3 days ago", then a plain date. Counts local calendar days, not 24-hour spans.
export function formatAgo(iso, now = new Date()) {
  if (!iso) return '-';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '-';
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(when.getFullYear(), when.getMonth(), when.getDate())) /
      86_400_000
  );
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}
