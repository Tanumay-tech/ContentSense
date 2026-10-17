"use client";

import { Suspense, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { Badge, Button, Card, Table, Td, Th } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { colorFor } from "@/lib/colors";
import { cn, fmtDate, fmtEng, fmtInt } from "@/lib/format";

interface Item {
  id: string; date: string | null; platform: string; title: string; snippet: string; topic: string; category: string;
  engagement: number | null; likes: number; comments: number; shares: number; views: number | null;
}
interface PageRes { items: Item[]; total: number; page: number; pages: number; page_size: number; engagement_label: string; engagement_unit: string }
interface Detail extends Item {
  content: string; author: string; url: string | null; cluster: number; keywords: string[]; clean_text: string; interactions: number;
  topic_avg_engagement: number | null; dataset_avg_engagement: number | null;
}

const COLS: { key: string; label: string; sortable?: boolean; align?: "right" }[] = [
  { key: "date", label: "Date", sortable: true },
  { key: "platform", label: "Platform", sortable: true },
  { key: "title", label: "Content" },
  { key: "topic", label: "Topic", sortable: true },
  { key: "category", label: "Category", sortable: true },
  { key: "engagement", label: "Engagement", sortable: true, align: "right" },
];

function ContentExplorer() {
  const { meta } = useAppStatus();
  const { filters, setFilters } = useUrlFilters(["sort", "order", "page"]);
  const sort = filters.sort ?? "date";
  const order = filters.order ?? "desc";
  const page = Number(filters.page ?? 1);
  const [openId, setOpenId] = useState<string | null>(null);

  const params = { ...filters, sort, order, page, page_size: 25 };
  const { data, error, loading, reload } = useApi<PageRes>("/api/content", params);
  const detail = useApi<Detail>(openId ? `/api/content/${encodeURIComponent(openId)}` : null);
  const topicOrder = meta?.topics ?? [];
  const unit = data?.engagement_unit ?? "%";

  const { sort: _s, order: _o, page: _p, ...filterOnly } = filters;
  const setSort = (key: string) =>
    setFilters({ ...filters, sort: key, order: sort === key && order === "desc" ? "asc" : "desc", page: undefined });

  return (
    <>
      <PageHeader
        title="Content Explorer"
        question="What content do we have?"
        description="Search and inspect the cleaned content records behind every chart. Click a row to see its extracted keywords, topic and engagement breakdown."
        actions={
          <a href={api.downloadUrl("/api/content/export", filterOnly)} download>
            <Button size="sm"><Download className="h-3.5 w-3.5" /> Export filtered CSV</Button>
          </a>
        }
      />
      <FilterBar value={filterOnly} onChange={(v) => setFilters({ ...v, sort: filters.sort, order: filters.order })} show={["q", "topic", "category", "platform", "min_engagement", "start", "end"]} />

      <Card className="mt-4">
        <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-ink-3">
          <span>{data ? <><span className="font-semibold text-ink">{fmtInt(data.total)}</span> records match</> : " "}</span>
          {data && <span>Engagement = {data.engagement_label.toLowerCase()}</span>}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} className="m-4" />
        ) : loading && !data ? (
          <LoadingState message="Loading content…" />
        ) : data && data.total === 0 ? (
          <EmptyState className="m-4" title="No content matches these filters" description="Try a broader keyword or clear some filters." />
        ) : data ? (
          <>
            <Table className={cn(loading && "opacity-60")}>
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <Th key={c.key} align={c.align}>
                      {c.sortable ? (
                        <button onClick={() => setSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-ink" aria-label={`Sort by ${c.label}`}>
                          {c.label}
                          {sort === c.key && (order === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                        </button>
                      ) : c.label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} onClick={() => setOpenId(it.id)} onKeyDown={(e) => e.key === "Enter" && setOpenId(it.id)} tabIndex={0}
                    className="cursor-pointer hover:bg-primary-soft/30 focus:bg-primary-soft/40 focus:outline-none">
                    <Td className="whitespace-nowrap tabular">{fmtDate(it.date)}</Td>
                    <Td className="whitespace-nowrap">{it.platform}</Td>
                    <Td className="max-w-[380px]">
                      <div className="truncate font-medium text-ink">{it.title}</div>
                      <div className="truncate text-[12px] text-ink-3">{it.snippet}</div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: colorFor(it.topic, topicOrder) }} aria-hidden />
                        {it.topic}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">{it.category}</Td>
                    <Td align="right" className="font-medium text-ink">{fmtEng(it.engagement, unit)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-ink-3">
              <span>Page {data.page} of {data.pages}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={page <= 1} onClick={() => setFilters({ ...filters, page: String(page - 1) })}><ChevronLeft className="h-3.5 w-3.5" /> Previous</Button>
                <Button size="sm" disabled={page >= data.pages} onClick={() => setFilters({ ...filters, page: String(page + 1) })}>Next <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <Drawer open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} title={detail.data?.title ?? "Loading…"}
        description={detail.data ? `${detail.data.id} · ${detail.data.platform} · ${fmtDate(detail.data.date)} · ${detail.data.author}` : undefined}>
        {detail.error ? <ErrorState error={detail.error} /> : !detail.data ? <LoadingState /> : <DetailBody d={detail.data} unit={unit} order={topicOrder} />}
      </Drawer>
    </>
  );
}

function DetailBody({ d, unit, order }: { d: Detail; unit: string; order: string[] }) {
  const stats = [
    { label: "Likes", value: fmtInt(d.likes) },
    { label: "Comments", value: fmtInt(d.comments) },
    { label: "Shares", value: fmtInt(d.shares) },
    { label: "Views", value: fmtInt(d.views) },
  ];
  return (
    <div className="space-y-6">
      <section>
        <h4 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Full content</h4>
        <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{d.content}</p>
        {d.url && (
          <a href={d.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline">
            {d.url} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11.5px] text-ink-3">Topic (cluster {d.cluster})</div>
          <div className="mt-1 flex items-center gap-1.5 font-medium text-ink">
            <span className="h-2 w-2 rounded-full" style={{ background: colorFor(d.topic, order) }} />{d.topic}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[11.5px] text-ink-3">Category</div>
          <div className="mt-1 font-medium text-ink">{d.category}</div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Engagement</h4>
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-subtle/70 p-2.5 text-center">
              <div className="text-[15px] font-semibold text-ink tabular">{s.value}</div>
              <div className="text-[11px] text-ink-3">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-border p-3 text-[13px]">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-3">{unit === "%" ? "Engagement rate" : "Weighted interactions"}</span>
            <span className="text-[18px] font-semibold text-ink">{fmtEng(d.engagement, unit)}</span>
          </div>
          {unit === "%" && d.views ? (
            <p className="mt-1 text-[12px] text-ink-3">({fmtInt(d.likes)} + {fmtInt(d.comments)} + {fmtInt(d.shares)}) / {fmtInt(d.views)} × 100</p>
          ) : null}
          <p className="mt-1 text-[12px] text-ink-3">
            Topic average {fmtEng(d.topic_avg_engagement, unit)} · dataset average {fmtEng(d.dataset_avg_engagement, unit)}
          </p>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Extracted keywords (top TF-IDF terms)</h4>
        <div className="flex flex-wrap gap-1.5">{d.keywords.map((k) => <Badge key={k} tone="primary">{k}</Badge>)}</div>
      </section>

      <section>
        <h4 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Preprocessed text (input to TF-IDF)</h4>
        <p className="rounded-lg bg-subtle/70 p-3 font-mono text-[12px] leading-relaxed text-ink-2">{d.clean_text}</p>
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><ContentExplorer /></Suspense>;
}
