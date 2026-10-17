"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Lightbulb, Minus, TriangleAlert, TrendingUp } from "lucide-react";
import type { Insight } from "@/lib/types";
import { cn } from "@/lib/format";
import { Badge } from "./primitives";

/* ------------------------------------------------------------- KPI card */
export function KpiCard({
  label, value, sub, href, icon: Icon, hint,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; icon?: React.ElementType; hint?: string }) {
  const body = (
    <div className="flex h-full flex-col justify-between gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-3">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-ink-3" aria-hidden />}
      </div>
      <div>
        <div
          className={cn("truncate font-semibold leading-none tracking-tight text-ink", typeof value === "string" && value.length > 10 ? "text-[19px] leading-tight" : "text-[26px]")}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </div>
        {sub && <div className="mt-1.5 truncate text-[12.5px] text-ink-3">{sub}</div>}
      </div>
      {href && (
        <span className="flex items-center gap-0.5 text-[12px] font-medium text-primary">
          {hint ?? "View details"} <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </div>
  );
  const cls = "group block rounded-xl border border-border bg-surface shadow-card";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* --------------------------------------------------------- Trend markers */
export function TrendIndicator({ direction, value, compact }: { direction: string; value?: number | null; compact?: boolean }) {
  const map: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
    Increasing: { icon: ArrowUpRight, cls: "text-good-ink", label: "Increasing" },
    Decreasing: { icon: ArrowDownRight, cls: "text-bad-ink", label: "Decreasing" },
    Stable: { icon: ArrowRight, cls: "text-ink-2", label: "Stable" },
  };
  const m = map[direction] ?? { icon: Minus, cls: "text-ink-3", label: "Insufficient data" };
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium", m.cls)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {value != null && <span className="tabular">{value > 0 ? "+" : ""}{value.toFixed(0)}%</span>}
      {!compact && <span className={cn(value != null && "font-normal text-ink-3")}>{value != null ? `· ${m.label}` : m.label}</span>}
    </span>
  );
}

export function MarketStatus({ status }: { status: string }) {
  const tone = status === "Emerging" || status === "Growing" ? "good" : status === "Declining" ? "bad" : "neutral";
  const Icon = status === "Emerging" ? TrendingUp : status === "Growing" ? ArrowUpRight : status === "Declining" ? ArrowDownRight : ArrowRight;
  return (
    <Badge tone={tone}>
      <Icon className="h-3 w-3" aria-hidden />
      {status}
    </Badge>
  );
}

export function BandBadge({ band }: { band: string }) {
  const tone = band.startsWith("Strong") ? "good" : band.startsWith("Moderate") ? "primary" : band.startsWith("Worth") ? "warn" : "neutral";
  return <Badge tone={tone}>{band}</Badge>;
}

export function LevelText({ level }: { level: string }) {
  return <span className="text-[13px] font-medium text-ink">{level}</span>;
}

/* ------------------------------------------------------------- Insights */
export function InsightList({ insights, showLinks = true }: { insights: Insight[]; showLinks?: boolean }) {
  if (!insights.length) return <p className="text-[13px] text-ink-3">Not enough data to generate insights for this selection.</p>;
  return (
    <ul className="divide-y divide-border">
      {insights.map((ins, i) => {
        const Icon = ins.tone === "warning" || ins.tone === "negative" ? TriangleAlert : Lightbulb;
        const iconCls = ins.tone === "positive" ? "text-good-ink bg-good-soft" : ins.tone === "warning" || ins.tone === "negative" ? "text-warn-ink bg-warn-soft" : "text-primary bg-primary-soft";
        return (
          <li key={ins.id ?? i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", iconCls)}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] leading-snug text-ink">{ins.text}</p>
              {ins.metric && <p className="mt-0.5 text-[12px] text-ink-3">Based on: {ins.metric}</p>}
            </div>
            {showLinks && ins.link && (
              <Link href={ins.link} className="mt-1 shrink-0 text-[12px] font-medium text-primary hover:underline" aria-label={`Open analysis for: ${ins.text}`}>
                Open
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
