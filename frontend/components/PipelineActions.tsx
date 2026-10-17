"use client";

import { useState } from "react";
import { Loader2, PlayCircle, Sparkles } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Status } from "@/lib/types";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { Button } from "@/components/ui/primitives";

// These are the real pipeline stages (in order) that run on the server during the request.
export const PIPELINE_STEPS = [
  "Validating records…",
  "Cleaning records…",
  "Extracting TF-IDF features…",
  "Identifying content groups (K-Means)…",
  "Naming topics from cluster terms…",
  "Measuring engagement…",
  "Analysing trends…",
  "Comparing market trends…",
  "Scoring opportunities…",
];

export function useRunner() {
  const { setStatus } = useAppStatus();
  const [busy, setBusy] = useState<null | "demo" | "run">(null);
  const [error, setError] = useState<ApiError | null>(null);

  const exec = async (kind: "demo" | "run", fn: () => Promise<Status>) => {
    setBusy(kind);
    setError(null);
    try {
      const s = await fn();
      setStatus(s);
      return s;
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), 0));
      return null;
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    error,
    loadDemo: () => exec("demo", () => api.post<Status>("/api/data/load-demo")),
    run: (k: number) => exec("run", () => api.post<Status>("/api/analysis/run", { n_clusters: k })),
  };
}

export function LoadDemoButton({ variant = "primary" as "primary" | "secondary", onDone }: { variant?: "primary" | "secondary"; onDone?: () => void }) {
  const { busy, error, loadDemo } = useRunner();
  const [step, setStep] = useState(0);
  const click = async () => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PIPELINE_STEPS.length - 1)), 350);
    const s = await loadDemo();
    clearInterval(t);
    setStep(0);
    if (s && onDone) onDone();
  };
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant={variant} onClick={click} disabled={!!busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? PIPELINE_STEPS[step] : "Load Demo Data"}
      </Button>
      {error && <p role="alert" className="text-[12.5px] text-bad-ink">{error.message}</p>}
    </div>
  );
}

export function RunAnalysisButton({ k, disabled }: { k: number; disabled?: boolean }) {
  const { busy, error, run } = useRunner();
  const [step, setStep] = useState(0);
  const click = async () => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PIPELINE_STEPS.length - 1)), 300);
    await run(k);
    clearInterval(t);
    setStep(0);
  };
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant="primary" onClick={click} disabled={!!busy || disabled}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        {busy ? PIPELINE_STEPS[step] : "Run analysis"}
      </Button>
      {error && <p role="alert" className="max-w-md text-[12.5px] text-bad-ink">{error.message}</p>}
    </div>
  );
}
