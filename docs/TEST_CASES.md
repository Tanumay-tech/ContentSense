# ContentSense test cases

Automated tests: `cd backend && pytest -q` (34 tests: `tests/test_pipeline.py`, `tests/test_api.py`). UI cases were executed with Playwright against the running app. Status reflects the final run before delivery.

| ID | Area | Test | Expected result | Type | Status |
|---|---|---|---|---|---|
| T01 | Build | `npm run typecheck` and `npm run build` | No type errors; all 10 pages prerender | Frontend | Pass |
| T02 | Backend | Start `uvicorn app.main:app` | `/api/health` returns ok; demo auto-loaded | API | Pass |
| T03 | API comms | Frontend fetches `/api/status`, `/api/overview` | Home renders KPIs, no console errors | UI | Pass |
| T04 | Sample data | `POST /api/data/load-demo` | 1,878 received, 1,839 analysed, market loaded | API | Pass |
| T05 | CSV upload | Upload a valid 60-row CSV, then run | Validation preview; run analyses 60 records | API + UI | Pass |
| T06 | Invalid CSV | Upload CSV without text column | 422 "Missing required column 'content' ..." shown in UI | API + UI | Pass |
| T07 | Empty CSV | Upload empty file / header only | 422 "The uploaded file is empty" / "no data rows" | Unit | Pass |
| T08 | Wrong type | Upload `.xlsx` | "Please upload a .csv file." | Unit | Pass |
| T09 | Column aliases | Headers `Text, Published At, Impressions` | Mapped to content, date, views | Unit | Pass |
| T10 | Cleaning | Duplicate, blank, bad date, bad number rows | Counted exactly; bad likes treated as 0 | Unit | Pass |
| T11 | Preprocessing | URL, hashtag, stop words, plurals | URL removed; `#ContentStrategy` split; "strategies" becomes "strategy" | Unit | Pass |
| T12 | TF-IDF | Fit on sample data | Rows L2-normalised; > 100 features; bigrams present | Unit | Pass |
| T13 | Clustering | K-Means k = 5 | 5 distinct labels | Unit | Pass |
| T14 | Topic generation | Name clusters | 5 unique names, none "Cluster N", includes "AI & Technology" | Unit | Pass |
| T15 | Not enough records | Cluster 12 records with k = 5 | "Not enough records for clustering ..." (422, `insufficient_data`) | Unit + API | Pass |
| T16 | Re-cluster | `POST /api/analysis/run {"n_clusters": 7}`; UI k = 6 | 7 / 6 topics returned; invalid k = 1 rejected (422) | API + UI | Pass |
| T17 | k evaluation | Click *Evaluate k* | Inertia and silhouette charts for k = 2..10 | UI | Pass |
| T18 | Keyword extraction | `GET /api/keywords` | Frequent, important, bigrams, trigrams all non-empty | API | Pass |
| T19 | Keyword filters | `?topic=<topic>` | Fewer records than unfiltered | API | Pass |
| T20 | Engagement formula | likes 8, comments 1, shares 1, views 200 | 5.00% | Unit | Pass |
| T21 | Engagement fallback | No views | 1×likes + 2×comments + 3×shares; mode "interactions" | Unit | Pass |
| T22 | Engagement page | `GET /api/engagement` | by topic/category/platform, distribution, top content, insights | API | Pass |
| T23 | Content search | `q=ai agents`, sort engagement desc | Matches mention "ai agent"; sorted descending | API + UI | Pass |
| T24 | Filters | platform=LinkedIn / TikTok; date range Jan 2026 | Only matching platform / dates returned | API + UI | Pass |
| T25 | Detail view | Click a row / `GET /api/content/{id}` | Drawer shows full text, keywords, cluster, metrics, formula; unknown id 404 | API + UI | Pass |
| T26 | Export | Content, topics, opportunities CSV | `text/csv` with header row | API | Pass |
| T27 | Content trends | `granularity=week` | Volume, topic trends with ↑/→/↓ directions | API | Pass |
| T28 | Short period | 9-day range | `comparison_available = false` with message | API | Pass |
| T29 | Trend thresholds | +25 / −25 / +3 / None | Increasing / Decreasing / Stable / Insufficient data | Unit | Pass |
| T30 | Market classification | Synthetic metric inputs | Growing, Declining, Stable, Emerging (YoY), Emerging (short history) | Unit | Pass |
| T31 | Market comparison | `GET /api/trends/market` | ≥ 10 topics, trending now, includes Declining and Growing/Emerging | API | Pass |
| T32 | Opportunity scoring | Growing under-covered vs declining covered topic | Growing topic ranks first; scores within 0 to 100; score equals sum of contributions | Unit | Pass |
| T33 | Opportunities (demo) | `GET /api/opportunities` | AI Agents #1, "Strong Opportunity"; sorted descending | API | Pass |
| T34 | Score explanation | Click *Why this score?* | Modal with 3 components, weights, points, matched phrases | UI | Pass |
| T35 | Forecast | AI Agents (104 weeks) | 8 forecast points, lower ≤ forecast ≤ upper, back-test MAPE | API | Pass |
| T36 | Insufficient history | AI Search Optimization (6 weeks) | "Insufficient history for reliable forecasting." in API and UI | API + UI | Pass |
| T37 | Market upload invalid | CSV without `trend_score` | 422 "missing required column(s)" | API | Pass |
| T38 | Reset | *Reset demo* | Status cleared; Home shows welcome state; pages show "No data loaded yet" | API + UI | Pass |
| T39 | Navigation | KPI "Market opportunities" | Routes to /market | UI | Pass |
| T40 | Explore topic | Opportunity card *Explore topic* | Routes to /content?q=ai agents with 13 matches | UI | Pass |
| T41 | Backend unavailable | Stop backend, load page | "Backend unavailable" with retry | UI (manual) | Pass |
| T42 | Responsive | All pages at 1440 / 1024 / 820 / 390 px | No horizontal page scroll; no console errors | UI | Pass |
| T43 | Persistence | Run k = 7, restart backend | Restored with k = 7 and analysis ready | API | Pass |
