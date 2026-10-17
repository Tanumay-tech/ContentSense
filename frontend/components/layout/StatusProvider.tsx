"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Meta, Status } from "@/lib/types";

interface Ctx {
  status: Status | null;
  meta: Meta | null;
  error: ApiError | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setStatus: (s: Status) => void;
}

const StatusContext = createContext<Ctx>({
  status: null, meta: null, error: null, loading: true, refresh: async () => {}, setStatus: () => {},
});

/** Holds dataset/analysis status and filter metadata for the whole app. */
export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusState] = useState<Status | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async (s: Status) => {
    if (!s.analysis_ready) return setMeta(null);
    try {
      setMeta(await api.get<Meta>("/api/meta"));
    } catch {
      setMeta(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<Status>("/api/status");
      setStatusState(s);
      setError(null);
      await loadMeta(s);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), 0));
    } finally {
      setLoading(false);
    }
  }, [loadMeta]);

  const setStatus = useCallback((s: Status) => {
    setStatusState(s);
    loadMeta(s);
  }, [loadMeta]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <StatusContext.Provider value={{ status, meta, error, loading, refresh, setStatus }}>{children}</StatusContext.Provider>
  );
}

export const useAppStatus = () => useContext(StatusContext);
