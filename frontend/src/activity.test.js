import { activityLevel, buildActivity, recentAttempts, summarizeActivity } from './activity.js';

// Saturday 19 Sep 2026, midday local time, so a UTC offset cannot push it onto another day.
const TODAY = new Date(2026, 8, 19, 12, 0, 0);

function attemptOn(y, m, d, hour = 10) {
  return { submitted_at: new Date(y, m, d, hour).toISOString() };
}

describe('activityLevel', () => {
  it('maps counts to five shades', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(activityLevel)).toEqual([0, 1, 2, 3, 3, 4, 4]);
  });
});

describe('buildActivity', () => {
  it('lays out whole weeks, Sunday first, ending on today', () => {
    const { weeks } = buildActivity([], { weeks: 4, today: TODAY });
    expect(weeks).toHaveLength(4);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].date.getDay()).toBe(0);
    // today is a Saturday, so the last column is full and ends on it
    expect(weeks[3][6].key).toBe('2026-09-19');
    expect(weeks[0][0].key).toBe('2026-08-23');
  });

  it('leaves days after today empty', () => {
    const wednesday = new Date(2026, 8, 16, 12);
    const { weeks } = buildActivity([], { weeks: 2, today: wednesday });
    expect(weeks[1].map((d) => d?.key ?? null)).toEqual([
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      null,
      null,
      null,
    ]);
  });

  it('counts several attempts on the same local day', () => {
    const attempts = [attemptOn(2026, 8, 19, 8), attemptOn(2026, 8, 19, 23), attemptOn(2026, 8, 18)];
    const { weeks, total } = buildActivity(attempts, { weeks: 2, today: TODAY });
    const byKey = Object.fromEntries(weeks.flat().filter(Boolean).map((d) => [d.key, d]));
    expect(byKey['2026-09-19'].count).toBe(2);
    expect(byKey['2026-09-19'].level).toBe(2);
    expect(byKey['2026-09-18'].count).toBe(1);
    expect(byKey['2026-09-17'].count).toBe(0);
    expect(total).toBe(3);
  });

  it('ignores attempts outside the window and ones without a usable date', () => {
    const attempts = [attemptOn(2026, 0, 1), { submitted_at: null }, { submitted_at: 'nonsense' }, attemptOn(2026, 8, 19)];
    const { total } = buildActivity(attempts, { weeks: 4, today: TODAY });
    expect(total).toBe(1);
  });

  it('copes with a missing attempts list', () => {
    expect(buildActivity(undefined, { weeks: 1, today: TODAY }).total).toBe(0);
  });
});

describe('summarizeActivity', () => {
  const quiz = (d, score = 10, total = 20, hour = 10) => ({
    submitted_at: new Date(2026, 8, d, hour).toISOString(),
    score,
    total,
  });

  it('is all zero with no attempts', () => {
    expect(summarizeActivity([], { today: TODAY })).toEqual({ streak: 0, thisWeek: 0, bestScore: null });
  });

  it('counts consecutive days ending today, and stops at a gap', () => {
    const attempts = [quiz(19), quiz(19, 5, 20, 18), quiz(18), quiz(17), quiz(15)];
    expect(summarizeActivity(attempts, { today: TODAY }).streak).toBe(3);
  });

  it('keeps yesterday\'s streak alive until today is over', () => {
    expect(summarizeActivity([quiz(18), quiz(17)], { today: TODAY }).streak).toBe(2);
    expect(summarizeActivity([quiz(17)], { today: TODAY }).streak).toBe(0);
  });

  it('counts the last 7 days including today for this week', () => {
    // today is the 19th, so the 13th is the first day inside the week
    const attempts = [quiz(19), quiz(13), quiz(12), quiz(1)];
    expect(summarizeActivity(attempts, { today: TODAY }).thisWeek).toBe(2);
  });

  it('finds the best score and ignores quizzes with no questions', () => {
    const attempts = [quiz(19, 10, 20), quiz(18, 17, 20), quiz(17, 0, 0)];
    expect(summarizeActivity(attempts, { today: TODAY }).bestScore).toBe(0.85);
  });
});

describe('recentAttempts', () => {
  const at = (d) => ({ submitted_at: new Date(2026, 8, d, 10).toISOString(), id: d });

  it('returns the newest first, however they arrive, and no more than asked for', () => {
    const list = recentAttempts([at(3), at(9), at(1), at(7)], 3);
    expect(list.map((a) => a.id)).toEqual([9, 7, 3]);
  });

  it('skips attempts without a usable time', () => {
    expect(recentAttempts([{ submitted_at: 'nope' }, {}, at(2)])).toHaveLength(1);
    expect(recentAttempts(undefined)).toEqual([]);
  });
});
