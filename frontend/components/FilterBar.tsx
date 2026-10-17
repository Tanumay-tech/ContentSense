"use client";

import { RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { Button, Field, inputCls, Select } from "@/components/ui/primitives";

export type FilterValues = {
  q?: string;
  topic?: string;
  category?: string;
  platform?: string;
  start?: string;
  end?: string;
  min_engagement?: string;
};

type Key = keyof FilterValues;

/** One row of filters above the charts. Shows only the requested controls. */
export function FilterBar({
  value, onChange, show = ["topic", "category", "platform", "start", "end"],
}: { value: FilterValues; onChange: (v: FilterValues) => void; show?: Key[] }) {
  const { meta } = useAppStatus();
  const [q, setQ] = useState(value.q ?? "");

  useEffect(() => setQ(value.q ?? ""), [value.q]);
  // debounce free-text search
  useEffect(() => {
    if ((value.q ?? "") === q) return;
    const t = setTimeout(() => onChange({ ...value, q: q || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const set = (k: Key, v: string) => onChange({ ...value, [k]: v || undefined });
  const active = Object.entries(value).filter(([, v]) => v).length;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3 shadow-card">
      {show.includes("q") && (
        <Field label="Search" className="w-full sm:w-64">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keyword, phrase or ID…"
              className={inputCls + " pl-8"}
              aria-label="Search content"
            />
          </div>
        </Field>
      )}
      {show.includes("topic") && (
        <Select label="Topic" value={value.topic ?? ""} onChange={(v) => set("topic", v)} options={meta?.topics ?? []} placeholder="All topics" className="w-[calc(50%-6px)] sm:w-48" />
      )}
      {show.includes("category") && (
        <Select label="Category" value={value.category ?? ""} onChange={(v) => set("category", v)} options={meta?.categories ?? []} placeholder="All categories" className="w-[calc(50%-6px)] sm:w-44" />
      )}
      {show.includes("platform") && (
        <Select label="Platform" value={value.platform ?? ""} onChange={(v) => set("platform", v)} options={meta?.platforms ?? []} placeholder="All platforms" className="w-[calc(50%-6px)] sm:w-36" />
      )}
      {show.includes("min_engagement") && (
        <Select
          label="Engagement"
          value={value.min_engagement ?? ""}
          onChange={(v) => set("min_engagement", v)}
          placeholder="Any"
          className="w-[calc(50%-6px)] sm:w-40"
          options={meta?.engagement?.p75 != null ? [
            { value: String(meta.engagement.p75.toFixed(3)), label: "Top 25% (≥ p75)" },
            { value: String((meta.engagement.p25 ?? 0).toFixed(3)), label: "Above bottom 25%" },
          ] : []}
        />
      )}
      {show.includes("start") && (
        <Field label="From" className="w-[calc(50%-6px)] sm:w-40">
          <input type="date" value={value.start ?? ""} min={meta?.date_min ?? undefined} max={meta?.date_max ?? undefined} onChange={(e) => set("start", e.target.value)} className={inputCls} />
        </Field>
      )}
      {show.includes("end") && (
        <Field label="To" className="w-[calc(50%-6px)] sm:w-40">
          <input type="date" value={value.end ?? ""} min={meta?.date_min ?? undefined} max={meta?.date_max ?? undefined} onChange={(e) => set("end", e.target.value)} className={inputCls} />
        </Field>
      )}
      {active > 0 && (
        <Button variant="ghost" size="sm" className="mb-0.5" onClick={() => { setQ(""); onChange({}); }}>
          <RotateCcw className="h-3.5 w-3.5" /> Clear ({active})
        </Button>
      )}
    </div>
  );
}
