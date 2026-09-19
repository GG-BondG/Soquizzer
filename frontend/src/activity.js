// Turns quiz attempts into a GitHub-style contribution grid: one cell per day, weeks as columns
// (Sunday first), the newest week last. Days are the viewer's local calendar days.

export const ACTIVITY_WEEKS = 26;

function dayKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

// 0 = no quizzes; 1 to 4 = darker shades.
export function activityLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// `attempts` are the objects from GET /api/history. Returns
// { weeks: [[{ key, date, count, level }, ...7 days], ...], total }
// `total` counts the attempts inside the window. Days after `today` are `null`.
export function buildActivity(attempts, { weeks = ACTIVITY_WEEKS, today = new Date() } = {}) {
  const counts = new Map();
  for (const attempt of attempts ?? []) {
    if (!attempt?.submitted_at) continue;
    const when = new Date(attempt.submitted_at);
    if (Number.isNaN(when.getTime())) continue;
    const key = dayKey(when);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const firstDay = day - today.getDay() - (weeks - 1) * 7; // the Sunday that starts the first column

  const grid = [];
  let total = 0;
  for (let w = 0; w < weeks; w++) {
    const column = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(year, month, firstDay + w * 7 + d);
      if (date > today) {
        column.push(null);
        continue;
      }
      const key = dayKey(date);
      const count = counts.get(key) ?? 0;
      total += count;
      column.push({ key, date, count, level: activityLevel(count) });
    }
    grid.push(column);
  }
  return { weeks: grid, total };
}
