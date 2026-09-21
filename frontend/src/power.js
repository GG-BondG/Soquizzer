// The dashboard's pentagon "power" chart. Every finished quiz (attempt) is a snapshot: the five scores below,
// worked out from that attempt and everything before it, each from 0 to 100. Snapshots are recomputed from
// GET /api/history every time, so nothing extra is stored and the backend does not change.

import { dayKey } from './activity.js';

export const POWER_AXES = [
  { key: 'accuracy', label: 'Accuracy' }, // share of answers that were right, over the last few quizzes
  { key: 'speed', label: 'Speed' }, // correct answers per minute, over the last few quizzes
  { key: 'volume', label: 'Volume' }, // questions answered so far
  { key: 'streak', label: 'Streak' }, // days practised in the past week
  { key: 'breadth', label: 'Breadth' }, // different sections practised
];

// "Recent" means this many quizzes, ending at the snapshot's own quiz.
export const RECENT_QUIZZES = 5;
// What earns a full 100 on the other axes.
export const FULL_SPEED_PER_MINUTE = 2.5; // correct answers per minute
export const FULL_VOLUME_QUESTIONS = 300; // 15 quizzes of 20
export const FULL_STREAK_DAYS = 5; // out of the 7 days ending on the quiz's day
export const FULL_BREADTH_SECTIONS = 5;

const STREAK_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// whole local calendar days between two dates, ignoring the time of day (and daylight-saving shifts)
function daysBetween(later, earlier) {
  const a = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  const b = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / DAY_MS);
}

// The five scores after the last item of `upTo` (attempts oldest first, each with a `when` Date).
function scoresAfter(upTo) {
  const latest = upTo[upTo.length - 1];
  const recent = upTo.slice(-RECENT_QUIZZES);

  const recentCorrect = recent.reduce((sum, a) => sum + a.score, 0);
  const recentTotal = recent.reduce((sum, a) => sum + a.total, 0);
  const accuracy = recentTotal ? (recentCorrect / recentTotal) * 100 : 0;

  // only quizzes with a recorded time count, or a missing time would look infinitely fast
  const timed = recent.filter((a) => a.time_spent_seconds > 0);
  const timedMinutes = timed.reduce((sum, a) => sum + a.time_spent_seconds, 0) / 60;
  const timedCorrect = timed.reduce((sum, a) => sum + a.score, 0);
  const speed = timedMinutes ? (timedCorrect / timedMinutes / FULL_SPEED_PER_MINUTE) * 100 : 0;

  const questions = upTo.reduce((sum, a) => sum + a.total, 0);

  const activeDays = new Set(
    upTo.filter((a) => daysBetween(latest.when, a.when) < STREAK_WINDOW_DAYS).map((a) => dayKey(a.when))
  );
  const sections = new Set(upTo.map((a) => a.section_id));

  return {
    accuracy: clampScore(accuracy),
    speed: clampScore(speed),
    volume: clampScore((questions / FULL_VOLUME_QUESTIONS) * 100),
    streak: clampScore((activeDays.size / FULL_STREAK_DAYS) * 100),
    breadth: clampScore((sections.size / FULL_BREADTH_SECTIONS) * 100),
  };
}

export function totalPower(scores) {
  const sum = POWER_AXES.reduce((acc, { key }) => acc + scores[key], 0);
  return Math.round(sum / POWER_AXES.length);
}

// `attempts` are the objects from GET /api/history (any order). Returns one snapshot per attempt, oldest first:
// { attemptId, when, scores: { accuracy, speed, volume, streak, breadth }, power }
export function buildPowerHistory(attempts) {
  const ordered = (attempts ?? [])
    .map((a) => ({ ...a, when: new Date(a?.submitted_at) }))
    .filter((a) => !Number.isNaN(a.when.getTime()))
    .sort((a, b) => a.when - b.when);

  return ordered.map((attempt, i) => {
    const scores = scoresAfter(ordered.slice(0, i + 1));
    return { attemptId: attempt.attempt_id, when: attempt.when, scores, power: totalPower(scores) };
  });
}

// The five corner points of a pentagon whose first axis points straight up and the rest follow clockwise.
// `values` is one 0 to 100 number per axis; `radius` is the length of a full 100.
export function radarPoints(values, cx, cy, radius) {
  return values.map((value, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
    const length = (radius * value) / 100;
    return { x: cx + length * Math.cos(angle), y: cy + length * Math.sin(angle) };
  });
}

export function pointsAttr(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
