"""Central configuration. Every tunable used by the pipeline lives here so it
can be changed in one place (or overridden with environment variables)."""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent

# --- Storage ---------------------------------------------------------------
# SQLite by default. Any SQLAlchemy URL works, e.g.
#   DATABASE_URL=postgresql+psycopg://user:pass@host:5432/contentsense
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'contentsense.db'}")

DATA_DIR = Path(os.getenv("DATA_DIR", REPO_DIR / "data"))
SAMPLE_CONTENT_CSV = DATA_DIR / "sample_content.csv"
SAMPLE_MARKET_CSV = DATA_DIR / "sample_market_trends.csv"

# Load the demo datasets automatically on first start so the UI is never empty.
AUTO_LOAD_DEMO = os.getenv("AUTO_LOAD_DEMO", "true").lower() in {"1", "true", "yes"}

# --- API -------------------------------------------------------------------
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if o.strip()]
MAX_UPLOAD_MB = 25
MAX_ROWS = 50_000

# --- Feature extraction (TF-IDF) ------------------------------------------
TFIDF_MAX_FEATURES = 4000
TFIDF_NGRAM_RANGE = (1, 2)
TFIDF_MAX_DF = 0.5          # ignore terms that appear in >50% of documents
TFIDF_MIN_DF = 2            # ignore terms that appear in only one document
MIN_TOKENS_PER_DOC = 2      # documents with fewer meaningful tokens are excluded

# --- Clustering (K-Means) --------------------------------------------------
DEFAULT_CLUSTERS = 5
MIN_CLUSTERS = 2
MAX_CLUSTERS = 12
MIN_DOCS_PER_CLUSTER = 3    # need at least k * this many documents
KMEANS_N_INIT = 10
RANDOM_STATE = 42
SCATTER_MAX_POINTS = 2500

# --- Engagement ------------------------------------------------------------
# Engagement rate = (likes + comments + shares) / views * 100
# Fallback when views are unavailable: weighted interactions
FALLBACK_WEIGHTS = {"likes": 1.0, "comments": 2.0, "shares": 3.0}
MIN_VIEWS_FOR_RATE = 10
VIEWS_COVERAGE_FOR_RATE = 0.5   # share of rows that need views to use the rate

# --- Trends ----------------------------------------------------------------
TREND_CHANGE_THRESHOLD = 10.0   # +/- % that separates Increasing / Stable / Decreasing
MIN_PERIODS_FOR_TREND = 4

# --- Market trends & forecasting ------------------------------------------
MARKET_RECENT_WEEKS = 4           # "current" level = mean of the last N weeks
MARKET_GROWTH_LOOKBACK_WEEKS = 12 # growth compares current vs N weeks earlier
MARKET_GROWING_THRESHOLD = 8.0    # % growth to count as Growing / Declining
MARKET_EMERGING_YOY = 80.0        # % year-over-year growth to count as Emerging
MARKET_EMERGING_MAX_HISTORY = 26  # topics with shorter history + growth are Emerging
FORECAST_MIN_WEEKS = 26
FORECAST_HORIZON_WEEKS = 8
FORECAST_HOLDOUT_WEEKS = 8
FORECAST_DAMPING = 0.9            # damped trend keeps projections conservative

# --- Opportunity score -----------------------------------------------------
# Score = 100 * (w_m * Momentum + w_g * Gap + w_e * EngagementPotential)
OPPORTUNITY_WEIGHTS = {"momentum": 0.40, "gap": 0.35, "engagement": 0.25}
OPPORTUNITY_BANDS = [(70, "Strong Opportunity"), (55, "Moderate Opportunity"), (40, "Worth Monitoring"), (0, "Low Priority")]
MIN_MATCHED_DOCS_FOR_ENGAGEMENT = 5
RELATED_DOCS_FALLBACK = 20
RELATED_SIMILARITY_MIN = 0.05
