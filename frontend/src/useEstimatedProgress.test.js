import { act, renderHook } from '@testing-library/react';
import { useEstimatedProgress } from './useEstimatedProgress.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = (ms) => act(() => vi.advanceTimersByTime(ms));

describe('useEstimatedProgress', () => {
  it('stays at 0 while nothing is running', () => {
    const { result } = renderHook(() => useEstimatedProgress(false));
    tick(5000);
    expect(result.current).toBe(0);
  });

  it('climbs while running, is about 60% after the typical time, and never reaches 100%', () => {
    const { result } = renderHook(() => useEstimatedProgress(true, { typicalMs: 10_000 }));

    tick(2000);
    const early = result.current;
    expect(early).toBeGreaterThan(0);

    tick(8000);
    expect(result.current).toBeGreaterThan(early);
    expect(result.current).toBeCloseTo(0.6, 1);

    tick(10 * 60_000);
    expect(result.current).toBeLessThan(1);
    expect(result.current).toBeCloseTo(0.95, 2);
  });

  it('goes back to 0 when the work stops, and starts over next time', () => {
    const { result, rerender } = renderHook(({ active }) => useEstimatedProgress(active), { initialProps: { active: true } });
    tick(10_000);
    expect(result.current).toBeGreaterThan(0.3);

    rerender({ active: false });
    expect(result.current).toBe(0);

    rerender({ active: true });
    expect(result.current).toBe(0);
  });

  it('restarts when the restart key changes (the next file in a batch)', () => {
    const { result, rerender } = renderHook(({ key }) => useEstimatedProgress(true, { restartKey: key }), {
      initialProps: { key: 0 },
    });
    tick(10_000);
    expect(result.current).toBeGreaterThan(0.3);

    rerender({ key: 1 });
    expect(result.current).toBe(0);
  });
});
