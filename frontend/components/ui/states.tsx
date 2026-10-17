"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button, ButtonLink } from "./primitives";
import { cn } from "@/lib/format";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-subtle", className)} />;
}

/** Loading block. Optional `steps` rotate while waiting (they name real pipeline stages). */
export function LoadingState({ message = "Loading…", steps, className }: { message?: string; steps?: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!steps?.length) return;
    const t = setInterval(() => setI((x) => (x + 1) % steps.length), 900);
    return () => clearInterval(t);
  }, [steps]);
  return (
    <div role="status" aria-live="polite" className={cn("flex min-h-[160px] flex-col items-center justify-center gap-2 text-ink-3", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-[13px]">{steps?.length ? steps[i] : message}</span>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function EmptyState({
  title, description, action, icon: Icon = Database, className,
}: { title: string; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ElementType; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-[13px] text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex gap-2">{action}</div>}
    </div>
  );
}

/** Human-readable error with the right next step for each error type. */
export function ErrorState({ error, onRetry, className }: { error: ApiError | Error | string; onRetry?: () => void; className?: string }) {
  const e = typeof error === "string" ? new ApiError(error, 0) : error;
  const code = e instanceof ApiError ? e.code : "error";
  if (code === "no_data" || code === "not_analyzed") {
    return (
      <EmptyState
        className={className}
        title={code === "no_data" ? "No data loaded yet" : "Analysis not run yet"}
        description={code === "no_data"
          ? "Load the demo dataset or upload your own CSV on the Data & Processing page to start the analysis."
          : "Your data is loaded. Run the analysis on the Data & Processing page to generate results."}
        action={<ButtonLink href="/data" variant="primary">Go to Data & Processing</ButtonLink>}
      />
    );
  }
  const unavailable = code === "backend_unavailable";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-xl border border-bad/25 bg-bad-soft/50 px-6 py-10 text-center", className)}>
      {unavailable ? <PlugZap className="mb-2 h-6 w-6 text-bad" /> : <AlertTriangle className="mb-2 h-6 w-6 text-bad" />}
      <h3 className="text-[15px] font-semibold text-ink">{unavailable ? "Backend unavailable" : "Something went wrong"}</h3>
      <p className="mt-1 max-w-lg text-[13px] text-ink-2">{e.message}</p>
      {onRetry && (
        <Button className="mt-4" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}
