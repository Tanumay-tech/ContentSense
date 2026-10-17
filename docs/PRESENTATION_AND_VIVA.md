# ContentSense: presentation script and viva preparation

Target length: 10 to 12 minutes of demo plus questions. Numbers below are from the bundled demo data with k = 5; they are computed live, so small differences appear if the data is regenerated.

---

## Presentation script

### 0. Opening (45 s)
> "Marketing teams publish thousands of posts but can't easily answer: what are we actually talking about, what works, and where are we missing what the market cares about? ContentSense is a content and market intelligence platform built on Web Content Mining. It turns a raw content export into topics, keywords, engagement insights, trends and ranked content opportunities. Everything you'll see is computed from the data by a real pipeline: nothing is hard-coded."

### 1. Home (1 min)
Open **Home**.
> "The home page is deliberately just an overview. Five KPIs: 1,839 analysed records, 5 topics, 3.42% average engagement rate, the top-performing topic, and 5 market opportunities. Every card links to the page that explains it. Below: topic distribution, engagement by topic against the average line, monthly volume, the top opportunity, and four insights generated from the data, each showing the metric it's based on."

### 2. Data & Processing (1.5 min)
Open **Data & Processing** → *Reset demo* → *Load Demo Data*.
> "This is the Web Content Mining pipeline: content, cleaning, feature extraction, clustering, topic groups, analytics, insights. The demo loads a synthetic brand dataset plus a synthetic market trend dataset, both clearly labelled as sample data. The button is naming each real stage as the server runs it."

Point at statistics:
> "1,878 records came in. Cleaning removed 28 duplicates and 11 empty posts, found 9 invalid numbers and 4 unparseable dates, and left 1,839 records. TF-IDF extracted 4,000 features; the matrix is about 99% zeros, which is normal for text. K-Means produced 5 clusters."

Open *Advanced*: show the before/after preprocessing example and stage timings (the whole run takes about 1.5 s).

### 3. Topic Mining (2 min)
> "Each record is a TF-IDF vector; K-Means groups similar vectors. The names aren't hand-written: each centroid's top terms are scored against a lexicon of marketing labels. 'AI & Technology' matched 65% of its top-term weight. 'Promotions & Travel' is flagged as a mixed topic because two themes scored strongly; we show that rather than hide it."

Show top keywords, representative content (closest to centroid) and the cluster map.
> "The map projects 4,000 dimensions to 2 with Truncated SVD, the sparse version of PCA. It's supporting evidence; overlap in 2-D is expected."

Click *Evaluate k*:
> "k is adjustable. The elbow curve and silhouette score help choose it; silhouette values around 0.1 are typical for short social posts, so we compare across k rather than against 1."

### 4. Keyword Intelligence (1 min)
> "Frequency and importance are different questions. The most frequent terms are 'ai', 'customer', 'marketing', 'brand'. By TF-IDF importance the top terms are 'travel', 'sustainability', 'ai', 'money': terms that define specific content. The callout shows 'customer' is #2 by frequency but far down by importance, because it's spread thinly across everything."

### 5. Engagement Insights (1 min)
> "Engagement rate is (likes + comments + shares) ÷ views × 100, and the formula is always shown. AI & Technology content earns about 25% more than average; promotional content is the weakest; TikTok leads by platform. If a dataset has no views, the system switches to a documented weighted-interactions fallback."

### 6. Content Trends (1 min)
> "Here the question is how our own content changes. The period is split in half and compared: AI & Technology content roughly doubled (+114%), overall volume grew 21% while engagement stayed flat. Emerging keywords include 'machine learning', 'generative ai' and 'agent'. The arrows are calculated with a ±10% band, not typed in."

### 7. Market Trends & Opportunities (2.5 min)
> "This is the industry extension. We compare our content with an authorised market dataset; no scraping."

*Trending now*: AI Search Optimization, Social Commerce, AI Agents, Personalized Marketing.

Select **AI Agents**:
> "Interest is up 620% year over year and 12% over the last 12 weeks. The forecast uses Holt's damped-trend smoothing: 'projected flat', with the back-test error shown. It's an estimate based on the historical pattern, not a guarantee."

Select **AI Search Optimization**:
> "This topic has only 6 weeks of data, so the system refuses to forecast: 'Insufficient history for reliable forecasting.'"

*Your content vs market* table:
> "SEO, marketing automation and influencer marketing: we already cover them heavily, so they're low priority. AI Agents and Social Commerce: high market interest, low coverage."

Open the **AI Agents** card → *Why this score?*
> "Opportunity score 79 out of 100, Strong. It's 0.40 × momentum + 0.35 × gap + 0.25 × engagement potential. Momentum 0.72 from a score of 82 and +12% growth. Gap 0.75: the market gives it 12% of attention but it's only 3% of our share of voice. Engagement potential 0.95: our posts mentioning AI agents earned about 1.9× our average. So: high market momentum, low current coverage, positive related engagement."

Click *Explore topic* → the 13 matching records in the Content Explorer; open one to show the detail drawer.

### 8. Close (30 s)
Return to **Home**.
> "The dashboard summarises all of this: the dominant topic, the best-performing category, the top opportunity, the fastest-growing topic. Core Web Content Mining (cleaning, TF-IDF, K-Means, topics, keywords, engagement) plus an industry extension (market trends, gap detection, opportunity scoring, forecasting). The results are suggestions to evaluate, not commands."

---

## Viva questions and answers

**What is Web Content Mining?**
Discovering useful knowledge from the content of web pages and social posts: text, titles and metadata. It is one of three branches of web mining, alongside structure mining (links) and usage mining (logs). ContentSense mines post and article text to find topics, keywords and patterns and relates them to engagement.

**What is being mined?**
The title + content text of each record (topics, keywords), its category, platform and date (grouping, trends), its likes/comments/shares/views (engagement), and in the extension an authorised weekly market-interest series per topic.

**How is text cleaned?**
Records: blank content removed, duplicates (same text, platform, date) removed, numbers coerced with invalid values counted, dates parsed, defaults for missing fields. Text: HTML/URLs/e-mails/@mentions removed, hashtags split, lowercase, punctuation and digits removed, stop words removed, short tokens dropped (whitelist for ai, seo, ugc...), plurals normalised.

**How is feature extraction performed?**
scikit-learn `TfidfVectorizer`: unigrams and bigrams, min_df 2, max_df 0.5, 4,000 features, sublinear tf, L2-normalised rows. The result is a sparse document-term matrix.

**Why TF-IDF?**
Raw counts favour words that appear everywhere. TF-IDF multiplies term frequency by inverse document frequency, so a term that is frequent in one record but rare in the collection gets a high weight. That highlights what distinguishes a record, which is what clustering needs. It is fast, transparent and needs no labelled data.

**Why K-Means?**
It is simple, scales linearly with the number of records, works well on L2-normalised TF-IDF vectors (Euclidean distance then behaves like cosine distance), and its centroids are readable term-weight vectors, which makes naming topics possible. Its weaknesses (choosing k, assumption of compact clusters) are addressed with the elbow and silhouette charts and by flagging mixed clusters.

**How do you choose k?**
Default 5 as specified; the elbow method (inertia vs k) and the cosine silhouette score for k = 2 to 10 are shown on Topic Mining, and the business readability of the resulting topics also matters.

**Why is the silhouette score so low (about 0.09)?**
Short social posts share a lot of vocabulary and TF-IDF space is very high-dimensional and sparse, so clusters overlap. Values of 0.05 to 0.2 are typical for short-text clustering. We compare silhouette across k rather than against the theoretical maximum of 1.

**How are clusters converted into topics?**
Each centroid's top 40 terms are scored against 12 lexicon labels (share of top-term weight explained by each label's seed words). Labels are assigned greedily, highest score first, each used once. A second label scoring at least 40% of the first makes the name compound ("Promotions & Travel"); if nothing reaches 10%, the name is built from the top terms. The method and score are displayed.

**What is the difference between frequency and importance?**
Frequency counts occurrences. Importance is the average TF-IDF weight of a term in the records that use it × ln(1 + number of those records). Generic words used everywhere ("plan", "customer") are frequent but not informative; topical words ("travel", "budgeting") rank higher on importance.

**How is engagement calculated?**
(likes + comments + shares) ÷ views × 100. Records with fewer than 10 views are excluded from rate averages. If most records lack views, the weighted-interactions fallback (likes + 2×comments + 3×shares) is used and flagged in the UI.

**How are content trends calculated?**
The selected period is split at its midpoint; change % = (second half − first half) / first half × 100, with ±10% separating Increasing / Stable / Decreasing. Emerging keywords compare document share in the latest third vs the earlier two thirds.

**How are market trends incorporated?**
Market rows (topic, keyword, date, trend_score...) are averaged into a weekly series per topic. We compute current level (last 4 weeks), 12-week growth, YoY change and 8-week momentum, and classify Emerging / Growing / Stable / Declining. Coverage in our content is measured by whole-phrase matching of the topic's tracked keywords.

**How does opportunity detection work?**
Score = 100 × (0.40 × Momentum + 0.35 × Gap + 0.25 × Engagement potential). Momentum blends market strength and growth; Gap compares market attention share with our share of voice; Engagement potential compares how related content performs against our average. All three are 0 to 1, so the score is 0 to 100. Bands: ≥ 70 Strong, 55 to 70 Moderate, 40 to 55 Worth monitoring, < 40 Low.

**What if no records mention a market topic?**
Engagement potential falls back to the 20 most similar records by TF-IDF cosine similarity; if none exist, a neutral 0.5 is used. The basis is shown in the score breakdown.

**Is the prediction guaranteed?**
No. The forecast (Holt's damped-trend exponential smoothing) extrapolates only the historical pattern, shows an 80% range and a back-test error, and refuses to forecast series under 26 weeks. External events can change interest at any time; the UI labels it "Projected trend direction" and an estimate.

**Why damped trend?**
An undamped linear trend keeps growing forever; damping (φ = 0.9) flattens the projection over the horizon, which is more conservative and usually more accurate for interest indices bounded at 100.

**Which parts are core Web Content Mining and which are extensions?**
Core: data collection, cleaning, preprocessing, TF-IDF, K-Means, topic groups, keywords, categories, content frequency, engagement, content trends. Extension: market trend analysis, trend comparison, content-gap detection, opportunity scoring, forecasting.

**How do you avoid fake analytics?**
Every KPI, chart, insight and score is computed from the loaded CSVs at run time; the insight engine only emits a statement when its underlying metric exists and passes minimum-support checks, and it shows that metric. Uploading a different CSV changes every page. 34 automated tests check the calculations.

**Is the data collected ethically?**
Only authorised data is used: the user's own exports, permitted public content, approved APIs. No scraping, no authentication or rate-limit bypass, no robots.txt circumvention, no private-data extraction. The demo data is synthetic.

**How would this scale or go to production?**
Swap SQLite for PostgreSQL through `DATABASE_URL`, add scheduled ingestion from approved APIs, authentication and multi-brand workspaces, move the pipeline to a background worker, and consider embeddings for semantic clustering.
