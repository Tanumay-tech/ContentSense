"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowUpRight, Calculator, Download, Search, ShieldCheck } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, InfoTip, Select, Table, Td, Th } from "@/components/ui/primitives";
import { BandBadge, MarketStatus } from "@/components/ui/insight";
import { Modal } from "@/components/ui/drawer";
import { EmptyState, ErrorState, LoadingState, PageSkeleton } from "@/components/ui/states";
import { ForecastChart, ForecastPoint, Sparkline } from "@/components/charts/Charts";
import { api } from "@/lib/api";
import { PRIMARY } from "@/lib/colors";
import { cn, fmtDate, fmtEng, fmtInt, fmtPct } from "@/lib/format";
import type { MarketTopic, Opportunity } from "@/lib/types";
import { useAppStatus } from "@/components/layout/StatusProvider";

interface MarketRes {
  topics: MarketTopic[]; trending_now: MarketTopic[];
  source: { name: string; kind: string; rows: number; topics: number; date_range: string[] } | null;
  warnings: string[];
  method: { current_level: string; growth: string; momentum: string; status_rules: Record<string, string> };
}
interface OppRes { available: boolean; reason?: string; opportunities: Opportunity[]; strong_count: number; detected_count: number; disclaimer: string; weights: Record<string, number> }
interface Forecast {
  available: boolean; reason?: string; detail?: string; method?: string; params?: Record<string, number>;
  points?: { date: string; forecast: number; lower: number; upper: number }[];
  expected_change_pct?: number; direction?: string; reliability?: string; disclaimer?: string; history_weeks: number;
  backtest?: { weeks: number; mape_pct: number } | null;
}
interface TopicDetail {
  topic: string; points: { date: string; score: number; rolling_4w: number; growth_4w_pct: number | null; volume: number | null }[];
  metrics: MarketTopic; forecast: Forecast; opportunity: Opportunity | null; keywords: { keyword: string; current_score: number }[];
}

const SECTIONS = [
  { id: "trending", label: "Trending now" },
  { id: "momentum", label: "Momentum & forecast" },
  { id: "compare", label: "Your content vs market" },
  { id: "opportunities", label: "Opportunities" },
  { id: "method", label: "How scores work" },
];

function Market() {
  const sp = useSearchParams();
  const { status } = useAppStatus();
  const market = useApi<MarketRes>("/api/trends/market");
  const opps = useApi<OppRes>("/api/opportunities");
  const [selected, setSelected] = useState<string | null>(sp.get("topic"));
  const [explain, setExplain] = useState<Opportunity | null>(null);

  useEffect(() => {
    // default to the top-ranked opportunity so the demo story starts where the value is
    if (!selected && market.data && opps.data)
      setSelected(opps.data.opportunities?.[0]?.topic ?? market.data.trending_now[0]?.topic ?? market.data.topics[0]?.topic ?? null);
  }, [market.data, opps.data, selected]);
  const detail = useApi<TopicDetail>(selected ? `/api/trends/market/${encodeURIComponent(selected)}` : null);

  const header = (
    <PageHeader
      title="Market Trends & Opportunities"
      question="What is happening in the wider market, and where might we have a content opportunity?"
      description="Compares your content against an authorised market trend dataset to find topics with rising interest and limited coverage in your content."
      actions={opps.data?.available && <a href={api.downloadUrl("/api/opportunities/export")} download><Button size="sm"><Download className="h-3.5 w-3.5" /> Export opportunities</Button></a>}
    />
  );

  if (market.error) {
    if (market.error.status === 409 && status?.analysis_ready) {
      return <>{header}<EmptyState icon={AlertCircle} title="No market trend data loaded" description={market.error.message}
        action={<ButtonLink href="/data" variant="primary">Load or upload market data</ButtonLink>} /></>;
    }
    return <>{header}<ErrorState error={market.error} onRetry={market.reload} /></>;
  }
  if (!market.data || !opps.data) return <>{header}<PageSkeleton /></>;

  const m = market.data;
  const o = opps.data;
  const strongList = o.opportunities.filter((x) => x.band === "Strong Opportunity" || x.band === "Moderate Opportunity");

  return (
    <>
      {header}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <ShieldCheck className="h-4 w-4 text-good-ink" />
        <span>
          Market source: <span className="font-medium text-ink-2">{m.source?.name}</span>
          {m.source?.kind === "demo" && <Badge tone="warn" className="ml-1.5">Sample / demo data</Badge>}
          {m.source?.date_range && <> · weekly, {fmtDate(m.source.date_range[0])} – {fmtDate(m.source.date_range[1])}</>} · {m.topics.length} topics
        </span>
      </div>

      <nav aria-label="Sections" className="sticky top-14 z-20 -mx-1 mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface/95 p-1 shadow-card backdrop-blur lg:top-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:bg-subtle hover:text-ink">{s.label}</a>
        ))}
      </nav>

      {/* 1. Trending now */}
      <section id="trending" className="scroll-mt-20">
        <SectionHead n={1} title="Trending now" text="Market topics with the strongest recent growth (current 4-week level vs 12 weeks earlier)." />
        {m.trending_now.length === 0 ? <p className="text-[13px] text-ink-3">No topics are currently growing in the market dataset.</p> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {m.trending_now.map((t) => (
              <button key={t.topic} onClick={() => { setSelected(t.topic); document.getElementById("momentum")?.scrollIntoView({ behavior: "smooth" }); }}
                className="rounded-xl border border-border bg-surface p-4 text-left shadow-card transition-colors hover:border-primary/40">
                <div className="truncate text-[13.5px] font-semibold text-ink">{t.topic}</div>
                <div className="mt-1 flex items-baseline gap-1 text-good-ink">
                  <ArrowUpRight className="h-4 w-4 self-center" />
                  <span className="text-[22px] font-semibold leading-none">{fmtPct(t.growth_pct, 0)}</span>
                </div>
                <div className="mt-2"><Sparkline values={t.sparkline} /></div>
                <div className="mt-2 flex items-center justify-between"><MarketStatus status={t.status} /><span className="text-[11.5px] text-ink-3">score {t.current_score.toFixed(0)}</span></div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Momentum + forecast */}
      <section id="momentum" className="mt-8 scroll-mt-20">
        <SectionHead n={2} title="Trend momentum & forecast" text="Select a market topic to see its history, growth and a restrained projection based on its historical pattern." />
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader title="All tracked market topics" description="Click a row to inspect it" />
            <CardBody className="px-0 pb-2">
              <ul className="divide-y divide-border">
                {[...m.topics].sort((a, b) => b.current_score - a.current_score).map((t) => (
                  <li key={t.topic}>
                    <button onClick={() => setSelected(t.topic)} aria-pressed={selected === t.topic}
                      className={cn("grid w-full grid-cols-[1fr_64px_auto] items-center gap-3 px-5 py-2.5 text-left hover:bg-subtle/60", selected === t.topic && "bg-primary-soft/50")}>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{t.topic}</span>
                        <span className="text-[11.5px] text-ink-3">score {t.current_score.toFixed(0)} · {fmtPct(t.growth_pct, 0, true)}</span>
                      </span>
                      <Sparkline values={t.sparkline} height={26} color={t.status === "Declining" ? "#898781" : PRIMARY} />
                      <MarketStatus status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            {detail.error ? <ErrorState error={detail.error} className="m-5" /> : !detail.data ? <LoadingState message="Loading trend history…" /> : (
              <TopicPanel d={detail.data} />
            )}
          </Card>
        </div>
      </section>

      {/* 3. Comparison */}
      <section id="compare" className="mt-8 scroll-mt-20">
        <SectionHead n={3} title="Your content vs the market" text="For each market topic: how much of your content covers it, how strong the market interest is, and how related content performs." />
        {!o.available ? <EmptyState title="Comparison unavailable" description={o.reason} /> : (
          <Card>
            <CardBody className="px-0 pb-2 pt-2">
              <Table>
                <thead>
                  <tr>
                    <Th>Topic</Th>
                    <Th>Your coverage</Th>
                    <Th>Market trend</Th>
                    <Th>Related engagement</Th>
                    <Th>Coverage gap</Th>
                    <Th align="right">Opportunity</Th>
                  </tr>
                </thead>
                <tbody>
                  {o.opportunities.map((x) => (
                    <tr key={x.topic} className="hover:bg-subtle/50">
                      <Td className="font-medium text-ink">{x.topic}</Td>
                      <Td>
                        <div className="font-medium text-ink">{x.coverage_level}</div>
                        <div className="text-[11.5px] text-ink-3">{fmtInt(x.your_volume)} records · {x.share_of_voice_pct.toFixed(1)}% share of voice</div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-ink">{x.market_strength}</span><MarketStatus status={x.market_status} /></div>
                        <div className="text-[11.5px] text-ink-3">score {x.market_score.toFixed(0)} · {fmtPct(x.market_growth_pct, 0, true)} (12w)</div>
                      </Td>
                      <Td>
                        <div className="font-medium text-ink">{x.engagement_level}</div>
                        <div className="text-[11.5px] text-ink-3">{x.engagement_index == null ? "–" : `${x.engagement_index.toFixed(2)}× average`}{x.your_volume < 5 && x.engagement_index != null ? " · estimated" : ""}</div>
                      </Td>
                      <Td>
                        <div className="font-medium text-ink">{x.gap_level}</div>
                        <div className="text-[11.5px] text-ink-3">{x.market_attention_pct.toFixed(1)}% attention vs {x.share_of_voice_pct.toFixed(1)}% yours</div>
                      </Td>
                      <Td align="right">
                        <button onClick={() => setExplain(x)} className="inline-flex flex-col items-end" aria-label={`Explain score for ${x.topic}`}>
                          <span className="text-[15px] font-semibold text-ink">{x.score.toFixed(0)}</span>
                          <BandBadge band={x.band} />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="px-5 pt-3 text-[12px] text-ink-3">
                Share of voice = your records mentioning the topic ÷ records mentioning any tracked market topic. Market attention = topic score ÷ sum of all topic scores. Click a score to see its breakdown.
              </p>
            </CardBody>
          </Card>
        )}
      </section>

      {/* 4. Opportunity cards */}
      <section id="opportunities" className="mt-8 scroll-mt-20">
        <SectionHead n={4} title="Potential content opportunities" text="Topics where market interest is high and your coverage is relatively low. These are suggestions to evaluate, not instructions." />
        {!o.available ? null : strongList.length === 0 ? (
          <EmptyState title="No strong or moderate opportunities" description="Your coverage already tracks market interest, or no market topic currently shows momentum." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {strongList.map((x) => <OpportunityCard key={x.topic} o={x} onExplain={() => setExplain(x)} />)}
          </div>
        )}
      </section>

      {/* 5. Method */}
      <section id="method" className="mt-8 scroll-mt-20">
        <SectionHead n={5} title="How the scores work" text="Every number on this page is calculated from the two datasets. Nothing is hand-entered." />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Opportunity Score (0–100)" />
            <CardBody className="space-y-2 text-[13px] leading-relaxed text-ink-2">
              <p className="rounded-lg bg-subtle p-3 font-mono text-[12.5px] text-ink">Score = 100 × (0.40 × Momentum + 0.35 × Gap + 0.25 × Engagement)</p>
              <p><span className="font-medium text-ink">Momentum</span> = 0.5 × (current score ÷ 100) + 0.5 × clip((12-week growth % + 50) ÷ 100, 0, 1)</p>
              <p><span className="font-medium text-ink">Gap</span> = clip((market attention − your share of voice) ÷ market attention, 0, 1)</p>
              <p><span className="font-medium text-ink">Engagement potential</span> = clip(related engagement ÷ dataset average ÷ 2, 0, 1). If fewer than 5 records mention the topic, the 20 most similar records (TF-IDF cosine) are used; with none, a neutral 0.5.</p>
              <p>Bands: ≥ 70 Strong · 55–70 Moderate · 40–55 Worth monitoring · &lt; 40 Low priority.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Market trend status" />
            <CardBody className="space-y-2 text-[13px] leading-relaxed text-ink-2">
              <p><span className="font-medium text-ink">Current level:</span> {m.method.current_level}</p>
              <p><span className="font-medium text-ink">Growth:</span> {m.method.growth}</p>
              <p><span className="font-medium text-ink">Momentum:</span> {m.method.momentum}</p>
              <ul className="space-y-1">
                {Object.entries(m.method.status_rules).map(([k, v]) => (
                  <li key={k} className="flex gap-2"><span className="w-20 shrink-0"><MarketStatus status={k} /></span><span>{v}</span></li>
                ))}
              </ul>
              <p className="text-[12.5px] text-ink-3">{o.disclaimer}</p>
            </CardBody>
          </Card>
        </div>
      </section>

      <Modal open={!!explain} onOpenChange={(v) => !v && setExplain(null)} title={explain ? `Why ${explain.topic} scores ${explain.score.toFixed(0)}/100` : ""}
        description={explain?.breakdown.formula}>
        {explain && <ScoreBreakdown o={explain} />}
      </Modal>
    </>
  );
}

function SectionHead({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">{n}</span>
      <div>
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <p className="text-[13px] text-ink-3">{text}</p>
      </div>
    </div>
  );
}

function TopicPanel({ d }: { d: TopicDetail }) {
  const mt = d.metrics;
  const fc = d.forecast;
  const chart: ForecastPoint[] = useMemo(() => {
    const hist: ForecastPoint[] = d.points.map((p) => ({ date: p.date, score: p.score, rolling: p.rolling_4w }));
    if (fc.available && fc.points?.length && hist.length) {
      const last = hist[hist.length - 1];
      last.forecast = last.rolling ?? last.score;
      last.band = [last.forecast!, last.forecast!];
      fc.points.forEach((p) => hist.push({ date: p.date, forecast: p.forecast, band: [p.lower, p.upper] }));
    }
    return hist;
  }, [d, fc]);

  return (
    <>
      <CardHeader
        title={<span className="flex items-center gap-2">{d.topic} <MarketStatus status={mt.status} /></span>}
        description={`${mt.category} · tracked keywords: ${mt.keywords.join(", ")}`}
      />
      <CardBody>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Current score" value={`${mt.current_score.toFixed(0)} / 100`} sub={mt.strength} />
          <Metric label="Growth (12 weeks)" value={fmtPct(mt.growth_pct, 1, true)} sub={mt.growth_basis} tone={mt.growth_pct} />
          <Metric label="Year over year" value={fmtPct(mt.yoy_pct, 0, true)} sub={mt.yoy_pct == null ? "under 1 year of data" : "vs 52 weeks earlier"} tone={mt.yoy_pct} />
          <Metric label="Recent momentum" value={mt.momentum_pct_per_week == null ? "–" : `${mt.momentum_pct_per_week > 0 ? "+" : ""}${mt.momentum_pct_per_week.toFixed(1)}%/wk`} sub="8-week linear slope" tone={mt.momentum_pct_per_week} />
        </dl>
        <div className="mt-4">
          <ForecastChart data={chart} lastHistory={d.points[d.points.length - 1]?.date} />
        </div>
        <div className="mt-3 rounded-lg border border-border bg-subtle/50 p-4 text-[13px]">
          {fc.available ? (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-ink">Projected trend direction: {fc.direction}</span>
                <span className="text-ink-2">Expected momentum over {fc.points?.length} weeks: {fmtPct(fc.expected_change_pct, 1, true)}</span>
                {fc.backtest && <span className="text-ink-2">Back-test error (last {fc.backtest.weeks} wks): {fc.backtest.mape_pct.toFixed(1)}% MAPE · {fc.reliability} reliability</span>}
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                {fc.method} (α={fc.params?.alpha}, β={fc.params?.beta}, φ={fc.params?.phi}). {fc.disclaimer}
              </p>
            </>
          ) : (
            <div className="flex items-start gap-2 text-warn-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><span className="font-semibold">{fc.reason}</span> <span className="text-ink-2">{fc.detail}</span></div>
            </div>
          )}
        </div>
        {d.opportunity && (
          <p className="mt-3 text-[12.5px] text-ink-3">
            Opportunity score for this topic: <span className="font-semibold text-ink">{d.opportunity.score.toFixed(0)}/100</span> ({d.opportunity.band}). See section 3.
          </p>
        )}
      </CardBody>
    </>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number | null }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className={cn("mt-0.5 text-[16px] font-semibold", tone == null ? "text-ink" : tone > 0 ? "text-good-ink" : tone < 0 ? "text-bad-ink" : "text-ink")}>{value}</dd>
      {sub && <dd className="truncate text-[11px] text-ink-3" title={sub}>{sub}</dd>}
    </div>
  );
}

function OpportunityCard({ o, onExplain }: { o: Opportunity; onExplain: () => void }) {
  return (
    <Card className="flex flex-col">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11.5px] font-medium text-ink-3">#{o.rank} · {o.category}</div>
            <h3 className="mt-0.5 text-[17px] font-semibold text-ink">{o.topic}</h3>
            <div className="mt-1.5"><BandBadge band={o.band} /></div>
          </div>
          <div className="text-right">
            <div className="text-[30px] font-semibold leading-none text-ink">{o.score.toFixed(0)}</div>
            <div className="text-[11px] text-ink-3">/ 100</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${o.score}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
          <div><dt className="text-ink-3">Market momentum</dt><dd className="font-semibold text-ink">{o.momentum_level}</dd></div>
          <div><dt className="text-ink-3">Your coverage</dt><dd className="font-semibold text-ink">{o.coverage_level}</dd></div>
          <div><dt className="text-ink-3">Related engagement</dt><dd className="font-semibold text-ink">{o.engagement_level}</dd></div>
        </dl>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2"><span className="font-medium text-ink">Reason: </span>{o.reason}</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{o.recommendation}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <ButtonLink href={`/content?q=${encodeURIComponent(o.explore_term)}`} size="sm" variant="primary"><Search className="h-3.5 w-3.5" /> Explore topic</ButtonLink>
          <Button size="sm" onClick={onExplain}><Calculator className="h-3.5 w-3.5" /> Why this score?</Button>
          {o.closest_content_group && (
            <Link href={`/topics?topic=${encodeURIComponent(o.closest_content_group.name)}`} className="text-[12px] font-medium text-primary hover:underline">
              Closest group: {o.closest_content_group.name}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function ScoreBreakdown({ o }: { o: Opportunity }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {o.breakdown.components.map((c) => (
          <div key={c.name}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-ink">{c.name} <span className="font-normal text-ink-3">(weight {c.weight})</span></span>
              <span className="tabular text-ink-2">value {c.value.toFixed(2)} → <span className="font-semibold text-ink">+{c.contribution.toFixed(1)}</span> pts</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-primary" style={{ width: `${c.value * 100}%` }} />
            </div>
            <p className="mt-1 text-[12px] text-ink-3">{c.explanation}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-subtle p-3 text-[13px]">
        <span className="text-ink-2">Total</span>
        <span className="text-[18px] font-semibold text-ink">{o.score.toFixed(1)} / 100 · {o.band}</span>
      </div>
      <div className="text-[12.5px] text-ink-2">
        <p><span className="font-medium text-ink">Matched phrases in your content:</span>{" "}
          {Object.entries(o.phrase_matches).map(([p, n]) => `“${p}” (${n})`).join(", ") || "none"}</p>
        <p className="mt-1"><span className="font-medium text-ink">Engagement basis:</span> {o.engagement_basis}
          {o.your_avg_engagement != null && <> · related average {fmtEng(o.your_avg_engagement)}</>}
        </p>
        <p className="mt-1"><span className="font-medium text-ink">Recent coverage (last 180 days):</span> {o.your_recent_volume} records ({o.your_recent_share_pct?.toFixed(1) ?? "–"}% of recent content)</p>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-ink-3"><InfoTip>Scores are decision-support signals, not guarantees.</InfoTip> This is a potential opportunity to evaluate, not an instruction.</p>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Market /></Suspense>;
}
