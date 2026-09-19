import { useLayoutEffect, useState } from 'react';

// Uploading a PDF and writing a quiz are each one long request, and the backend reports nothing while it works, so
// real progress can't be known. This gives a believable estimate instead: it eases toward 95% (about 60% once
// `typicalMs` has passed) and never reaches the end by itself, so it can't claim to be done before the request is.
// Returns 0..1. It drops back to 0 when `active` turns off or `restartKey` changes (e.g. the next file in a batch).
export function useEstimatedProgress(active, { typicalMs = 20_000, restartKey } = {}) {
  const [value, setValue] = useState(0);

  // A layout effect, so the reset lands before the browser paints: otherwise the next file's bar would flash at the
  // previous file's value for a frame.
  useLayoutEffect(() => {
    setValue(0);
    if (!active) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setValue(0.95 * (1 - Math.exp(-(Date.now() - startedAt) / typicalMs)));
    }, 200);
    return () => clearInterval(timer);
  }, [active, typicalMs, restartKey]);

  return value;
}
