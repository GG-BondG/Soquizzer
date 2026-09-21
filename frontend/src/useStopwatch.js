import { useEffect, useRef, useState } from 'react';

// Whole seconds since it (re)started, ticking once a second while `running`. It restarts from zero whenever
// `running` turns true again or `restartKey` changes. `secondsSinceStart()` reads the exact value on demand
// (for the moment a quiz is submitted).
export function useStopwatch({ running, restartKey }) {
  const startedAt = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    startedAt.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running, restartKey]);

  const secondsSinceStart = () => Math.round((Date.now() - startedAt.current) / 1000);
  return { elapsed, secondsSinceStart };
}
