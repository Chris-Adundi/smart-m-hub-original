import { useCallback, useEffect, useMemo, useState } from "react";

const cache = new Map();

const keyFor = (key) => JSON.stringify(Array.isArray(key) ? key : [key]);

export function invalidateServerState(keyPrefix) {
  const prefix = keyFor(keyPrefix).slice(0, -1);
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function useServerState(key, fetcher, options = {}) {
  const cacheKey = useMemo(() => keyFor(key), [key]);
  const ttlMs = options.ttlMs ?? 30000;
  const [state, setState] = useState(() => {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.updatedAt < ttlMs) {
      return { data: cached.data, loading: false, error: null };
    }
    return { data: options.initialData ?? null, loading: true, error: null };
  });

  const load = useCallback(async () => {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.updatedAt < ttlMs) {
      setState({ data: cached.data, loading: false, error: null });
      return cached.data;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      cache.set(cacheKey, { data, updatedAt: Date.now() });
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }
  }, [cacheKey, fetcher, ttlMs]);

  useEffect(() => {
    let active = true;
    load().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { ...state, refetch: load };
}
