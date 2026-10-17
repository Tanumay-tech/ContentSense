"use client";

import { CheckCircle2, PlugZap } from "lucide-react";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, ButtonLink, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { API_URL } from "@/lib/api";
import { fmtInt } from "@/lib/format";

const USERS = ["Social Media Managers", "Digital Marketing Managers", "Content Strategists", "Brand Managers", "Marketing Agencies", "Marketing Analysts"];

const CUSTOMIZE = [
  ["Data sources / ingestion", "backend/app/processing/ingestion.py (columns, aliases, validation)"],
  ["Cleaning & preprocessing", "backend/app/processing/cleaning.py, backend/app/utils/text.py"],
  ["TF-IDF & clustering parameters", "backend/app/config.py, backend/app/processing/features.py, clustering.py"],
  ["Topic labels", "backend/app/processing/topics.py (TOPIC_LEXICON)"],
  ["Engagement formula", "backend/app/analytics/engagement.py, config.FALLBACK_WEIGHTS"],
  ["Market trend source & status rules", "backend/app/processing/trends.py, config.MARKET_*"],
  ["Forecasting", "backend/app/processing/forecasting.py, config.FORECAST_*"],
  ["Opportunity scoring", "backend/app/analytics/opportunities.py, config.OPPORTUNITY_WEIGHTS / BANDS"],
  ["Insight rules", "backend/app/analytics/insights.py"],
  ["UI theme & chart colours", "frontend/app/globals.css (tokens), frontend/lib/colors.ts"],
  ["Database", "DATABASE_URL env var (SQLite default, PostgreSQL-ready via SQLAlchemy)"],
];

export default function About() {
  const { status, error } = useAppStatus();
  return (
    <>
      <PageHeader title="Settings / About" question="What is ContentSense?" description="Understand your content. Detect market trends. Discover your next opportunity." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Content & Market Intelligence Platform" description="Industry: Digital Marketing · Primary concept: Web Content Mining" />
          <CardBody className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
            <p><span className="font-semibold text-ink">The problem.</span> Marketing teams often have large volumes of content data but lack a simple way to understand recurring topics, keywords, engagement patterns, and gaps relative to changing market trends.</p>
            <p><span className="font-semibold text-ink">The solution.</span> ContentSense converts that raw content into structured intelligence: it cleans the data, extracts TF-IDF features, groups content with K-Means, names the resulting topics, measures engagement, tracks trends, and compares the content mix with market interest to surface potential opportunities.</p>
            <div>
              <div className="mb-1.5 font-semibold text-ink">Built for</div>
              <div className="flex flex-wrap gap-1.5">{USERS.map((u) => <Badge key={u}>{u}</Badge>)}</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Connection" />
          <CardBody className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              {error ? <PlugZap className="h-4 w-4 text-bad" /> : <CheckCircle2 className="h-4 w-4 text-good" />}
              <span className="font-medium text-ink">{error ? "Backend unavailable" : "Backend connected"}</span>
            </div>
            <p className="break-all text-ink-3">API: {API_URL}</p>
            <p className="text-ink-3">Docs: <a className="text-primary hover:underline" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">{API_URL}/docs</a></p>
            {status && (
              <ul className="space-y-1 pt-2 text-ink-2">
                <li>Content: {status.content_source ? `${status.content_source.name} (${fmtInt(status.content_source.rows)} rows)` : "none"}</li>
                <li>Market: {status.market_source ? `${status.market_source.name} (${status.market_source.topics} topics)` : "none"}</li>
                <li>Topics (k): {status.n_clusters}</li>
              </ul>
            )}
            <ButtonLink href="/data" size="sm" className="mt-2">Manage data</ButtonLink>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Customisation" description="Where to change each part of the system. Pipeline parameters are centralised in backend/app/config.py." />
        <CardBody className="px-0 pb-2">
          <Table>
            <thead><tr><Th>What</Th><Th>File</Th></tr></thead>
            <tbody>{CUSTOMIZE.map(([a, b]) => <tr key={a}><Td className="font-medium text-ink">{a}</Td><Td className="font-mono text-[12px]">{b}</Td></tr>)}</tbody>
          </Table>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Technology" />
          <CardBody className="text-[13px] leading-relaxed text-ink-2">
            <p><span className="font-medium text-ink">Frontend:</span> Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn-style components on Radix UI, Recharts.</p>
            <p className="mt-1"><span className="font-medium text-ink">Backend:</span> Python, FastAPI, pandas, NumPy, scikit-learn (TF-IDF, K-Means, Truncated SVD, silhouette), SciPy, SQLAlchemy + SQLite.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Data usage & ethics" />
          <CardBody className="text-[13px] leading-relaxed text-ink-2">
            Use only authorised datasets: your own exports, public/permitted content and approved APIs. ContentSense performs no scraping,
            authentication or rate-limit bypass, robots.txt circumvention or private-data extraction. Demo data is synthetic.
          </CardBody>
        </Card>
      </div>
    </>
  );
}
