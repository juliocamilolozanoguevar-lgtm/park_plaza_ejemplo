import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

export function useFetch(path, options = {}) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState(options.initialData || null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api(path));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => {
    if (enabled) {
      load();
    } else {
      setLoading(false);
    }
  }, [enabled, load]);

  return { data, loading, error, reload: load, setData };
}
