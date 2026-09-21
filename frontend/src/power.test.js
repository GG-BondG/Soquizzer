import { buildPowerHistory, pointsAttr, radarPoints, totalPower, POWER_AXES } from './power.js';

let counter = 0;
// one finished quiz; `day` is a day of September 2026, at local time so a UTC offset cannot move it
function attempt({ day, hour = 10, score = 10, total = 20, time = 600, section = 's1' }) {
  counter += 1;
  return {
    attempt_id: `a${counter}`,
    section_id: section,
    submitted_at: new Date(2026, 8, day, hour).toISOString(),
    score,
    total,
    time_spent_seconds: time,
  };
}

describe('buildPowerHistory', () => {
  it('is empty with no attempts', () => {
    expect(buildPowerHistory([])).toEqual([]);
    expect(buildPowerHistory(undefined)).toEqual([]);
  });

  it('makes one snapshot per attempt, oldest first, whatever order the attempts come in', () => {
    const newest = attempt({ day: 12 });
    const oldest = attempt({ day: 10 });
    const history = buildPowerHistory([newest, oldest]);
    expect(history.map((s) => s.attemptId)).toEqual([oldest.attempt_id, newest.attempt_id]);
  });

  it('skips attempts without a usable time of submission', () => {
    const history = buildPowerHistory([{ ...attempt({ day: 1 }), submitted_at: 'nope' }, attempt({ day: 2 })]);
    expect(history).toHaveLength(1);
  });

  it('scores the first quiz on all five axes', () => {
    // 15/20 correct in 6 minutes: 2.5 correct a minute is a full speed score
    const [snap] = buildPowerHistory([attempt({ day: 10, score: 15, total: 20, time: 360 })]);
    expect(snap.scores).toEqual({
      accuracy: 75,
      speed: 100,
      volume: 7, // 20 of 300 questions
      streak: 20, // 1 of 5 days
      breadth: 20, // 1 of 5 sections
    });
    expect(snap.power).toBe(44);
  });

  it('keeps every score between 0 and 100', () => {
    const many = Array.from({ length: 30 }, (_, i) => attempt({ day: 1 + (i % 28), score: 20, total: 20, time: 30, section: `s${i}` }));
    for (const snap of buildPowerHistory(many)) {
      for (const { key } of POWER_AXES) {
        expect(snap.scores[key]).toBeGreaterThanOrEqual(0);
        expect(snap.scores[key]).toBeLessThanOrEqual(100);
      }
    }
    expect(buildPowerHistory(many).at(-1).scores.volume).toBe(100);
    expect(buildPowerHistory(many).at(-1).scores.breadth).toBe(100);
  });

  it('measures accuracy over the last five quizzes only', () => {
    const attempts = [
      ...Array.from({ length: 5 }, (_, i) => attempt({ day: 1 + i, score: 0 })), // five terrible quizzes
      ...Array.from({ length: 5 }, (_, i) => attempt({ day: 6 + i, score: 20 })), // then five perfect ones
    ];
    const history = buildPowerHistory(attempts);
    expect(history[4].scores.accuracy).toBe(0);
    expect(history[9].scores.accuracy).toBe(100);
    expect(history[6].scores.accuracy).toBe(40); // 2 perfect + 3 terrible in the window
  });

  it('gives no speed score to quizzes without a recorded time', () => {
    const [snap] = buildPowerHistory([attempt({ day: 10, time: null })]);
    expect(snap.scores.speed).toBe(0);
  });

  it('counts each practice day once, and only the past week, for the streak', () => {
    const history = buildPowerHistory([
      attempt({ day: 1 }),
      attempt({ day: 10, hour: 9 }),
      attempt({ day: 10, hour: 18 }), // same day again
      attempt({ day: 11 }),
      attempt({ day: 16 }), // day 10 is 6 days back, still in the window
    ]);
    expect(history[0].scores.streak).toBe(20);
    expect(history[2].scores.streak).toBe(20); // day 1 is 9 days back, out of the window; day 10 counts once
    expect(history[3].scores.streak).toBe(40); // days 10 and 11
    expect(history[4].scores.streak).toBe(60); // days 10, 11 and 16
  });

  it('counts different sections for breadth', () => {
    const history = buildPowerHistory([
      attempt({ day: 1, section: 'a' }),
      attempt({ day: 2, section: 'a' }),
      attempt({ day: 3, section: 'b' }),
    ]);
    expect(history.map((s) => s.scores.breadth)).toEqual([20, 20, 40]);
  });

  it('raises the power when the same student keeps practising', () => {
    const history = buildPowerHistory([attempt({ day: 10 }), attempt({ day: 11 }), attempt({ day: 12 })]);
    expect(history[2].power).toBeGreaterThan(history[0].power);
  });
});

describe('totalPower', () => {
  it('averages the five scores', () => {
    expect(totalPower({ accuracy: 100, speed: 50, volume: 50, streak: 0, breadth: 0 })).toBe(40);
  });
});

describe('radarPoints', () => {
  it('puts the first axis straight up and the rest clockwise', () => {
    const points = radarPoints([100, 100, 100, 100, 100], 0, 0, 10);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(-10);
    expect(points[1].x).toBeGreaterThan(0); // the second corner is on the right
    expect(points[1].y).toBeLessThan(0);
    expect(points[2].y).toBeGreaterThan(0); // the third is lower right
    expect(points[3].x).toBeLessThan(0);
  });

  it('scales by the value and collapses a zero to the centre', () => {
    const [top, right] = radarPoints([50, 0, 0, 0, 0], 100, 100, 80);
    expect(top).toEqual({ x: 100, y: 60 });
    expect(right.x).toBeCloseTo(100);
    expect(right.y).toBeCloseTo(100);
  });
});

describe('pointsAttr', () => {
  it('formats points for an SVG polygon', () => {
    expect(pointsAttr([{ x: 1, y: 2 }, { x: 3.14159, y: 4 }])).toBe('1.0,2.0 3.1,4.0');
  });
});
