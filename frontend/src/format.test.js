import { formatAgo, formatClock, formatDate, formatDuration, formatPercent, typeLabel } from './format.js';

describe('formatDuration', () => {
  it('shows a dash for a missing value', () => {
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(undefined)).toBe('-');
  });

  it('switches unit at a minute and at an hour', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(75)).toBe('1m 15s');
    expect(formatDuration(600)).toBe('10m 00s');
    expect(formatDuration(3725)).toBe('1h 02m');
  });

  it('rounds fractions of a second', () => {
    expect(formatDuration(59.6)).toBe('1m 00s');
  });
});

describe('formatClock', () => {
  it('pads minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3600)).toBe('60:00');
  });
});

describe('formatPercent', () => {
  it('shows a dash for a missing ratio but 0% for zero', () => {
    expect(formatPercent(null)).toBe('-');
    expect(formatPercent(0)).toBe('0%');
  });

  it('rounds to a whole percent', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(2 / 3)).toBe('67%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('formatDate', () => {
  it('shows a dash when there is no date', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate('')).toBe('-');
  });

  it('includes the time only when asked', () => {
    const iso = '2026-09-19T15:01:00Z';
    expect(formatDate(iso)).toContain('19');
    expect(formatDate(iso, { time: true }).length).toBeGreaterThan(formatDate(iso).length);
  });
});

describe('typeLabel', () => {
  it('names the known question types and passes unknown ones through', () => {
    expect(typeLabel('MULTIPLE_CHOICE')).toBe('Multiple choice');
    expect(typeLabel('TRUE_FALSE')).toBe('True / False');
    expect(typeLabel('ESSAY')).toBe('ESSAY');
  });
});

describe('formatAgo', () => {
  const NOW = new Date(2026, 8, 19, 12, 0, 0);
  const at = (day, hour = 9) => new Date(2026, 8, day, hour).toISOString();

  it('says Today and Yesterday by calendar day, whatever the hour', () => {
    expect(formatAgo(at(19, 0), NOW)).toBe('Today');
    expect(formatAgo(at(18, 23), NOW)).toBe('Yesterday');
  });

  it('counts days up to a week, then falls back to the date', () => {
    expect(formatAgo(at(16), NOW)).toBe('3 days ago');
    expect(formatAgo(at(10), NOW)).toBe(formatDate(at(10)));
  });

  it('shows a dash for a missing or broken time', () => {
    expect(formatAgo(null, NOW)).toBe('-');
    expect(formatAgo('nope', NOW)).toBe('-');
  });
});
