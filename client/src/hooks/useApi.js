import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Minimal data hook - loading, error, data, refetch. No cache library: there are
 * eight screens and every one of them wants exactly this. The abort on unmount
 * matters because several pages fetch on mount and the demo navigates quickly.
 */
export function useApi(path, { enabled = true, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const controller = useRef(null);

  const load = useCallback(async () => {
    if (!enabled || !path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    controller.current?.abort();
    controller.current = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await api.get(path, { signal: controller.current.signal });
      setState({ data, error: null, loading: false });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...deps]);

  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [load]);

  return { ...state, refetch: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** For POSTs a page triggers: tracks in-flight state and the last error. */
export function useMutation(fn) {
  const [state, setState] = useState({ loading: false, error: null });

  const run = useCallback(
    async (...args) => {
      setState({ loading: true, error: null });
      try {
        const result = await fn(...args);
        setState({ loading: false, error: null });
        return result;
      } catch (error) {
        setState({ loading: false, error });
        throw error;
      }
    },
    [fn],
  );

  return { ...state, run };
}
