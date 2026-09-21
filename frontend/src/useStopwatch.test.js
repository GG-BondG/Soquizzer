import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStopwatch } from './useStopwatch.js';

describe('useStopwatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts whole seconds while running and stops when it is not', () => {
    const { result, rerender } = renderHook((props) => useStopwatch(props), {
      initialProps: { running: true, restartKey: 'a' },
    });

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBe(3);
    expect(result.current.secondsSinceStart()).toBe(3);

    rerender({ running: false, restartKey: 'a' });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.elapsed).toBe(3);
  });

  it('starts again from zero when it runs again or the restart key changes', () => {
    const { result, rerender } = renderHook((props) => useStopwatch(props), {
      initialProps: { running: true, restartKey: 'a' },
    });
    act(() => vi.advanceTimersByTime(4000));

    rerender({ running: true, restartKey: 'b' });
    expect(result.current.elapsed).toBe(0);

    act(() => vi.advanceTimersByTime(2000));
    rerender({ running: false, restartKey: 'b' });
    rerender({ running: true, restartKey: 'b' });
    expect(result.current.elapsed).toBe(0);
  });
});
