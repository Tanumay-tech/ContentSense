"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Heart, KeyRound, Layers, Radar, Trophy } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, ButtonLink } from "@/components/ui/primitives";
import { BandBadge, InsightList, KpiCard, MarketStatus } from "@/components/ui/insight";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { ColumnChart, HBarChart } from "@/components/charts/Charts";
import { LoadDemoButton } from "@/components/PipelineActions";
import { fmtEng, fmtInt, fmtMonth, fmtPct } from "@/lib/format";
import type { GroupStat, Insight, Opportunity } from "@/lib/types";

interface Overview {
  kpis: {
    total_content: number; topics_identified: number; avg_engagement: number | null; engagement_label: string; engagement_unit: string;
    top_topic: GroupStat | null; opportunities_detected: number | null; strong_opportunities: number | null; market_loaded: boolean;
  };
  topic_distribution: { name: string; records: number; share_pct: number }[];
  engagement_by_topic: GroupStat[];
  volume_over_time: { period: string; records: number }[];
  top_opportunity: Opportunity | null;
  insights: Insight[];
  dataset: { source: { name: string; kind: string } | null; date_range: string[] | null; ran_at: string };
}

const DEEPER = [
  { href: "/topics", label: "Explore Topics", desc: "Content groups found by clustering", icon: Layers },
  { href: "/keywords", label: "Analyze Keywords", desc: "Frequent vs. important terms", icon: KeyRound },
  { href: "/engagement", label: "View Engagement", desc: "What content performs best", icon: Heart },
  { href: "/market", label: "Explore Market Trends", desc: "Gaps and opportunities", icon: Radar },
];

export default function HomePage() {
  const { status, error: statusError } = useAppStatus();
  const { data, error, loading, reload } = useApi<Overview>(status?.analysis_ready ? "/api/overview" : null);

  const header = (
    <PageHeader
      title="Overview"
      question="What is happening overall?"
      description="Understand your content. Detect market trends. Discover your next opportunity."
      actions={data?.dataset?.source && (
        <span className="text-[12.5px] text-ink-3">
          Dataset: <span className="font-medium text-ink-2">{data.dataset.source.name}</span>
          {data.dataset.date_range && <> · {fmtMonth(data.dataset.date_range[0])} – {fmtMonth(data.dataset.date_range[1])}</>}
        </span>
      )}
    />
  );

  if (statusError) return <>{header}<ErrorState error={statusError} /></>;
  if (status && !status.analysis_ready) {
    return (
      <>
        {header}
        <EmptyState
          icon={BarChart3}
          title="Welcome to ContentSense"
          description="Load the built-in demo (sample brand content + sample market trends) to see the full Web Content Mining pipeline, or upload your own CSV on the Data & Processing page."
          action={<><LoadDemoButton /><ButtonLink href="/data">Upload your data</ButtonLink></>}
        />
      </>
    );
  }
  if (error) return <>{header}<ErrorState error={error} onRetry={reload} /></>;
  if (loading || !data) return <>{header}<PageSkeleton /></>;

  const k = data.kpis;
  const unit = k.engagement_unit;
  const topicOrder = data.topic_distribution.map((t) => t.name);
  const top = data.top_opportunity;

  return (
    <>
      {header}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total content" value={fmtInt(k.total_content)} sub="records after cleaning" href="/content" hint="Explore content" icon={FileText} />
        <KpiCard label="Topics identified" value={k.topics_identified} sub="K-Means content groups" href="/topics" hint="Explore topics" icon={Layers} />
        <KpiCard label={`Average ${k.engagement_label.toLowerCase()}`} value={fmtEng(k.avg_engagement, unit)} sub={unit === "%" ? "(likes+comments+shares)/views" : "weighted interactions"} href="/engagement" hint="View engagement" icon={Heart} />
        <KpiCard label="Top performing topic" value={k.top_topic?.name ?? "–"} sub={k.top_topic ? `${fmtPct(k.top_topic.vs_overall_pct, 0, true)} vs average` : undefined} href="/engagement" hint="View engagement" icon={Trophy} />
        <KpiCard
          label="Market opportunities"
          value={k.market_loaded ? k.opportunities_detected ?? 0 : "–"}
          sub={k.market_loaded ? `${k.strong_opportunities} strong · score ≥ 55` : "No market data loaded"}
          href="/market" hint="Explore market" icon={Radar}
        />
      </div>

      {/* Overview charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Topic distribution" description="Share of analyzed content in each discovered topic" />
          <CardBody>
            <HBarChart
              data={data.topic_distribution.map((t) => ({ name: t.name, value: t.share_pct, records: t.records }))}
              colorOrder={topicOrder}
              format={(v) => `${v.toFixed(0)}%`}
              valueLabel="Share of content"
              extraTip={(d) => [{ label: "Records", value: fmtInt(d.records as number) }]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Engagement by topic" description={`Average ${k.engagement_label.toLowerCase()}; line marks the dataset average`} />
          <CardBody>
            <HBarChart
              data={data.engagement_by_topic.map((t) => ({ name: t.name, value: t.avg_engagement, records: t.records, vs: t.vs_overall_pct }))}
              colorOrder={topicOrder}
              format={(v) => fmtEng(v, unit)}
              reference={k.avg_engagement}
              referenceLabel="avg"
              valueLabel={k.engagement_label}
              extraTip={(d) => [{ label: "vs average", value: fmtPct(d.vs as number, 0, true) }, { label: "Records", value: fmtInt(d.records as number) }]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Content volume over time" description="Records published per month" action={<ButtonLink href="/trends" size="sm" variant="ghost">Content trends <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>} />
          <CardBody>
            <ColumnChart data={data.volume_over_time} xKey="period" yKey="records" tickFormatter={fmtMonth} height={230} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top market opportunity" description="Highest opportunity score" />
          <CardBody>
            {top ? (
              <div className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[18px] font-semibold text-ink">{top.topic}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5"><BandBadge band={top.band} /><MarketStatus status={top.market_status} /></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[28px] font-semibold leading-none text-ink">{top.score.toFixed(0)}</div>
                    <div className="text-[11px] text-ink-3">/ 100</div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 rounded-lg bg-subtle/70 p-3 text-[12px]">
                  <div><dt className="text-ink-3">Momentum</dt><dd className="font-medium text-ink">{top.momentum_level}</dd></div>
                  <div><dt className="text-ink-3">Your coverage</dt><dd className="font-medium text-ink">{top.coverage_level}</dd></div>
                  <div><dt className="text-ink-3">Engagement</dt><dd className="font-medium text-ink">{top.engagement_level}</dd></div>
                </dl>
                <p className="text-[12.5px] leading-relaxed text-ink-2">{top.recommendation}</p>
                <ButtonLink href="/market" size="sm" variant="secondary" className="self-start">See all opportunities <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">Load a market trend dataset to detect opportunities.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Key insights" description="Generated automatically from the analysis. Each shows the metric it is based on." />
        <CardBody><InsightList insights={data.insights} /></CardBody>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DEEPER.map((d) => (
          <Link key={d.href} href={d.href} className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><d.icon className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">{d.label}</span>
              <span className="block truncate text-[12px] text-ink-3">{d.desc}</span>
            </span>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </>
  );
}
