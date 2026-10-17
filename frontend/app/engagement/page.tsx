"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { Card, CardBody, CardHeader, Segmented, Table, Td, Th } from "@/components/ui/primitives";
import { InsightList, KpiCard } from "@/components/ui/insight";
import { EmptyState, ErrorState, LoadingState, PageSkeleton } from "@/components/ui/states";
import { ColumnChart, HBarChart, TimeLineChart } from "@/components/charts/Charts";
import { PRIMARY } from "@/lib/colors";
import { fmtCompact, fmtDate, fmtEng, fmtInt, fmtPct } from "@/lib/format";
import type { EngagementMeta, GroupStat, Insight } from "@/lib/types";

interface Top { id: string; title: string; platform: string; topic: string; category: string; date: string | null; engagement: number | null; likes: number; comments: number; shares: number; views: number | null }
interface EngRes {
  available: boolean; meta: EngagementMeta; records: number; total_records: number;
  overall: { avg_engagement: number | null; median_engagement: number | null; p90_engagement: number | null; likes: number; comments: number; shares: number; views: number | null };
  distribution: { label: string; bin_start: number; bin_end: number; count: number }[];
  by_topic: GroupStat[]; by_category: GroupStat[]; by_platform: GroupStat[];
  over_time: { period: string; avg_engagement: number | null; records: number }[];
  top_content: Top[];
  highlights: { best_topic: GroupStat | null; best_category: GroupStat | null; best_content: Top | null };
  insights: Insight[];
}

function Engagement() {
  const { meta } = useAppStatus();
  const { filters, setFilters } = useUrlFilters();
  const [gran, setGran] = useState<"month" | "week">("month");
  const [dim, setDim] = useState<"by_topic" | "by_category" | "by_platform">("by_topic");
  const { data, error, loading, reload } = useApi<EngRes>("/api/engagement", { ...filters, granularity: gran });

  const header = (
    <PageHeader
      title="Engagement Insights"
      question="What content performs well?"
      description="Likes, comments, shares and views combined into one comparable engagement metric, broken down by topic, category, platform and time."
    />
  );

  if (error) return <>{header}<ErrorState error={error} onRetry={reload} /></>;
  if (!data) return <>{header}<PageSkeleton /></>;
  if (!data.available) {
    return <>{header}<FilterBar value={filters} onChange={setFilters} />
      <EmptyState className="mt-4" title={data.records === 0 ? "No records match these filters" : "Engagement data unavailable"}
        description={data.records === 0 ? "Clear or widen the filters." : data.meta?.formula} /></>;
  }

  const unit = data.meta.unit;
  const f = (v: number) => fmtEng(v, unit);
  const h = data.highlights;
  const dimLabel = { by_topic: "topic", by_category: "category", by_platform: "platform" }[dim];

  return (
    <>
      {header}
      <FilterBar value={filters} onChange={setFilters} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-primary-soft/60 px-4 py-2.5 text-[12.5px] text-ink-2">
        <span><span className="font-semibold text-ink">{data.meta.label}</span> = {data.meta.formula}</span>
        {data.meta.note && <span className="text-ink-3">{data.meta.note}</span>}
      </div>

      <div className={loading ? "opacity-60 transition-opacity" : ""}>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label={`Average ${data.meta.label.toLowerCase()}`} value={fmtEng(data.overall.avg_engagement, unit)} sub={`median ${fmtEng(data.overall.median_engagement, unit)} · ${fmtInt(data.records)} records`} />
          <KpiCard label="Highest engagement topic" value={h.best_topic?.name ?? "–"} sub={h.best_topic ? `${f(h.best_topic.avg_engagement ?? 0)} · ${fmtPct(h.best_topic.vs_overall_pct, 0, true)} vs avg` : "min. 10 records"} />
          <KpiCard label="Highest engagement category" value={h.best_category?.name ?? "–"} sub={h.best_category ? `${f(h.best_category.avg_engagement ?? 0)} · ${fmtPct(h.best_category.vs_overall_pct, 0, true)} vs avg` : "min. 10 records"} />
          <KpiCard label="Total interactions" value={fmtCompact(data.overall.likes + data.overall.comments + data.overall.shares)}
            sub={`${fmtCompact(data.overall.likes)} likes · ${fmtCompact(data.overall.comments)} comments · ${fmtCompact(data.overall.shares)} shares`} />
        </div>

        <Card className="mt-4">
          <CardHeader title="What the data says" description="Automatically generated from the current selection" />
          <CardBody><InsightList insights={data.insights} showLinks={false} /></CardBody>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title={`Engagement by ${dimLabel}`} description="Average per record; line marks the average of the current selection"
              action={<Segmented ariaLabel="Break down by" value={dim} onChange={setDim}
                options={[{ value: "by_topic", label: "Topic" }, { value: "by_category", label: "Category" }, { value: "by_platform", label: "Platform" }]} />} />
            <CardBody>
              <HBarChart
                data={data[dim].map((g) => ({ name: g.name, value: g.avg_engagement, records: g.records, vs: g.vs_overall_pct }))}
                colorOrder={dim === "by_topic" ? meta?.topics : undefined}
                color={PRIMARY}
                format={f}
                reference={data.overall.avg_engagement}
                valueLabel={data.meta.label}
                extraTip={(d) => [{ label: "vs average", value: fmtPct(d.vs as number, 0, true) }, { label: "Records", value: fmtInt(d.records as number) }]}
              />
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Distribution" description={`How ${data.meta.label.toLowerCase()} is spread across records (top 2% clipped)`} />
            <CardBody>
              <ColumnChart data={data.distribution} xKey="label" yKey="count" height={Math.max(220, data[dim].length * 34 + 30) - 10} xLabel={data.meta.label} />
            </CardBody>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader title="Engagement over time" description="Average per period"
            action={<Segmented ariaLabel="Granularity" value={gran} onChange={setGran} options={[{ value: "month", label: "Monthly" }, { value: "week", label: "Weekly" }]} />} />
          <CardBody>
            <TimeLineChart data={data.over_time} series={[{ key: "avg_engagement", name: data.meta.label }]} granularity={gran} format={f} height={240} />
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader title="Top-performing content" description={`Highest ${data.meta.label.toLowerCase()} in the current selection`} />
          <CardBody className="px-0 pb-2">
            <Table>
              <thead><tr><Th>Content</Th><Th>Topic</Th><Th>Platform</Th><Th>Date</Th><Th align="right">Views</Th><Th align="right">{data.meta.label}</Th></tr></thead>
              <tbody>
                {data.top_content.map((t) => (
                  <tr key={t.id} className="hover:bg-subtle/50">
                    <Td className="max-w-[340px]"><Link href={`/content?q=${t.id}`} className="block truncate font-medium text-ink hover:text-primary">{t.title}</Link></Td>
                    <Td className="whitespace-nowrap">{t.topic}</Td>
                    <Td>{t.platform}</Td>
                    <Td className="whitespace-nowrap">{fmtDate(t.date)}</Td>
                    <Td align="right">{fmtInt(t.views)}</Td>
                    <Td align="right" className="font-semibold text-ink">{fmtEng(t.engagement, unit)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Engagement /></Suspense>;
}
