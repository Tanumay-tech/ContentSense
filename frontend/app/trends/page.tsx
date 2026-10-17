"use client";

import { Suspense, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { Card, CardBody, CardHeader, InfoTip, Segmented, Table, Td, Th } from "@/components/ui/primitives";
import { InsightList, TrendIndicator } from "@/components/ui/insight";
import { EmptyState, ErrorState, LoadingState, PageSkeleton } from "@/components/ui/states";
import { ColumnChart, TimeLineChart } from "@/components/charts/Charts";
import { colorFor } from "@/lib/colors";
import { cn, fmtDate, fmtEng, fmtMonth, fmtPct } from "@/lib/format";
import type { Insight } from "@/lib/types";

interface TrendRow {
  name: string; first_half: number; second_half: number; change_pct: number | null; direction: string;
  share_first_pct: number; share_second_pct: number; share_change_pp: number;
  engagement_first: number | null; engagement_second: number | null; engagement_change_pct: number | null;
}
interface KwTrend { term: string; recent_share_pct: number; earlier_share_pct: number; lift: number; recent_docs: number }
interface TrendsRes {
  available: boolean; reason?: string;
  range: { start: string; end: string; midpoint: string; days: number };
  comparison_available: boolean; comparison_note: string | null;
  volume: { period: string; records: number }[];
  volume_change_pct: number | null; volume_direction: string;
  engagement_over_time: { period: string; avg_engagement: number | null }[];
  engagement_change_pct: number | null; engagement_direction: string;
  topics: string[]; topic_series: Record<string, number | string>[];
  topic_trends: TrendRow[]; category_trends: TrendRow[];
  emerging_keywords: KwTrend[]; fading_keywords: KwTrend[];
  insights: Insight[];
}

function Trends() {
  const { meta } = useAppStatus();
  const { filters, setFilters } = useUrlFilters();
  const [gran, setGran] = useState<"month" | "week" | "day">("month");
  const { data, error, loading, reload } = useApi<TrendsRes>("/api/trends/content", { ...filters, granularity: gran });
  const unit = meta?.engagement.unit ?? "%";
  const topicOrder = meta?.topics ?? [];

  const header = (
    <PageHeader
      title="Content Trends"
      question="How is our content changing?"
      description="Changes in your own publishing over time. Trend indicators compare the second half of the selected period with the first half: ↑ above +10%, ↓ below −10%, → otherwise."
      actions={<Segmented ariaLabel="Granularity" value={gran} onChange={setGran} options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }]} />}
    />
  );

  if (error) return <>{header}<ErrorState error={error} onRetry={reload} /></>;
  if (!data) return <>{header}<PageSkeleton /></>;

  return (
    <>
      {header}
      <FilterBar value={filters} onChange={setFilters} />
      {!data.available ? (
        <EmptyState className="mt-4" title="No time-based data" description={data.reason ?? "No records with valid dates match these filters."} />
      ) : (
        <div className={cn("mt-4", loading && "opacity-60 transition-opacity")}>
          <div className="mb-3 text-[12.5px] text-ink-3">
            Period {fmtDate(data.range.start)} – {fmtDate(data.range.end)} · comparing before vs after {fmtDate(data.range.midpoint)}
            {data.comparison_note && <span className="ml-2 font-medium text-warn-ink">{data.comparison_note}</span>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryTile label="Content volume" direction={data.volume_direction} value={data.volume_change_pct} />
            <SummaryTile label="Average engagement" direction={data.engagement_direction} value={data.engagement_change_pct} />
            <SummaryTile
              label="Fastest-growing topic"
              text={data.topic_trends.find((t) => t.direction === "Increasing")?.name ?? "None increasing"}
              direction={data.topic_trends.find((t) => t.direction === "Increasing") ? "Increasing" : "Stable"}
              value={data.topic_trends.find((t) => t.direction === "Increasing")?.change_pct ?? null}
            />
          </div>

          {data.insights.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Trend insights" description="Calculated from the selected period" />
              <CardBody><InsightList insights={data.insights} showLinks={false} /></CardBody>
            </Card>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Content volume" description={`Records per ${gran}`} />
              <CardBody>
                <ColumnChart data={data.volume} xKey="period" yKey="records" height={240}
                  tickFormatter={(v) => (gran === "month" ? fmtMonth(v) : fmtDate(v, { month: "short", day: "numeric" }))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Engagement over time" description={`Average per ${gran}`} />
              <CardBody>
                <TimeLineChart data={data.engagement_over_time} series={[{ key: "avg_engagement", name: "Average engagement" }]} granularity={gran}
                  format={(v) => fmtEng(v, unit)} height={240} />
              </CardBody>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader title="Topic growth over time" description={`Records per topic per ${gran}`} />
            <CardBody>
              <TimeLineChart
                data={data.topic_series}
                series={data.topics.map((t) => ({ key: t, name: t, color: colorFor(t, topicOrder) }))}
                granularity={gran}
                height={300}
              />
            </CardBody>
          </Card>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Topic trends" description="Second half vs first half of the period" />
              <CardBody className="px-0 pb-2">
                <TrendTable rows={data.topic_trends} unit={unit} dot={(n) => colorFor(n, topicOrder)} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Category changes" description="Change in each category's share of all content" />
              <CardBody className="px-0 pb-2">
                <TrendTable rows={data.category_trends} unit={unit} showShare />
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <KeywordTrendCard title="Emerging keywords" description="Used much more in the most recent third of the period than before" rows={data.emerging_keywords} up />
            <KeywordTrendCard title="Fading keywords" description="Used much less recently than before" rows={data.fading_keywords} />
          </div>
        </div>
      )}
    </>
  );
}

function SummaryTile({ label, direction, value, text }: { label: string; direction: string; value: number | null; text?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="text-[12.5px] font-medium text-ink-3">{label}</div>
      {text && <div className="mt-1 truncate text-[17px] font-semibold text-ink">{text}</div>}
      <div className={cn(text ? "mt-1" : "mt-2")}>
        {!text && <div className="text-[24px] font-semibold leading-none text-ink">{value == null ? "–" : fmtPct(value, 0, true)}</div>}
        <div className="mt-1.5"><TrendIndicator direction={direction} value={text ? value : undefined} /></div>
      </div>
    </div>
  );
}

function TrendTable({ rows, unit, dot, showShare }: { rows: TrendRow[]; unit: string; dot?: (n: string) => string; showShare?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Name</Th><Th align="right">1st half</Th><Th align="right">2nd half</Th><Th>Trend</Th>
          {showShare ? <Th align="right">Share change</Th> : <Th align="right">Engagement</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="hover:bg-subtle/50">
            <Td className="whitespace-nowrap font-medium text-ink">
              <span className="inline-flex items-center gap-1.5">
                {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot(r.name) }} />}{r.name}
              </span>
            </Td>
            <Td align="right">{r.first_half}</Td>
            <Td align="right">{r.second_half}</Td>
            <Td><TrendIndicator direction={r.direction} value={r.change_pct} compact /></Td>
            {showShare ? (
              <Td align="right" className={r.share_change_pp > 0 ? "text-good-ink" : r.share_change_pp < 0 ? "text-bad-ink" : ""}>
                {r.share_change_pp > 0 ? "+" : ""}{r.share_change_pp.toFixed(1)} pp
              </Td>
            ) : (
              <Td align="right">
                {fmtEng(r.engagement_first, unit)} → {fmtEng(r.engagement_second, unit)}
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function KeywordTrendCard({ title, description, rows, up }: { title: string; description: string; rows: KwTrend[]; up?: boolean }) {
  return (
    <Card>
      <CardHeader title={title} description={description}
        info="Share of records containing the term in the most recent third of the period vs the earlier two thirds. Ranked by the absolute change in share." />
      <CardBody>
        {rows.length === 0 ? <p className="text-[13px] text-ink-3">No keywords with a clear shift in this period.</p> : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 8).map((r) => (
              <li key={r.term} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="font-medium text-ink">{r.term}</span>
                <span className="tabular text-ink-3">
                  {r.earlier_share_pct.toFixed(1)}% → <span className={up ? "font-medium text-good-ink" : "font-medium text-bad-ink"}>{r.recent_share_pct.toFixed(1)}%</span> of records
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Trends /></Suspense>;
}
