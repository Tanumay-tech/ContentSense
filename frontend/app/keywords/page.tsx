"use client";

import { Suspense, useState } from "react";
import { Hash, Sigma } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { FilterBar } from "@/components/FilterBar";
import { Card, CardBody, CardHeader, Segmented, Table, Td, Th } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState, PageSkeleton } from "@/components/ui/states";
import { HBarChart } from "@/components/charts/Charts";
import { colorFor, MUTED_BAR, PRIMARY } from "@/lib/colors";
import { fmtInt, fmtNum } from "@/lib/format";

interface Row { term: string; frequency: number; documents: number; doc_share_pct?: number; importance?: number | null; lift?: number | null; frequency_rank?: number | null; importance_rank?: number | null }
interface KwRes {
  records: number; total_records: number; min_support: number;
  frequent: Row[]; important: Row[]; bigrams: Row[]; trigrams: Row[]; table: Row[]; frequent_not_important: Row[];
  by_topic: { group: string; records: number; keywords: { term: string; importance: number; frequency: number }[] }[];
  by_category: { group: string; records: number; keywords: { term: string; importance: number; frequency: number }[] }[];
}

function Keywords() {
  const { meta } = useAppStatus();
  const { filters, setFilters } = useUrlFilters();
  const { data, error, loading, reload } = useApi<KwRes>("/api/keywords", filters);
  const [phrase, setPhrase] = useState<"bigrams" | "trigrams">("bigrams");
  const [group, setGroup] = useState<"by_topic" | "by_category">("by_topic");
  const [showAll, setShowAll] = useState(false);

  const header = (
    <PageHeader
      title="Keyword Intelligence"
      question="What terms and themes matter?"
      description="Compare how often terms appear (frequency) with how informative they are (TF-IDF importance). A common word is not necessarily the most informative one."
    />
  );

  return (
    <>
      {header}
      <FilterBar value={filters} onChange={setFilters} show={["topic", "category", "platform", "start", "end"]} />
      <div className="mt-4">
        {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <PageSkeleton /> : data.records === 0 ? (
          <EmptyState title="No records match these filters" description="Clear or widen the filters to analyse keywords." />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            <p className="mb-3 text-[12.5px] text-ink-3">Analysing <span className="font-medium text-ink-2">{fmtInt(data.records)}</span> of {fmtInt(data.total_records)} records.</p>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title={<span className="flex items-center gap-1.5"><Hash className="h-4 w-4 text-ink-3" />Frequency</span>}
                  description="Raw count of each term after cleaning (stop words removed). Shows what you talk about most."
                />
                <CardBody>
                  <HBarChart data={data.frequent.slice(0, 15).map((r) => ({ name: r.term, value: r.frequency, docs: r.documents }))}
                    color={MUTED_BAR} format={(v) => fmtInt(v)} valueLabel="Occurrences"
                    extraTip={(d) => [{ label: "Records containing", value: fmtInt(d.docs as number) }]} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title={<span className="flex items-center gap-1.5"><Sigma className="h-4 w-4 text-primary" />Importance (TF-IDF)</span>}
                  description="Average TF-IDF weight where the term is used × ln(1 + records using it). Rewards distinctive, topical terms."
                  info={`TF-IDF gives a term a high weight when it is frequent in a record but rare across the collection. Terms must appear in at least ${data.min_support} records.`}
                />
                <CardBody>
                  <HBarChart data={data.important.slice(0, 15).map((r) => ({ name: r.term, value: r.importance ?? 0, freq: r.frequency, docs: r.documents }))}
                    color={PRIMARY} format={(v) => v.toFixed(1)} valueLabel="Importance score"
                    extraTip={(d) => [{ label: "Occurrences", value: fmtInt(d.freq as number) }, { label: "Records", value: fmtInt(d.docs as number) }]} />
                </CardBody>
              </Card>
            </div>

            {data.frequent_not_important.length > 0 && (
              <div className="mt-4 rounded-xl border border-warn/40 bg-warn-soft/60 px-5 py-4 text-[13px] text-ink-2">
                <span className="font-semibold text-ink">Frequent but not very informative: </span>
                {data.frequent_not_important.map((r, i) => (
                  <span key={r.term}>
                    <span className="font-medium text-ink">“{r.term}”</span> (#{r.frequency_rank} by frequency, {r.importance_rank ? `#${r.importance_rank}` : "unranked"} by importance){i < data.frequent_not_important.length - 1 ? ", " : ""}
                  </span>
                ))}
                . These words are spread thinly across many kinds of content, so TF-IDF gives them less weight.
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-2">
                <CardHeader title="Key phrases" description="Most frequent word sequences (n-grams)"
                  action={<Segmented ariaLabel="Phrase length" value={phrase} onChange={setPhrase} options={[{ value: "bigrams", label: "Bigrams" }, { value: "trigrams", label: "Trigrams" }]} />} />
                <CardBody>
                  {data[phrase].length ? (
                    <HBarChart data={data[phrase].slice(0, 12).map((r) => ({ name: r.term, value: r.frequency }))} color={PRIMARY} format={(v) => fmtInt(v)} valueLabel="Occurrences" maxLabel={28} />
                  ) : <p className="text-[13px] text-ink-3">Not enough repeated phrases in this selection.</p>}
                </CardBody>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader title="Keywords by group" description="Most characteristic terms within each topic or category"
                  action={<Segmented ariaLabel="Group by" value={group} onChange={setGroup} options={[{ value: "by_topic", label: "By topic" }, { value: "by_category", label: "By category" }]} />} />
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data[group].map((g) => (
                      <div key={g.group} className="rounded-lg border border-border p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
                            {group === "by_topic" && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorFor(g.group, meta?.topics ?? []) }} />}
                            <span className="truncate">{g.group}</span>
                          </span>
                          <span className="shrink-0 text-[11.5px] text-ink-3">{fmtInt(g.records)} records</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {g.keywords.map((k) => (
                            <span key={k.term} title={`${k.frequency} occurrences`} className="rounded border border-border bg-subtle/60 px-1.5 py-0.5 text-[11.5px] text-ink-2">{k.term}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader title="Keyword detail" description="Union of the top frequent and top important terms. Lift > 1 means the term is more characteristic of this selection than of the whole dataset." />
              <CardBody className="px-0 pb-2">
                <Table>
                  <thead>
                    <tr>
                      <Th>Term</Th><Th align="right">Frequency</Th><Th align="right">Records</Th><Th align="right">% of records</Th>
                      <Th align="right">Importance</Th><Th align="right">Lift</Th><Th align="right">Rank (freq / imp)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAll ? data.table : data.table.slice(0, 15)).map((r) => (
                      <tr key={r.term} className="hover:bg-subtle/50">
                        <Td className="font-medium text-ink">{r.term}</Td>
                        <Td align="right">{fmtInt(r.frequency)}</Td>
                        <Td align="right">{fmtInt(r.documents)}</Td>
                        <Td align="right">{fmtNum(r.doc_share_pct, 1)}%</Td>
                        <Td align="right">{fmtNum(r.importance, 1)}</Td>
                        <Td align="right" className={r.lift != null && r.lift >= 1.5 ? "font-medium text-good-ink" : ""}>{r.lift == null ? "–" : `×${r.lift.toFixed(2)}`}</Td>
                        <Td align="right">{r.frequency_rank ?? "–"} / {r.importance_rank ?? "–"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {data.table.length > 15 && (
                  <button onClick={() => setShowAll(!showAll)} className="mx-5 mt-3 text-[12.5px] font-medium text-primary hover:underline">
                    {showAll ? "Show fewer" : `Show all ${data.table.length} terms`}
                  </button>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Keywords /></Suspense>;
}
