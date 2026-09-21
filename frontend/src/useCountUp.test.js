import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountUp } from './useCountUp.js';

function reducedMotion(reduce) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce });
}

describe('useCountUp', () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  it('shows the final value at once for reduced-motion users', () => {
    reducedMotion(true);
    const { result } = renderHook(({ target }) => useCountUp(target), { initialProps: { target: 7 } });
    expect(result.current).toBe(7);
  });

  it('goes back to 0 when the target is cleared, so the next result counts up from 0', () => {
    reducedMotion(true);
    const { result, rerender } = renderHook(({ target }) => useCountUp(target), { initialProps: { target: 7 } });

    rerender({ target: null });
    expect(result.current).toBe(0);

    rerender({ target: 4 });
    expect(result.current).toBe(4);
  });

  it('starts from 0 and reaches the target when motion is allowed', async () => {
    reducedMotion(false);
    const { result } = renderHook(() => useCountUp(5));
    expect(result.current).toBe(0);
    await vi.waitFor(() => expect(result.current).toBe(5), { timeout: 4000 });
  });
});
