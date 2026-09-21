import { useEffect, useState } from 'react';

const DURATION_MS = 650;

// Counts from 0 up to `target` (ease-out). `null` resets it to 0. Reduced-motion users see the final value at once.
export function useCountUp(target) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null) {
      setValue(0);
      return undefined;
    }
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || target === 0) {
      setValue(target);
      return undefined;
    }

    let frame;
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - started) / DURATION_MS, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
