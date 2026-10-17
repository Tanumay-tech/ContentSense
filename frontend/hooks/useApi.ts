"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, Params } from "@/lib/api";
import { useAppStatus } from "@/components/layout/StatusProvider";

/** Fetch a GET endpoint; refetches when params or the analysis run change. */
export function useApi<T>(path: string | null, params?: Params) {
  const { status } = useAppStatus();
  const runId = status?.run_id ?? "none";
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const key = JSON.stringify([path, params, runId]);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(path, params);
      if (id === seq.current) setData(res);
    } catch (e) {
      if (id === seq.current) {
        setError(e instanceof ApiError ? e : new ApiError(String(e), 0));
        setData(null);
      }
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}
