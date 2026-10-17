"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FlaskConical, Tags } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, Button, Card, CardBody, CardHeader, InfoTip, Select } from "@/components/ui/primitives";
import { ErrorState, LoadingState, PageSkeleton } from "@/components/ui/states";
import { ClusterScatter, ScatterPoint, TimeLineChart } from "@/components/charts/Charts";
import { RunAnalysisButton } from "@/components/PipelineActions";
import { api } from "@/lib/api";
import { colorFor } from "@/lib/colors";
import { cn, fmtEng, fmtInt, fmtPct } from "@/lib/format";
import type { EngagementMeta, Topic } from "@/lib/types";

interface TopicsRes {
  n_clusters: number; topics: Topic[]; engagement: EngagementMeta;
  clustering: { silhouette: number | null; inertia: number; algorithm: string; iterations: number };
  features: { features_extracted: number; documents: number };
  labeling: { method: string };
}
interface ScatterRes { points: ScatterPoint[]; method: string; explained_variance_pct: number[]; sampled: boolean; total: number }
interface KEval { current_k: number; results: { k: number; inertia: number; silhouette: number | null }[] }

function TopicMining() {
  const { status } = useAppStatus();
  const sp = useSearchParams();
  const { data, error, loading, reload } = useApi<TopicsRes>("/api/topics");
  const scatter = useApi<ScatterRes>("/api/topics/scatter");
  const [k, setK] = useState<number>(status?.n_clusters ?? 5);
  const [highlight, setHighlight] = useState<string | null>(sp.get("topic"));
  const [evalOn, setEvalOn] = useState(false);
  const kEval = useApi<KEval>(evalOn ? "/api/topics/evaluate-k" : null);

  useEffect(() => { if (status?.n_clusters) setK(status.n_clusters); }, [status?.n_clusters]);
  useEffect(() => {
    const t = sp.get("topic");
    if (t && data) document.getElementById(`topic-${t}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sp, data]);

  const header = (
    <PageHeader
      title="Topic Mining"
      question="What are we talking about?"
      description="Content is converted to TF-IDF vectors and grouped with K-Means clustering. Each group is a topic; its name is generated from the group's most important terms."
      actions={<a href={api.downloadUrl("/api/topics/export")} download><Button size="sm"><Download className="h-3.5 w-3.5" /> Export topic summary</Button></a>}
    />
  );
  if (error) return <>{header}<ErrorState error={error} onRetry={reload} /></>;
  if (loading || !data) return <>{header}<PageSkeleton /></>;

  const order = data.topics.map((t) => t.name);
  const unit = data.engagement.unit;
  const sil = data.clustering.silhouette;

  return (
    <>
      {header}

      {/* summary + controls */}
      <Card>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Topics discovered" value={String(data.n_clusters)} />
            <Stat label="Records clustered" value={fmtInt(data.features.documents)} />
            <Stat label="TF-IDF features" value={fmtInt(data.features.features_extracted)} />
            <Stat
              label="Silhouette (cosine)"
              value={sil == null ? "–" : sil.toFixed(3)}
              info="Silhouette measures how well each record fits its own cluster vs the next-closest one (−1 to 1). Short social posts share vocabulary, so values of 0.05–0.2 are typical for text; compare values across k rather than against 1."
            />
          </dl>
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Number of topics (k)"
              value={String(k)}
              onChange={(v) => setK(Number(v))}
              options={Array.from({ length: (status?.limits.max_clusters ?? 12) - 1 }, (_, i) => String(i + 2))}
              placeholder={null}
              className="w-40"
            />
            <RunAnalysisButton k={k} disabled={k === data.n_clusters} />
          </div>
        </div>
        <div className="flex items-start gap-2 border-t border-border bg-subtle/50 px-5 py-3 text-[12.5px] text-ink-2">
          <Tags className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-ink">Topic labels are generated from cluster terms.</span> {data.labeling.method}{" "}
            <Link href="/methodology#topics" className="text-primary hover:underline">How it works</Link>
          </p>
        </div>
      </Card>

      {/* topic cards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {data.topics.map((t) => (
          <Card key={t.cluster_id} id={`topic-${t.name}`} className={cn(highlight === t.name && "ring-2 ring-primary/40")}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorFor(t.name, order) }} aria-hidden />
                    <h3 className="truncate text-[16px] font-semibold text-ink">{t.name}</h3>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={t.label_method.startsWith("lexicon") ? "primary" : "neutral"}>
                      {t.label_method.startsWith("lexicon") ? `Label match ${(t.label_score * 100).toFixed(0)}%` : "Named from top terms"}
                    </Badge>
                    {t.label_method === "lexicon-mixed" && <Badge tone="warn">Mixed topic</Badge>}
                    <span className="text-[12px] text-ink-3">Cluster {t.cluster_id}</span>
                    {t.also_covers.length > 0 && <span className="text-[12px] text-ink-3">· also features {t.also_covers.join(", ")}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[20px] font-semibold leading-none text-ink">{t.share_pct.toFixed(0)}%</div>
                  <div className="mt-1 text-[11.5px] text-ink-3">{fmtInt(t.size)} records</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-subtle/70 p-3 text-[12px]">
                <div><div className="text-ink-3">Avg engagement</div><div className="font-medium text-ink">{fmtEng(t.avg_engagement, unit)}</div></div>
                <div><div className="text-ink-3">vs dataset avg</div><div className={cn("font-medium", (t.engagement_vs_avg_pct ?? 0) >= 0 ? "text-good-ink" : "text-bad-ink")}>{fmtPct(t.engagement_vs_avg_pct, 0, true)}</div></div>
                <div><div className="text-ink-3">Top category</div><div className="truncate font-medium text-ink">{t.top_categories[0]?.name ?? "–"}</div></div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
                  Top keywords <InfoTip>Terms with the highest weight in this cluster&apos;s K-Means centroid (average TF-IDF of its records).</InfoTip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.top_terms.slice(0, 10).map((term, i) => (
                    <span key={term.term} className={cn("rounded-md border px-2 py-0.5 text-[12px]", i < 3 ? "border-primary/25 bg-primary-soft font-medium text-primary-ink" : "border-border text-ink-2")}>
                      {term.term}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">Representative content (closest to centroid)</div>
                <ul className="space-y-1.5">
                  {t.representative.map((r) => (
                    <li key={r.id}>
                      <Link href={`/content?q=${encodeURIComponent(r.id)}`} className="block rounded-md px-2 py-1.5 hover:bg-subtle">
                        <div className="truncate text-[13px] font-medium text-ink">{r.title}</div>
                        <div className="truncate text-[12px] text-ink-3">{r.snippet}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 flex gap-3 text-[12.5px]">
                <Link className="font-medium text-primary hover:underline" href={`/content?topic=${encodeURIComponent(t.name)}`}>View {fmtInt(t.size)} records</Link>
                <Link className="font-medium text-primary hover:underline" href={`/keywords?topic=${encodeURIComponent(t.name)}`}>Keywords</Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* cluster visualization */}
      <Card className="mt-4">
        <CardHeader
          title="Cluster visualization"
          description={scatter.data ? `${scatter.data.method}: each point is a record, projected from ${fmtInt(data.features.features_extracted)} TF-IDF dimensions to 2. The two components explain ${scatter.data.explained_variance_pct.map((v) => v.toFixed(1)).join("% and ")}% of variance, so overlap in 2-D is expected even when clusters are distinct in the full space.` : undefined}
          action={
            <Select label="Highlight" value={highlight ?? ""} onChange={(v) => setHighlight(v || null)} options={order} placeholder="All topics" className="w-48" />
          }
        />
        <CardBody>
          {scatter.error ? <ErrorState error={scatter.error} /> : !scatter.data ? <LoadingState message="Projecting clusters…" /> :
            <ClusterScatter points={scatter.data.points} order={order} unit={unit} highlight={highlight} />}
          {scatter.data?.sampled && <p className="mt-2 text-[12px] text-ink-3">Showing a random sample of {fmtInt(scatter.data.points.length)} of {fmtInt(scatter.data.total)} records.</p>}
        </CardBody>
      </Card>

      {/* choosing k */}
      <Card className="mt-4">
        <CardHeader
          title="Choosing the number of topics"
          description="Elbow method (inertia) and silhouette score for k = 2–10. Look for where inertia stops dropping sharply and silhouette is relatively high; business readability of the topics matters too."
          action={!evalOn && <Button size="sm" onClick={() => setEvalOn(true)}><FlaskConical className="h-3.5 w-3.5" /> Evaluate k</Button>}
        />
        <CardBody>
          {!evalOn ? (
            <p className="text-[13px] text-ink-3">Runs K-Means for each k on the current TF-IDF matrix (takes a few seconds).</p>
          ) : kEval.error ? <ErrorState error={kEval.error} /> : !kEval.data ? <LoadingState message="Running K-Means for k = 2…10…" /> : (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[12.5px] font-medium text-ink-2">Inertia (within-cluster sum of squares) · lower is tighter</div>
                <TimeLineChart data={kEval.data.results.map((r) => ({ period: String(r.k), inertia: r.inertia }))} series={[{ key: "inertia", name: "Inertia" }]} granularity="k" height={220} format={(v) => v.toFixed(0)} />
              </div>
              <div>
                <div className="mb-1 text-[12.5px] font-medium text-ink-2">Silhouette score · higher is better separated</div>
                <TimeLineChart data={kEval.data.results.map((r) => ({ period: String(r.k), silhouette: r.silhouette }))} series={[{ key: "silhouette", name: "Silhouette", color: "#1baf7a" }]} granularity="k" height={220} format={(v) => v.toFixed(3)} />
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Stat({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[12px] text-ink-3">{label}{info && <InfoTip>{info}</InfoTip>}</dt>
      <dd className="mt-0.5 text-[20px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><TopicMining /></Suspense>;
}
