# ContentSense

**Content & Market Intelligence Platform**
*Understand your content. Detect market trends. Discover your next opportunity.*

Academic industry project: **Social Media / Web Content Mining** (industry: Digital Marketing, primary concept: Web Content Mining).

ContentSense is a working B2B-style analytics application. A marketing team uploads its authorised content export, and a real processing pipeline (cleaning, TF-IDF, K-Means, topic labelling, engagement analytics, trend analysis, market comparison and forecasting) turns it into structured intelligence. Every number in the UI is computed from the loaded datasets. Nothing is hard-coded.

---

## Contents

1. [Business problem](#1-business-problem)
2. [Features](#2-features)
3. [Project structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Technology stack](#5-technology-stack)
6. [Installation and running](#6-installation-and-running)
7. [Demo workflow](#7-demo-workflow)
8. [Dataset format and sample data](#8-dataset-format-and-sample-data)
9. [Web Content Mining workflow](#9-web-content-mining-workflow)
10. [Market Trends & Opportunity methodology](#10-market-trends--opportunity-methodology)
11. [API documentation](#11-api-documentation)
12. [Syllabus mapping](#12-syllabus-mapping)
13. [Testing](#13-testing)
14. [Customisation guide](#14-customisation-guide)
15. [Limitations and future scope](#15-limitations-and-future-scope)
16. [Data usage and ethics](#16-data-usage-and-ethics)

Presentation script, viva Q&A and the full test-case table are in [`docs/PRESENTATION_AND_VIVA.md`](docs/PRESENTATION_AND_VIVA.md) and [`docs/TEST_CASES.md`](docs/TEST_CASES.md).

---

## 1. Business problem

Marketing teams often have large volumes of content data but lack a simple way to understand recurring topics, keywords, engagement patterns, and gaps relative to changing market trends. **ContentSense converts that raw content into structured intelligence.**

It answers eight questions for social media managers, content strategists, brand managers, agencies and marketing analysts:

| # | Question | Where it is answered |
|---|---|---|
| 1 | What content are we publishing? | Content Explorer |
| 2 | What topics are we covering? | Topic Mining |
| 3 | Which keywords are important? | Keyword Intelligence |
| 4 | What content performs best? | Engagement Insights |
| 5 | Which topics generate engagement? | Engagement Insights, Topic Mining |
| 6 | What is changing in the market? | Market Trends & Opportunities |
| 7 | Which market topics are we under-covering? | Market Trends & Opportunities (gap detection) |
| 8 | Which topics may be content opportunities? | Market Trends & Opportunities (opportunity score) |

## 2. Features

Ten pages, each answering one primary question:

| Page | Primary question | What it does |
|---|---|---|
| **Home / Overview** | What is happening overall? | 5 clickable KPI cards, topic distribution, engagement by topic, volume over time, top market opportunity, 4 auto-generated insights, links to deeper pages |
| **Content Explorer** | What content do we have? | Keyword search, filters (topic, category, platform, date, engagement), sortable paginated table, detail drawer (full text, extracted keywords, cluster, likes/comments/shares/views, engagement rate with formula, URL), filtered CSV export |
| **Topic Mining** | What are we talking about? | TF-IDF + K-Means (default k = 5, adjustable 2 to 12), generated topic names with the reason for each name, top keywords, representative records, engagement per topic, 2-D cluster map (Truncated SVD) with hover, elbow + silhouette charts, topic CSV export |
| **Keyword Intelligence** | What terms and themes matter? | Frequency vs TF-IDF importance side by side, "frequent but not informative" callout, bigrams/trigrams, keywords by topic and by category, detail table with lift and ranks, filters |
| **Engagement Insights** | What content performs well? | Engagement rate formula, highest-engagement topic/category/content, breakdown by topic/category/platform, distribution, trend over time, top content, generated insights |
| **Content Trends** | How is our content changing? | Volume by day/week/month, topic growth over time, ↑/→/↓ indicators computed from data, category share changes, emerging and fading keywords, volume vs engagement insight |
| **Market Trends & Opportunities** | What is happening in the market, and where might we have an opportunity? | Trending now, momentum per topic, restrained forecast with back-test, your content vs market table, content-gap detection, transparent 0 to 100 opportunity score with "Why this score?" breakdown, opportunity cards with "Explore topic", CSV export |
| **Data & Processing** | How did the mining pipeline process the data? | Pipeline diagram with live counts, upload content CSV, upload market CSV, load demo, run analysis, reset, validation preview, processing statistics, advanced section (stage timings, parameters, preprocessing example) |
| **Methodology** | How does the system work? | Full academic write-up, core vs extension labelling, syllabus checklist, viva Q&A, ethics note |
| **Settings / About** | What is ContentSense? | Positioning, connection status, customisation map, stack, ethics |

Also: loading, empty, error and "backend unavailable" states on every page; URL-based filters (linkable views); responsive layout (desktop, tablet, mobile); colour-blind-aware palette (validated order + marker shapes + labels, never colour alone).

## 3. Project structure

```
content-sense/
├── backend/
│   ├── app/
│   │   ├── main.py                 FastAPI app, CORS, error handlers, startup restore
│   │   ├── config.py               every tunable parameter in one place
│   │   ├── core/state.py           pipeline orchestration + in-memory cache
│   │   ├── db/database.py          SQLAlchemy persistence (SQLite, PostgreSQL-ready)
│   │   ├── routes/                 data, content, topics, analytics, trends (+ deps)
│   │   ├── processing/
│   │   │   ├── ingestion.py        CSV reading, column aliases, validation
│   │   │   ├── cleaning.py         record cleaning + text preprocessing
│   │   │   ├── features.py         TF-IDF
│   │   │   ├── clustering.py       K-Means, silhouette, SVD projection, k evaluation
│   │   │   ├── topics.py           cluster -> topic naming
│   │   │   ├── trends.py           content trends + market trend metrics
│   │   │   └── forecasting.py      Holt damped-trend forecasting + back-test
│   │   ├── analytics/
│   │   │   ├── engagement.py       engagement rate / fallback, aggregations
│   │   │   ├── keywords.py         frequency vs importance, n-grams
│   │   │   ├── opportunities.py    coverage, gap, opportunity score
│   │   │   └── insights.py         rule-based insight engine
│   │   ├── models/schemas.py       Pydantic request/response models
│   │   └── utils/                  text preprocessing, filters, serialisation
│   ├── tests/                      34 pytest tests (unit + API end to end)
│   ├── requirements.txt / requirements-dev.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                        one folder per page (Next.js App Router)
│   ├── components/                 layout, ui primitives, charts, filter bar, pipeline actions
│   ├── hooks/                      useApi, useUrlFilters
│   ├── lib/                        api client, types, formatting, chart colours
│   └── Dockerfile
├── data/
│   ├── generate_sample_data.py     reproducible demo data generator (seed 42)
│   ├── sample_content.csv          1,878 content records
│   └── sample_market_trends.csv    2,924 weekly market rows, 12 topics
├── docs/                           presentation script, viva Q&A, test cases
├── docker-compose.yml
└── .gitignore
```

## 4. Architecture

```
 Browser (Next.js, React, Recharts)
        │  JSON over HTTP (CORS: localhost:3000)
        ▼
 FastAPI routes ──► core/state.py (AppState: pipeline orchestration, per-run cache)
                        │
   ┌────────────────────┼──────────────────────────────┐
   ▼                    ▼                              ▼
 processing/         analytics/                     db/database.py
 ingestion           engagement                     SQLAlchemy
 cleaning            keywords                       SQLite (default)
 features (TF-IDF)   opportunities                  PostgreSQL via DATABASE_URL
 clustering (KMeans) insights
 topics, trends, forecasting
```

* **One run, many views.** `POST /api/analysis/run` executes the whole pipeline once (about 1.5 s for the 1,878-record demo). Results live in memory; filtered views (keywords, engagement, trends, content search) are computed on request from the cached matrices and memoised per run.
* **Persistence.** Raw datasets, the processed records (topic, cluster, keywords, engagement) and app state are stored in SQLite. On restart the backend restores the datasets and re-runs the pipeline with the stored k.
* **Source-agnostic market layer.** Market data enters through one validated schema (`topic, keyword, date, trend_score, ...`). A future Google Trends or approved-API connector only needs to produce that DataFrame.
* **Demo mode.** On first start the backend auto-loads the demo datasets (`AUTO_LOAD_DEMO=true`), so the app works offline with no API keys.

## 5. Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn-style components on Radix UI (Dialog, Tooltip), Recharts, lucide icons |
| Backend | Python 3.11, FastAPI, Pydantic v2, Uvicorn |
| Data / ML | pandas, NumPy, scikit-learn (TfidfVectorizer, KMeans, TruncatedSVD, silhouette_score, CountVectorizer), SciPy (linear regression) |
| Storage | SQLAlchemy 2 + SQLite (PostgreSQL-ready) |
| Tooling | pytest + FastAPI TestClient, Playwright (UI verification), Docker Compose |

No heavy NLP downloads are required: stop words come from scikit-learn plus a domain list, and lemmatisation is a small rule-based function.

## 6. Installation and running

### Option A: Docker (recommended)

```bash
cd content-sense
docker compose up --build
```

* Frontend: http://localhost:3000
* Backend: http://localhost:8000 (interactive API docs at http://localhost:8000/docs)

The demo datasets load automatically. Data persists in the `contentsense-data` volume; `docker compose down -v` wipes it.

### Option B: Manual setup

Requirements: Python 3.9+ (3.11 recommended) and Node.js 18.18+ (20 LTS recommended).

**Backend**

```bash
cd content-sense/backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (second terminal)

```bash
cd content-sense/frontend
npm install
npm run dev                          # http://localhost:3000
# production: npm run build && npm start
```

If the backend runs elsewhere, set `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`) and add the frontend origin to the backend's `CORS_ORIGINS`.

**Regenerate the demo data (optional)**

```bash
python data/generate_sample_data.py
```

**Run the tests**

```bash
cd backend && pytest -q              # 34 tests
cd frontend && npm run typecheck && npm run build
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///backend/contentsense.db` | Any SQLAlchemy URL (e.g. PostgreSQL) |
| `DATA_DIR` | `data/` | Location of the sample CSVs |
| `AUTO_LOAD_DEMO` | `true` | Load demo data on first start |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed browser origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API URL used by the browser (build time) |

## 7. Demo workflow

1. **Home.** Show the overview: 1,839 records, 5 topics, 3.42% average engagement rate, top topic, 5 market opportunities, 4 generated insights.
2. **Data & Processing.** Click *Reset demo* (optional), then *Load Demo Data*. The button shows each real pipeline stage.
3. **Run analysis.** Point at the pipeline diagram and the statistics: 1,878 received, 28 duplicates removed, 11 empty records removed, 9 invalid numbers, 4 invalid dates, 4,000 TF-IDF features, 5 clusters. Open *Advanced* to show a before/after preprocessing example and stage timings.
4. **Topic Mining.** Explain the five content groups, their generated names (e.g. *AI & Technology*, *Promotions & Travel* flagged as a mixed topic), top keywords, representative content and the cluster map. Change k to 6 or 8 and click *Evaluate k* to show elbow + silhouette.
5. **Keyword Intelligence.** Contrast *Frequency* ("ai", "customer", "marketing", "brand"...) with *Importance* ("travel", "sustainability", "ai", "money"...). Read the "frequent but not very informative" callout.
6. **Engagement Insights.** AI & Technology is the highest-engagement topic (+25% vs average); the promotional group (*Promotions & Travel*) is the weakest; TikTok leads by platform and Blog trails.
7. **Content Trends.** AI & Technology content grew about 114% between the halves of the period; content volume +21% while engagement stayed flat; emerging keywords include "machine learning", "generative ai", "agent".
8. **Market Trends & Opportunities.** *Trending now* (AI Search Optimization, Social Commerce, AI Agents, Personalized Marketing). Select AI Agents to show its history, +620% year over year, and the damped forecast with its back-test error. Select AI Search Optimization to show *"Insufficient history for reliable forecasting."*
9. **Compare "Our content" vs "Market".** SEO, Marketing Automation and Influencer Marketing are well covered (High) and low priority; AI Agents and Social Commerce have high market interest and low coverage.
10. **Show the opportunity.** *AI Agents: Strong Opportunity, about 79/100.* Click *Why this score?*: high market momentum + low current coverage (3% share of voice vs 12% market attention) + related content earning about 1.9x the average engagement. Click *Explore topic* to see the 13 records that mention it.
11. **Return to Home** to show the dashboard summarises all of the above.

## 8. Dataset format and sample data

### Content dataset (CSV)

| Column | Status | Notes |
|---|---|---|
| `content` | **Required** | Post/article text. Aliases accepted: text, body, message, post, caption, description |
| `date` | Recommended | Any common date format. Without it, trends are disabled with a message |
| `id` | Optional | Generated if missing; duplicates are suffixed |
| `platform`, `title`, `category`, `author`, `url` | Optional | Defaults: Unknown / first 70 characters / Uncategorized |
| `likes`, `comments`, `shares` | Optional | Invalid values are counted and treated as 0 |
| `views` | Optional | Needed for the engagement rate; otherwise the weighted-interactions fallback is used |

Validation errors are human readable, e.g. *"Missing required column 'content' (the text of each post/article). Columns found: id, likes. Rename your text column to 'content' or one of: text, body, message, caption."*

### Market trend dataset (CSV)

| Column | Status | Notes |
|---|---|---|
| `topic`, `date`, `trend_score` | **Required** | `trend_score` is a 0 to 100 interest index (rescaled automatically if outside) |
| `keyword` | Optional | Tracked phrases used to measure your coverage; defaults to the topic name |
| `volume`, `growth_rate`, `source`, `category` | Optional | Informational |

### Bundled sample data (synthetic, seed 42)

* **sample_content.csv:** 1,878 records, Oct 2024 to Sep 2026, 7 platforms (LinkedIn, Instagram, X, Facebook, TikTok, YouTube, Blog), 10 categories (Technology, Artificial Intelligence, Marketing, Finance, Fitness, Travel, Education, Entertainment, Sustainability, Business). Posts are built from ten overlapping latent themes with noisy category assignment, cross-theme sentences, variable length and platform-dependent engagement. AI content grows over time and promotional content shrinks. Deliberately dirty rows: 28 duplicates, 11 blank texts, 9 invalid numbers, 4 bad dates, 25 missing views, 30 missing categories.
* **sample_market_trends.csv:** 12 topics x 2 to 3 keywords, weekly, 0 to 100 index with autocorrelated noise and seasonality. Shapes differ on purpose: AI Agents (S-curve, emerging), Generative AI (rise then plateau), Social Commerce (accelerating), SEO (gradual decline), Metaverse Marketing (sharp decline), Short-Form Video and Marketing Automation (stable), and AI Search Optimization with only 6 weeks of history (to demonstrate the forecasting refusal). Labelled "Sample / demo data" in the UI.

## 9. Web Content Mining workflow

```
Web Content ─► Data Cleaning ─► Feature Extraction ─► Clustering ─► Topic Groups ─► Analytics ─► Business Insights
                                                                                        │
                                          Market Trend Analysis ◄───────────────────────┘
                                                    ▼
                                            Trend Comparison ─► Opportunity Detection
```

### 9.1 Data cleaning
Record level: remove blank content; remove duplicates (same normalised text + platform + date); coerce numbers (invalid or negative values counted; interactions set to 0, views left missing); parse dates (invalid kept for text, excluded from trends); defaults for missing platform, category, title, author; ids generated if missing.

### 9.2 Text preprocessing
Strip HTML, URLs, e-mails and @mentions; split hashtags (`#ContentStrategy` becomes "content strategy"); lowercase; remove punctuation and digits; remove English + domain stop words; drop tokens under 3 letters (whitelist: ai, seo, ugc, sql, ...); conservative plural normalisation (strategies to strategy, brands to brand, business unchanged). Records with fewer than 2 meaningful tokens are excluded.

### 9.3 TF-IDF feature extraction
```
tf-idf(t, d) = (1 + ln tf(t, d)) × (ln((1 + N) / (1 + df(t))) + 1),   rows L2-normalised
```
Unigrams + bigrams, `min_df = 2`, `max_df = 0.5`, `max_features = 4000`. TF-IDF is used because raw counts over-reward words that appear everywhere; TF-IDF weights terms that are frequent in a record but rare across the collection, which is what separates one kind of content from another. It is fast, interpretable and needs no training data.

### 9.4 K-Means clustering
k-means++ initialisation, 10 restarts, `random_state = 42`. Because rows are L2-normalised, Euclidean distance behaves like cosine distance. K-Means is used because it scales linearly, suits sparse TF-IDF vectors, and its centroids are term-weight vectors that can be read directly, which is how topics are named. k defaults to 5 and is adjustable; the elbow (inertia) and cosine silhouette for k = 2 to 10 guide the choice. The cluster map uses Truncated SVD (the sparse-matrix equivalent of PCA).

### 9.5 Clusters to topics
1. Take each centroid's top 40 terms (highest weights).
2. Score each of 12 lexicon labels (AI & Technology, Marketing Strategy, Product Promotion, Customer Engagement, Fitness & Wellness, Travel & Lifestyle, Personal Finance, Sustainability, Education & Learning, Entertainment & Media, Social Video & Creators, Business & Leadership) = share of top-term weight explained by the label's seed words.
3. Assign labels greedily, highest score first, each label once.
4. If a second label scores at least 40% of the first, the cluster is **mixed** and gets a compound name (e.g. *Promotions & Travel*).
5. If no label explains at least 10%, the name is built from the cluster's top terms.

The UI always shows the method, the match score and the top terms so labels can be audited.

### 9.6 Keyword analysis
* **Frequency** = occurrences of the cleaned term.
* **Importance** = mean TF-IDF weight in the records that use the term × ln(1 + records using it), minimum support max(3, 1%) of records.
* **Lift** = mean TF-IDF in the filtered selection ÷ mean in the full dataset.
* **N-grams** are counted on the original text with stop words kept, discarding phrases that start/end with a stop word or cross punctuation, so phrases read naturally ("machine learning", "keyword research").

### 9.7 Engagement formula
```
Engagement Rate (%) = (likes + comments + shares) / views × 100
Fallback when views are missing for most records:
Weighted interactions = 1 × likes + 2 × comments + 3 × shares
```
Records with fewer than 10 views are excluded from rate averages (and counted). The active formula is shown on every engagement view.

### 9.8 Content trends
The selected period is split at its midpoint. `change % = (records in 2nd half − records in 1st half) / records in 1st half × 100`; above +10% is ↑ Increasing, below −10% is ↓ Decreasing, otherwise → Stable. Periods shorter than 4 weeks (or with fewer than 5 records per half) show a "select a longer period" message. Emerging keywords compare the share of records using a term in the most recent third of the period with the earlier two thirds.

## 10. Market Trends & Opportunity methodology

### 10.1 Market trend metrics (per topic, weekly)
| Metric | Definition |
|---|---|
| Current level | Mean trend_score of the last 4 weeks (keywords averaged per topic) |
| Growth (12 weeks) | Current level vs the 4-week mean ending 12 weeks earlier |
| Year over year | Current level vs the 4-week mean 52 weeks earlier |
| Momentum | Slope of a linear fit over the last 8 weeks, as % of the mean per week |
| Strength | ≥ 70 Very High, ≥ 50 High, ≥ 30 Moderate, else Low |

**Status:** *Emerging* if YoY ≥ 80% with positive growth and level ≥ 25, or history under 26 weeks with growth > 8%; *Growing* if growth ≥ +8%; *Declining* if ≤ −8%; otherwise *Stable*.

### 10.2 Your content vs market
A record **covers** a market topic if its text contains the topic name or one of its tracked keywords as a whole phrase (transparent literal match).
```
Share of voice (yours) = records covering T / records covering any market topic
Market attention       = current_score(T) / Σ current_score of all topics
Coverage gap           = clip((attention − share of voice) / attention, 0, 1)
```
Coverage level: ratio share-of-voice / attention < 0.5 Low, < 1.0 Moderate, else High.

### 10.3 Opportunity Score
```
Opportunity Score = 100 × (0.40 × Momentum + 0.35 × Gap + 0.25 × Engagement Potential)

Momentum             = 0.5 × (current_score / 100) + 0.5 × clip((growth% + 50) / 100, 0, 1)
Gap                  = coverage gap (above)
Engagement Potential = clip(engagement_index / 2, 0, 1)
engagement_index     = avg engagement of related records / dataset average
                       related = records covering the topic (≥ 5), otherwise the 20 most
                       similar records by TF-IDF cosine similarity, otherwise neutral 0.5
```
Bands: **≥ 70 Strong Opportunity**, 55 to 70 Moderate, 40 to 55 Worth Monitoring, < 40 Low Priority. Weights and bands live in `backend/app/config.py`. The *Why this score?* dialog shows each component, its weight, its contribution in points, the matched phrases and the engagement basis.

Demo result: AI Agents scores about 79 (Strong): momentum 0.72 (score 82, +12%), gap 0.75 (3.0% share of voice vs 12.2% attention), engagement potential 0.95 (related records at 1.9x average). SEO scores about 31 (Low): well covered and flat to declining.

Recommendations use careful language ("potential opportunity", "consider exploring", "worth monitoring"), never "you must post this".

### 10.4 Forecasting
Holt's linear exponential smoothing with a **damped trend** (φ = 0.9), α and β chosen by grid search on one-step-ahead squared error, 8-week horizon, approximate 80% range widening with √h, and an 8-week hold-out back-test reporting MAPE (reliability Higher < 10%, Moderate < 20%, else Lower). Series with fewer than 26 weeks return **"Insufficient history for reliable forecasting."** Output is labelled "Projected trend direction" / "Expected momentum" / "Based on historical pattern" and carries a disclaimer: it is an estimate, not a guaranteed outcome.

## 11. API documentation

Interactive OpenAPI docs: http://localhost:8000/docs. Filter parameters shared by content, keywords, engagement and trends: `q, topic, category, platform, start, end, min_engagement, max_engagement`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/status` | Datasets, validation, pipeline statistics, engagement mode |
| POST | `/api/data/upload` | Upload content CSV (validated, returns preview; not yet analysed) |
| GET | `/api/data/preview` | First raw rows of the content dataset |
| POST | `/api/data/load-demo` | Load demo content + market data and run the analysis |
| POST | `/api/data/reset` | Clear all data and results |
| GET | `/api/data/sample/{content\|market}` | Download a sample CSV template |
| POST | `/api/market-data/upload` | Upload market trend CSV (re-runs the analysis) |
| GET | `/api/market-data/preview` | First market rows |
| POST | `/api/analysis/run` | Body `{"n_clusters": 5}`; runs the full pipeline |
| GET | `/api/analysis/pipeline` | Stage statistics and timings of the latest run |
| GET | `/api/overview` | Home dashboard payload |
| GET | `/api/meta` | Filter options, date bounds, engagement quantiles |
| GET | `/api/content` | Search/filter/sort/paginate (`sort`, `order`, `page`, `page_size`) |
| GET | `/api/content/{id}` | Record detail with keywords, cluster, engagement breakdown |
| GET | `/api/content/export` | Filtered records as CSV |
| GET | `/api/topics` | Topics with labels, terms, representatives, clustering metrics |
| GET | `/api/topics/scatter` | 2-D SVD projection points |
| GET | `/api/topics/evaluate-k` | Inertia + silhouette for k = 2..10 |
| GET | `/api/topics/export` | Topic summary CSV |
| GET | `/api/keywords` | Frequency, importance, n-grams, by topic/category, detail table |
| GET | `/api/engagement` | Engagement summary (`granularity=day\|week\|month`) |
| GET | `/api/trends/content` | Content trends (`granularity`) |
| GET | `/api/trends/market` | Market topic metrics, trending now, method |
| GET | `/api/trends/market/{topic}` | History, forecast, opportunity for one topic |
| GET | `/api/opportunities` | Ranked opportunities with score breakdowns |
| GET | `/api/opportunities/export` | Opportunity summary CSV |
| GET | `/api/insights` | Generated insights |

Errors return `{"detail": "...", "code": "..."}` with codes `invalid_data` (422), `insufficient_data` (422), `no_data` / `not_analyzed` (409), `server_error` (500). The frontend maps each code to a helpful state (e.g. "Go to Data & Processing").

## 12. Syllabus mapping

| Requirement | Implementation |
|---|---|
| ✓ Web Content Mining | Whole pipeline mines post/article text (`processing/`), explained on Methodology |
| ✓ Topics | K-Means clusters named in `processing/topics.py`; Topic Mining page |
| ✓ Keywords | `analytics/keywords.py`; Keyword Intelligence; per-record keywords in the Content Explorer drawer |
| ✓ Categories | Category filters everywhere; engagement and keywords by category; category share trends |
| ✓ Content frequency | Volume over time (Home, Content Trends), topic sizes, term frequency |
| ✓ User engagement | `analytics/engagement.py`; Engagement Insights |
| ✓ Data cleaning | `processing/cleaning.py`; statistics on Data & Processing |
| ✓ Feature extraction | `processing/features.py` (TF-IDF); feature counts and sparsity |
| ✓ Clustering | `processing/clustering.py` (K-Means, silhouette, elbow, SVD map) |
| ✓ Topic / content groups | Topic cards with representative content and engagement |
| ✓ Market trend analysis *(extension)* | `processing/trends.py` market metrics and status |
| ✓ Trend comparison *(extension)* | Your content vs market table |
| ✓ Content gap detection *(extension)* | Gap component, coverage levels (`analytics/opportunities.py`) |
| ✓ Opportunity scoring *(extension)* | Weighted 0 to 100 score with breakdown |
| ✓ Trend forecasting *(extension)* | `processing/forecasting.py` with back-test and refusal on short history |

## 13. Testing

What was verified for this release:

* **Backend:** `pytest` runs 34 tests: ingestion errors, column aliases, cleaning counts, preprocessing, TF-IDF normalisation, K-Means + unique non-generic topic names, not-enough-records error, engagement formula and fallback, trend thresholds, market classification, forecast refusal and accuracy, opportunity ranking and bounds (score = sum of contributions), API flows (load demo, overview, search/filter/sort/detail, export, topics, re-run with k = 7, invalid k, keywords with filters, engagement, content trends incl. short range, market + forecast, opportunities, CSV upload + run, invalid uploads, reset).
* **Frontend:** TypeScript check and `next build` pass (all 10 pages prerender).
* **UI (Playwright, against the running app):** every page renders with no console errors at 1440, 1024, 820 and 390 px without horizontal page scroll; reset shows empty states; *Load Demo Data* from Home; KPI card routes to Market; *Why this score?* modal; *Explore topic* routes to Content Explorer with the search applied; row opens the detail drawer; platform filter; re-cluster with k = 6; *Evaluate k*; CSV upload, validation and run; invalid CSV error message; "Insufficient history for reliable forecasting" for the 6-week topic.
* **Deployment layout:** backend run with the Docker paths (`DATA_DIR`, `DATABASE_URL`), Next.js standalone server run as in the Dockerfile, and persistence verified across a backend restart. *(The Docker images themselves were not built in the development sandbox because it has no Docker daemon; the Dockerfiles follow the verified layout.)*

Full test-case table: [`docs/TEST_CASES.md`](docs/TEST_CASES.md).

## 14. Customisation guide

| To change | Edit |
|---|---|
| Data sources / accepted columns | `backend/app/processing/ingestion.py` (`CONTENT_ALIASES`, `MARKET_ALIASES`, validation) |
| Cleaning / preprocessing | `backend/app/processing/cleaning.py`, `backend/app/utils/text.py` (stop words, lemmatiser) |
| TF-IDF parameters | `backend/app/config.py` (`TFIDF_*`), `processing/features.py` |
| Clustering | `config.py` (`DEFAULT_CLUSTERS`, `MAX_CLUSTERS`, `KMEANS_N_INIT`), `processing/clustering.py` (swap in another algorithm returning labels + centroids) |
| Topic labels | `processing/topics.py` (`TOPIC_LEXICON`, `SHORT_NAMES`, thresholds) |
| Engagement formula | `analytics/engagement.py`, `config.FALLBACK_WEIGHTS`, `MIN_VIEWS_FOR_RATE` |
| Market trend source | Produce a DataFrame with the market schema and pass it to `STATE.set_market(...)` (e.g. a new `processing/sources/google_trends.py`); status rules in `config.MARKET_*` and `processing/trends.py` |
| Forecasting | `processing/forecasting.py`, `config.FORECAST_*` |
| Opportunity scoring | `config.OPPORTUNITY_WEIGHTS`, `OPPORTUNITY_BANDS`, `analytics/opportunities.py` |
| Insight rules | `analytics/insights.py` |
| UI theme | `frontend/app/globals.css` (CSS tokens), `frontend/tailwind.config.ts`, chart palette in `frontend/lib/colors.ts` |
| Database | `DATABASE_URL` (add `psycopg[binary]` for PostgreSQL) |

## 15. Limitations and future scope

**Limitations**
* TF-IDF is bag-of-words: no word order, sarcasm or synonym handling.
* K-Means needs k up front and assumes compact clusters; short texts give modest silhouette scores (about 0.09 at k = 5 on the demo, typical for short posts).
* With k smaller than the number of real themes, clusters merge; ContentSense flags these as *mixed* rather than hiding it.
* Market coverage uses literal phrase matching; paraphrases are only captured by the similarity fallback for engagement.
* Engagement differences are correlational, not causal.
* Demo datasets are synthetic; real conclusions need real authorised data.
* Single-user demo state (no authentication).

**Future scope:** Google Trends and approved platform/news APIs with scheduled ingestion; sentence-transformer embeddings, HDBSCAN, NMF/LDA topic models; seasonal forecasting (SARIMA/Prophet) and alerts; PostgreSQL, multi-brand workspaces, authentication and role-based access; competitor benchmarking; automated PDF reports.

## 16. Data usage and ethics

ContentSense is for authorised datasets only: content you own or may use, public/permitted content, and approved APIs. It implements **no** scraping, authentication bypass, rate-limit bypass, robots.txt circumvention or private-data extraction. Remove or pseudonymise personal data before upload. The demo datasets are synthetic and labelled as sample data in the UI.
