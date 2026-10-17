"use client";

import { Check, ChevronDown } from "lucide-react";
import { useAppStatus } from "@/components/layout/StatusProvider";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, Card } from "@/components/ui/primitives";
import { fmtInt } from "@/lib/format";

const PIPELINE = [
  { label: "Web Content", core: true },
  { label: "Data Cleaning", core: true },
  { label: "Feature Extraction (TF-IDF)", core: true },
  { label: "Clustering (K-Means)", core: true },
  { label: "Topic / Content Groups", core: true },
  { label: "Content Analytics", core: true },
  { label: "Market Trend Analysis", core: false },
  { label: "Opportunity Detection", core: false },
];

const CORE = ["Web Content Mining", "Topics", "Keywords", "Categories", "Content Frequency", "User Engagement", "Data Cleaning", "Feature Extraction", "Clustering", "Topic / Content Groups"];
const ADVANCED = ["Market Trend Analysis", "Trend Comparison", "Content Gap Detection", "Opportunity Scoring", "Trend Forecasting"];

const VIVA = [
  ["What is Web Content Mining?", "Web Content Mining is the discovery of useful information from the content of web pages and social posts (text, titles, metadata). It differs from web structure mining (links) and web usage mining (click logs). ContentSense mines the text of a brand's posts and articles to find topics, keywords and patterns, then links them to engagement."],
  ["What is being mined?", "Each record's title + content text (for topics and keywords), its category/platform/date (for grouping and trends), and its likes/comments/shares/views (for engagement). The market module additionally mines an authorised market trend time series."],
  ["How is text cleaned?", "Record level: blank content removed, duplicates (same text + platform + date) removed, numbers coerced (invalid → counted), dates parsed, defaults for missing platform/category. Text level: HTML, URLs, e-mails and @mentions removed; hashtags split (#ContentStrategy → content strategy); lowercase; punctuation and digits removed; English + domain stop words removed; conservative plural normalisation (strategies → strategy)."],
  ["How is feature extraction performed?", "The cleaned text is converted into a TF-IDF document-term matrix with scikit-learn's TfidfVectorizer: unigrams and bigrams, terms in fewer than 2 or more than 50% of documents dropped, at most 4,000 features, sublinear tf and L2-normalised rows."],
  ["Why is TF-IDF used?", "Raw counts over-reward words that appear everywhere. TF-IDF multiplies term frequency by inverse document frequency, so a term that is frequent in one post but rare across the collection gets a high weight. That makes vectors focus on what distinguishes a post, which is exactly what clustering needs. It is also fast, transparent and needs no training data."],
  ["Why is K-Means used?", "K-Means partitions records into k groups by minimising the distance of each record to its group centroid. It scales linearly with records, works well on L2-normalised TF-IDF vectors (where Euclidean distance behaves like cosine distance), and its centroids are directly interpretable as term weights, which is how topics get named. k is user-adjustable, with elbow and silhouette charts to guide the choice."],
  ["How are clusters converted into topics?", "Each centroid's top-weighted terms are scored against a transparent lexicon of marketing topic labels (e.g. AI & Technology, Product Promotion). The best unused label is assigned when it explains at least 10% of the centroid's top-term weight; otherwise the name is built from the cluster's own top terms. The UI shows the top terms, the match score and the method for every topic."],
  ["How is engagement calculated?", "Engagement rate = (likes + comments + shares) ÷ views × 100. If views are missing for most records the platform falls back to weighted interactions = likes + 2×comments + 3×shares, and says so on every page."],
  ["How are market trends incorporated?", "An authorised market dataset (topic, keyword, date, trend_score…) is aggregated into a weekly 0–100 interest series per topic. Current level, 12-week growth, year-over-year change and 8-week momentum are calculated and each topic is classified Emerging / Growing / Stable / Declining. Your coverage of each topic is measured by literal phrase matching of its keywords in your content."],
  ["How does opportunity detection work?", "Score = 100 × (0.40 × Momentum + 0.35 × Gap + 0.25 × Engagement potential). Momentum combines market strength and growth; Gap compares the market's attention share with your share of voice; Engagement potential compares how related content performs against your average. Every component and its contribution is shown in the 'Why this score?' breakdown."],
  ["Is the prediction guaranteed?", "No. Forecasts use Holt's damped-trend exponential smoothing on past weekly values only, with an 80% range and a back-test error. They estimate the direction a trend may continue in if the historical pattern holds. External events can change interest at any time, and topics with under 26 weeks of history are not forecast at all."],
];

const SECTIONS: { id: string; title: string; tag?: "core" | "ext"; body: React.ReactNode }[] = [
  { id: "problem", title: "Problem Statement", body: <p>Marketing teams accumulate large volumes of published content across platforms but lack a simple way to understand which topics they cover, which keywords matter, which content earns engagement, and where their coverage lags behind changing market interest. Manual review does not scale beyond a few hundred posts.</p> },
  { id: "objectives", title: "Objectives", body: <ul className="list-disc space-y-1 pl-5"><li>Mine authorised content to discover topics, keywords, categories and content frequency.</li><li>Measure user engagement and identify what performs best.</li><li>Group similar content automatically with clustering.</li><li>Track how the content mix changes over time.</li><li>Compare content with market trends to detect gaps and rank potential opportunities transparently.</li></ul> },
  { id: "wcm", title: "Web Content Mining", tag: "core", body: <p>Web mining has three branches: <b>content</b> mining (the text and media of pages), <b>structure</b> mining (hyperlinks) and <b>usage</b> mining (logs). This project is web content mining: it extracts structured knowledge (topics, keywords, groups, engagement patterns) from unstructured post and article text.</p> },
  { id: "collection", title: "Data Collection", tag: "core", body: <p>Data is supplied as CSV exports the user is authorised to use (e.g. their own platform analytics). A 1,878-record synthetic demo dataset (10 categories, 7 platforms, Oct 2024 – Sep 2026) with deliberately injected dirty rows is bundled. No scraping, authentication bypass or rate-limit circumvention is performed.</p> },
  { id: "cleaning", title: "Data Cleaning", tag: "core", body: <p>Records with blank content are removed; exact duplicates (same text, platform and date) are removed; likes/comments/shares/views are coerced to numbers (invalid or negative values are counted, interactions treated as 0 and views left missing); dates are parsed (invalid dates are kept for text analysis but excluded from trends); missing platform/category/title receive explicit defaults. Every decision is counted and shown on the Data & Processing page.</p> },
  { id: "preprocessing", title: "Text Preprocessing", tag: "core", body: <p>HTML, URLs, e-mail addresses and @mentions are stripped; hashtags are split into words; text is lowercased; punctuation and digits are removed; English and domain stop words are removed; words shorter than 3 letters are dropped (except whitelisted terms such as “ai”, “seo”); plurals are normalised with conservative rules. Records left with fewer than 2 meaningful tokens are excluded.</p> },
  { id: "features", title: "Feature Extraction", tag: "core", body: <p>Each record becomes a vector over a vocabulary of single words and two-word phrases. The resulting document-term matrix is very sparse (typically &gt; 98% zeros), so sparse matrix operations are used throughout.</p> },
  { id: "tfidf", title: "TF-IDF", tag: "core", body: <><p className="rounded-lg bg-subtle p-3 font-mono text-[12.5px]">tf-idf(t, d) = (1 + ln tf(t, d)) × (ln((1 + N) / (1 + df(t))) + 1), rows L2-normalised</p><p className="mt-2">tf = count of term t in record d; df = number of records containing t; N = number of records. A term that appears everywhere gets a low idf; a term concentrated in few records gets a high idf.</p></> },
  { id: "clustering", title: "Clustering", tag: "core", body: <p>Clustering is unsupervised learning: no labels are needed. Records with similar TF-IDF vectors (similar vocabulary) are placed in the same group. For visualisation, vectors are projected to 2-D with Truncated SVD (the sparse-matrix equivalent of PCA).</p> },
  { id: "kmeans", title: "K-Means", tag: "core", body: <><p>1) choose k initial centroids with k-means++; 2) assign each record to its nearest centroid; 3) move each centroid to the mean of its records; 4) repeat until assignments stop changing. The objective is to minimise inertia, the within-cluster sum of squared distances. 10 random restarts are run and the best kept (random_state = 42 for reproducibility).</p><p className="mt-2">k defaults to 5 and can be changed (2–12). The Topic Mining page provides the elbow curve and silhouette score for k = 2–10.</p></> },
  { id: "topics", title: "Topic / Content Groups", tag: "core", body: <p>Each cluster centroid is a weight vector over terms; its highest weights are the cluster's top keywords. These are scored against a lexicon of 12 marketing topic labels and the best unused label is assigned greedily. If no label explains ≥ 10% of the top-term weight, the name is generated from the top two terms. The label method, score and top terms are always displayed, so labels can be audited.</p> },
  { id: "keywords", title: "Keyword Analysis", tag: "core", body: <p><b>Frequency</b> counts occurrences of each cleaned term. <b>Importance</b> = average TF-IDF weight in the records that use the term × ln(1 + number of those records), with a minimum-support threshold. N-grams (bigrams, trigrams) capture phrases. <b>Lift</b> compares a term's weight in the filtered selection with the full dataset.</p> },
  { id: "engagement", title: "Engagement Analysis", tag: "core", body: <p className="rounded-lg bg-subtle p-3 font-mono text-[12.5px]">Engagement rate = (likes + comments + shares) / views × 100 &nbsp;·&nbsp; fallback: likes + 2×comments + 3×shares</p> },
  { id: "trends", title: "Trend Analysis", tag: "core", body: <p>For the brand&apos;s own content, the selected period is split at its midpoint and the second half is compared with the first: change &gt; +10% is Increasing, &lt; −10% Decreasing, otherwise Stable. Emerging keywords compare the share of records using a term in the latest third of the period with the earlier two-thirds.</p> },
  { id: "market", title: "Market Comparison", tag: "ext", body: <p>Market rows are averaged per topic per week. Current level = mean of the last 4 weeks; growth = vs the 4-week mean 12 weeks earlier; YoY = vs 52 weeks earlier; momentum = slope of a linear fit to the last 8 weeks. Status: Emerging (YoY ≥ 80% and still growing, or &lt; 26 weeks of history with growth), Growing (≥ +8%), Declining (≤ −8%), otherwise Stable. Coverage = records whose text contains the topic name or one of its tracked keywords.</p> },
  { id: "opportunity", title: "Opportunity Detection", tag: "ext", body: <><p className="rounded-lg bg-subtle p-3 font-mono text-[12.5px]">Score = 100 × (0.40 × Momentum + 0.35 × Gap + 0.25 × Engagement)</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>Momentum = 0.5 × strength/100 + 0.5 × clip((growth% + 50)/100)</li><li>Gap = clip((market attention share − your share of voice) / market attention share)</li><li>Engagement = clip(related engagement ÷ dataset average ÷ 2); similar records by TF-IDF cosine are used when fewer than 5 records mention the topic</li></ul><p className="mt-2">Bands: ≥ 70 Strong, 55–70 Moderate, 40–55 Worth monitoring, &lt; 40 Low priority. A content gap is a topic where market interest is high and your coverage is relatively low.</p></> },
  { id: "forecasting", title: "Forecasting", tag: "ext", body: <p>Holt&apos;s linear exponential smoothing with a damped trend (φ = 0.9) is fitted to each weekly market series; α and β are chosen by grid search on one-step-ahead error. The next 8 weeks are projected with an approximate 80% range that widens with the horizon. An 8-week hold-out back-test reports MAPE. Series with fewer than 26 weeks return “Insufficient history for reliable forecasting.” Forecasts are estimates, never guarantees.</p> },
  { id: "limitations", title: "Limitations", body: <ul className="list-disc space-y-1 pl-5"><li>TF-IDF is a bag-of-words model: it ignores word order, sarcasm and synonyms.</li><li>K-Means assumes roughly spherical, similarly sized clusters and needs k in advance; short texts give modest silhouette scores.</li><li>Topic labels come from a fixed lexicon; unusual domains fall back to term-based names.</li><li>Coverage uses literal phrase matching; paraphrases are only captured through the similarity fallback.</li><li>Engagement is correlational: a topic&apos;s higher engagement does not prove causation.</li><li>The bundled datasets are synthetic; conclusions about real markets require real, authorised data.</li></ul> },
  { id: "future", title: "Future Scope", body: <ul className="list-disc space-y-1 pl-5"><li>Approved data sources: Google Trends, platform APIs, news APIs, scheduled ingestion.</li><li>Semantic embeddings (sentence-transformers) and alternative algorithms (HDBSCAN, NMF/LDA topic models).</li><li>Seasonal forecasting models (SARIMA, Prophet) and anomaly alerts.</li><li>PostgreSQL, multi-brand workspaces, authentication and role-based access.</li><li>Competitor benchmarking and automated PDF reports.</li></ul> },
];

export default function Methodology() {
  const { status } = useAppStatus();
  const p = status?.pipeline;
  return (
    <>
      <PageHeader
        title="Methodology"
        question="How does the system work academically and technically?"
        description="The Web Content Mining pipeline behind ContentSense, from raw content to business insight, and the advanced market-intelligence extension."
      />

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-ink">End-to-end pipeline</h2>
        <ol className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          {PIPELINE.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={s.core ? "rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-[12.5px] font-medium text-primary-ink" : "rounded-lg border border-[#eb6834]/40 bg-[#fdf0ea] px-3 py-2 text-[12.5px] font-medium text-[#9a3d14]"}>
                {s.label}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-ink-3 md:inline" aria-hidden>→</span>}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-soft ring-1 ring-primary/40" /> Core Web Content Mining</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#fdf0ea] ring-1 ring-[#eb6834]/50" /> Advanced industry extension</span>
          {p && <span>Latest run: {fmtInt(p.cleaning.records_received)} records → {fmtInt(p.cleaning.records_cleaned)} cleaned → {fmtInt(p.features.features_extracted)} features → {p.clustering.clusters_generated} topics</span>}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-ink">Core Web Content Mining concepts</h3>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CORE.map((c) => <li key={c} className="flex items-center gap-2 text-[13px] text-ink-2"><Check className="h-4 w-4 text-good-ink" />{c}</li>)}
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-ink">Advanced industry extension</h3>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ADVANCED.map((c) => <li key={c} className="flex items-center gap-2 text-[13px] text-ink-2"><Check className="h-4 w-4 text-good-ink" />{c}</li>)}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Methodology sections" className="hidden lg:block">
          <ul className="sticky top-6 space-y-0.5 text-[12.5px]">
            {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} className="block rounded px-2 py-1 text-ink-3 hover:bg-subtle hover:text-ink">{s.title}</a></li>)}
            <li><a href="#viva" className="block rounded px-2 py-1 text-ink-3 hover:bg-subtle hover:text-ink">Viva questions</a></li>
            <li><a href="#ethics" className="block rounded px-2 py-1 text-ink-3 hover:bg-subtle hover:text-ink">Data usage & ethics</a></li>
          </ul>
        </nav>
        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <Card key={s.id} id={s.id} className="scroll-mt-6 p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-ink">{s.title}</h3>
                {s.tag === "core" && <Badge tone="primary">Core</Badge>}
                {s.tag === "ext" && <Badge tone="warn">Extension</Badge>}
              </div>
              <div className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.body}</div>
            </Card>
          ))}

          <Card id="viva" className="scroll-mt-6 p-5">
            <h3 className="text-[15px] font-semibold text-ink">Viva questions</h3>
            <div className="mt-3 divide-y divide-border">
              {VIVA.map(([q, a]) => (
                <details key={q} className="group py-2.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium text-ink">
                    {q}<ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{a}</p>
                </details>
              ))}
            </div>
          </Card>

          <Card id="ethics" className="scroll-mt-6 border-good/30 p-5">
            <h3 className="text-[15px] font-semibold text-ink">Data usage & ethics</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
              ContentSense analyses only authorised datasets: content the user owns or is permitted to use, public/permitted content, and data from approved APIs.
              It does not implement scraping, authentication bypass, rate-limit bypass, robots.txt circumvention or extraction of private data.
              Personal data should be removed or pseudonymised before upload. The bundled demo datasets are synthetic and clearly labelled as sample data.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
