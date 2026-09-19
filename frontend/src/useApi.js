import { useCallback, useEffect, useState } from 'react';

// Runs `fetcher()` on mount and whenever `deps` change; `reload()` runs it again.
// `data` keeps the last successful result while a reload is in flight.
// A fetcher that resolves to `undefined`/`null` without calling the server is
// fine (used to wait on another request's result).
export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, error: null, loading: true }));
    Promise.resolve()
      .then(fetcher)
      .then(
        (data) => !cancelled && setState({ data: data ?? null, error: null, loading: false }),
        (error) => !cancelled && setState({ data: null, error, loading: false })
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
