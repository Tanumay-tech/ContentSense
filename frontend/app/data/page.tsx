"use client";

import { useRef, useState } from "react";
import {
  ArrowRight, BarChart3, Brush, ChevronDown, Database, FileSpreadsheet, Filter, Lightbulb, Loader2, RotateCcw, Sigma, Tags, Upload,
} from "lucide-react";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, Button, Card, CardBody, CardHeader, InfoTip, Select, Table, Td, Th } from "@/components/ui/primitives";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { LoadDemoButton, RunAnalysisButton } from "@/components/PipelineActions";
import { ApiError, api } from "@/lib/api";
import { cn, fmtDate, fmtInt } from "@/lib/format";
import type { Status } from "@/lib/types";

interface UploadRes {
  source: { name: string; rows: number };
  validation?: { rows: number; recognized: string[]; ignored: string[]; missing_optional: string[]; warnings: string[] };
  warnings?: string[];
  preview?: Record<string, string>[];
}

const STAGE_LABELS: Record<string, string> = {
  ingestion: "Ingestion & validation", cleaning: "Cleaning & preprocessing", feature_extraction: "TF-IDF feature extraction",
  clustering: "K-Means clustering", topic_labelling: "Topic labelling", engagement_analysis: "Engagement analysis",
  trend_and_keyword_analysis: "Trend & keyword analysis", market_comparison: "Market comparison", insight_generation: "Insight generation",
};

export default function DataPage() {
  const { status, error, loading, refresh, setStatus } = useAppStatus();
  const [k, setK] = useState<number>(status?.n_clusters ?? 5);
  const [upload, setUpload] = useState<UploadRes | null>(null);
  const [marketMsg, setMarketMsg] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<null | "content" | "market" | "reset">(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const contentRef = useRef<HTMLInputElement>(null);
  const marketRef = useRef<HTMLInputElement>(null);

  const header = (
    <PageHeader
      title="Data & Processing"
      question="How did the mining pipeline process the data?"
      description="Load or upload authorised content data, run the Web Content Mining pipeline, and inspect what each stage did."
    />
  );
  if (error) return <>{header}<ErrorState error={error} onRetry={refresh} /></>;
  if (loading || !status) return <>{header}<PageSkeleton /></>;

  const p = status.pipeline;

  const onContent = async (f?: File) => {
    if (!f) return;
    setBusy("content"); setErr(null); setUpload(null);
    try {
      const res = await api.upload<UploadRes>("/api/data/upload", f);
      setUpload(res);
      await refresh();
    } catch (e) { setErr(e as ApiError); }
    finally { setBusy(null); if (contentRef.current) contentRef.current.value = ""; }
  };
  const onMarket = async (f?: File) => {
    if (!f) return;
    setBusy("market"); setErr(null); setMarketMsg(null);
    try {
      const res = await api.upload<UploadRes>("/api/market-data/upload", f);
      setMarketMsg([`Loaded ${fmtInt(res.source.rows)} market rows.`, ...(res.warnings ?? [])]);
      await refresh();
    } catch (e) { setErr(e as ApiError); }
    finally { setBusy(null); if (marketRef.current) marketRef.current.value = ""; }
  };
  const onReset = async () => {
    setBusy("reset"); setErr(null);
    try { setStatus(await api.post<Status>("/api/data/reset")); setUpload(null); setMarketMsg(null); }
    catch (e) { setErr(e as ApiError); }
    finally { setBusy(null); setConfirmReset(false); }
  };

  const flow = [
    { icon: Database, label: "Web content", value: p ? fmtInt(p.cleaning.records_received) : "–", sub: "records received" },
    { icon: Brush, label: "Cleaning", value: p ? fmtInt(p.cleaning.records_cleaned) : "–", sub: "records kept" },
    { icon: Sigma, label: "Feature extraction", value: p ? fmtInt(p.features.features_extracted) : "–", sub: "TF-IDF features" },
    { icon: Filter, label: "Clustering", value: p ? String(p.clustering.clusters_generated) : "–", sub: "K-Means clusters" },
    { icon: Tags, label: "Topic groups", value: p ? String(p.topics.topics_generated) : "–", sub: "named topics" },
    { icon: BarChart3, label: "Analytics", value: p?.engagement.available ? "✓" : "–", sub: p?.engagement.label ?? "engagement" },
    { icon: Lightbulb, label: "Insights", value: p?.insights ? String(p.insights.generated) : "–", sub: p?.market.loaded ? `insights · ${p.market.topics} market topics scored` : "insights generated" },
  ];

  return (
    <>
      {header}

      {/* pipeline flow */}
      <Card>
        <CardHeader title="Web Content Mining pipeline" description={status.ran_at ? `Last run ${new Date(status.ran_at).toLocaleString()} · ${p?.total_ms ? (p.total_ms / 1000).toFixed(1) + " s" : ""}` : "Not run yet"} />
        <CardBody>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {flow.map((s, i) => (
              <li key={s.label} className="relative">
                <div className={cn("h-full rounded-lg border p-3", p ? "border-primary/25 bg-primary-soft/40" : "border-border bg-subtle/50")}>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><s.icon className="h-3.5 w-3.5 text-primary" />{s.label}</div>
                  <div className="mt-1.5 text-[20px] font-semibold text-ink">{s.value}</div>
                  <div className="text-[11px] text-ink-3">{s.sub}</div>
                </div>
                {i < flow.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-surface text-ink-3 lg:block" aria-hidden />}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {/* data sources */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Content dataset" description="Your authorised historical content (CSV). Required column: content. Recommended: date." />
          <CardBody className="space-y-4">
            <SourceLine src={status.content_source} empty="No content dataset loaded" />
            <div className="flex flex-wrap gap-2">
              <input ref={contentRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onContent(e.target.files?.[0])} />
              <Button onClick={() => contentRef.current?.click()} disabled={!!busy}>
                {busy === "content" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload content CSV
              </Button>
              <LoadDemoButton variant="secondary" onDone={() => setUpload(null)} />
            </div>
            <p className="text-[12px] text-ink-3">
              Columns: id, date, platform, title, <span className="font-semibold text-ink-2">content</span>, category, author, likes, comments, shares, views, url.{" "}
              <a className="text-primary hover:underline" href={api.downloadUrl("/api/data/sample/content")}>Download sample</a>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Market trend dataset" description="Authorised market interest data (CSV). Required: topic, date, trend_score. Optional: keyword, volume, growth_rate, source, category." />
          <CardBody className="space-y-4">
            <SourceLine src={status.market_source} empty="No market dataset loaded. Market Trends & Opportunities will be unavailable." />
            <div className="flex flex-wrap gap-2">
              <input ref={marketRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onMarket(e.target.files?.[0])} />
              <Button onClick={() => marketRef.current?.click()} disabled={!!busy}>
                {busy === "market" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Upload market CSV
              </Button>
            </div>
            {marketMsg && <ul className="list-disc pl-5 text-[12.5px] text-ink-2">{marketMsg.map((m) => <li key={m}>{m}</li>)}</ul>}
            {status.market_warnings.length > 0 && !marketMsg && <ul className="list-disc pl-5 text-[12.5px] text-warn-ink">{status.market_warnings.map((m) => <li key={m}>{m}</li>)}</ul>}
            <p className="text-[12px] text-ink-3">
              No API keys needed. The architecture supports adding approved sources (e.g. Google Trends, platform APIs) later.{" "}
              <a className="text-primary hover:underline" href={api.downloadUrl("/api/data/sample/market")}>Download sample</a>
            </p>
          </CardBody>
        </Card>
      </div>

      {err && <ErrorState error={err} className="mt-4" />}

      {/* validation after upload */}
      {upload?.validation && (
        <Card className="mt-4 border-primary/30">
          <CardHeader title={`Validated “${upload.source.name}”`} description={`${fmtInt(upload.validation.rows)} rows read. Review, then run the analysis.`} />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              <span className="text-ink-3">Recognised:</span>{upload.validation.recognized.map((c) => <Badge key={c} tone="good">{c}</Badge>)}
              {upload.validation.ignored.length > 0 && <><span className="ml-2 text-ink-3">Ignored:</span>{upload.validation.ignored.map((c) => <Badge key={c}>{c}</Badge>)}</>}
            </div>
            {upload.validation.warnings.length > 0 && <ul className="list-disc pl-5 text-[12.5px] text-warn-ink">{upload.validation.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            {upload.preview && upload.preview.length > 0 && (
              <Table>
                <thead><tr>{["date", "platform", "title", "content", "likes", "views"].map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
                <tbody>{upload.preview.slice(0, 5).map((r, i) => (
                  <tr key={i}>{["date", "platform", "title", "content", "likes", "views"].map((c) => <Td key={c} className="max-w-[260px] truncate">{r[c] || "–"}</Td>)}</tr>
                ))}</tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}

      {/* run */}
      <Card className="mt-4">
        <CardHeader title="Run analysis" description="Cleans the content, extracts TF-IDF features, clusters with K-Means, names topics, and recalculates every analysis and the market comparison." />
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Number of topics (k)" value={String(k)} onChange={(v) => setK(Number(v))} placeholder={null}
              options={Array.from({ length: status.limits.max_clusters - 1 }, (_, i) => String(i + 2))} className="w-44" />
            <RunAnalysisButton k={k} disabled={!status.content_loaded} />
            <div className="ml-auto">
              {!confirmReset ? (
                <Button variant="danger" onClick={() => setConfirmReset(true)} disabled={!!busy}><RotateCcw className="h-4 w-4" /> Reset demo</Button>
              ) : (
                <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
                  Clear all data and results?
                  <Button variant="danger" size="sm" onClick={onReset} disabled={busy === "reset"}>{busy === "reset" ? "Clearing…" : "Yes, reset"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>
          {!status.content_loaded && <p className="mt-2 text-[12.5px] text-ink-3">Load the demo data or upload a CSV first.</p>}
          {status.content_loaded && !status.analysis_ready && <p className="mt-2 text-[12.5px] font-medium text-warn-ink">Data loaded but not analysed yet. Run the analysis to update every page.</p>}
        </CardBody>
      </Card>

      {/* processing statistics */}
      {p && (
        <Card className="mt-4">
          <CardHeader title="Processing statistics" description="What the cleaning, feature extraction and clustering stages did in the latest run" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Records received" value={fmtInt(p.cleaning.records_received)} />
              <Stat label="Records cleaned" value={fmtInt(p.cleaning.records_cleaned)} good />
              <Stat label="Duplicates removed" value={fmtInt(p.cleaning.duplicates_removed)} />
              <Stat label="Missing content" value={fmtInt(p.cleaning.missing_content)} info="Rows with blank text are removed: there is nothing to mine." />
              <Stat label="Features extracted" value={fmtInt(p.features.features_extracted)} info={`${fmtInt(p.features.unigrams)} single words + ${fmtInt(p.features.bigrams)} two-word phrases`} />
              <Stat label="Clusters generated" value={String(p.clustering.clusters_generated)} />
              <Stat label="Invalid numbers" value={fmtInt(p.cleaning.invalid_numeric_values)} info="Non-numeric or negative likes/comments/shares/views. Interactions are treated as 0; views are left missing." />
              <Stat label="Invalid dates" value={fmtInt(p.cleaning.invalid_dates)} info="Kept for text analysis, excluded from time-based trends." />
              <Stat label="Missing views" value={fmtInt(p.cleaning.missing_views)} info="Excluded from engagement-rate averages." />
              <Stat label="Missing category" value={fmtInt(p.cleaning.missing_category)} info="Labelled 'Uncategorized'." />
              <Stat label="Avg tokens / record" value={String(p.cleaning.avg_tokens_per_record)} />
              <Stat label="Matrix sparsity" value={`${p.features.sparsity_pct}%`} info="Share of zero cells in the document × term matrix. Text data is naturally very sparse." />
            </dl>
          </CardBody>
        </Card>
      )}

      {/* advanced */}
      {p && (
        <details className="group mt-4 rounded-xl border border-border bg-surface shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[14px] font-semibold text-ink">
            Advanced: stage timings, parameters and a preprocessing example
            <ChevronDown className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t border-border p-5 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Stage timings</h4>
              <ul className="space-y-1 text-[13px]">
                {Object.entries(p.timings_ms).map(([k2, v]) => (
                  <li key={k2} className="flex justify-between gap-3"><span className="text-ink-2">{STAGE_LABELS[k2] ?? k2}</span><span className="tabular text-ink">{v.toFixed(0)} ms</span></li>
                ))}
              </ul>
              <h4 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Parameters</h4>
              <pre className="scroll-thin overflow-x-auto rounded-lg bg-subtle p-3 text-[11.5px] text-ink-2">{JSON.stringify({ tfidf: p.features.params, kmeans: { algorithm: p.clustering.algorithm, n_init: p.clustering.n_init, random_state: p.clustering.random_state, iterations: p.clustering.iterations, inertia: p.clustering.inertia, silhouette: p.clustering.silhouette }, engagement: p.engagement.formula }, null, 2)}</pre>
            </div>
            <div>
              <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Preprocessing example</h4>
              {p.preprocessing_example && (
                <div className="space-y-2 text-[12.5px]">
                  <div className="rounded-lg border border-border p-3"><div className="mb-1 text-[11px] font-semibold text-ink-3">ORIGINAL</div><p className="text-ink-2">{p.preprocessing_example.original}</p></div>
                  <div className="rounded-lg border border-primary/25 bg-primary-soft/40 p-3"><div className="mb-1 text-[11px] font-semibold text-primary-ink">CLEANED (lowercase, links/punctuation/numbers removed, stop words removed, plurals normalised)</div><p className="font-mono text-ink-2">{p.preprocessing_example.cleaned}</p></div>
                </div>
              )}
              <h4 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Columns</h4>
              <p className="text-[12.5px] text-ink-2">Recognised: {p.ingestion.columns_recognized.join(", ")}</p>
              {p.ingestion.missing_optional.length > 0 && <p className="text-[12.5px] text-ink-3">Not provided: {p.ingestion.missing_optional.join(", ")}</p>}
              {p.ingestion.warnings.map((w) => <p key={w} className="text-[12.5px] text-warn-ink">{w}</p>)}
            </div>
          </div>
        </details>
      )}
    </>
  );
}

function SourceLine({ src, empty }: { src: { name: string; kind: string; rows: number; loaded_at: string } | null; empty: string }) {
  if (!src) return <p className="rounded-lg bg-subtle/70 px-3 py-2.5 text-[13px] text-ink-3">{empty}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-subtle/70 px-3 py-2.5 text-[13px]">
      <FileSpreadsheet className="h-4 w-4 text-ink-3" />
      <span className="font-medium text-ink">{src.name}</span>
      <Badge tone={src.kind === "demo" ? "warn" : "primary"}>{src.kind === "demo" ? "Sample / demo" : src.kind === "upload" ? "Uploaded" : "Stored"}</Badge>
      <span className="text-ink-3">{fmtInt(src.rows)} rows · {fmtDate(src.loaded_at.slice(0, 10))}</span>
    </div>
  );
}

function Stat({ label, value, info, good }: { label: string; value: string; info?: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="flex items-center gap-1 text-[11.5px] text-ink-3">{label}{info && <InfoTip>{info}</InfoTip>}</dt>
      <dd className={cn("mt-0.5 text-[18px] font-semibold", good ? "text-good-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}


