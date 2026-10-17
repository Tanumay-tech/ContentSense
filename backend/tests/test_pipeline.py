"""Unit tests for the mining pipeline modules."""
import io

import numpy as np
import pandas as pd
import pytest

from app import config
from app.analytics.engagement import compute_engagement
from app.analytics.opportunities import compute_opportunities
from app.processing.cleaning import clean_content
from app.processing.clustering import run_kmeans
from app.processing.features import extract_features
from app.processing.forecasting import forecast_series
from app.processing.ingestion import DatasetError, read_csv_bytes, validate_content, validate_market
from app.processing.topics import name_clusters
from app.processing.trends import classify_market, direction
from app.utils.text import lemmatize, normalize_for_match, tokenize


def csv(text: str) -> pd.DataFrame:
    return read_csv_bytes(text.encode(), "t.csv")


# ---------------------------------------------------------------- ingestion
def test_empty_file_rejected():
    with pytest.raises(DatasetError, match="empty"):
        read_csv_bytes(b"   ", "x.csv")


def test_header_only_rejected():
    with pytest.raises(DatasetError, match="no data rows"):
        read_csv_bytes(b"id,content\n", "x.csv")


def test_non_csv_extension_rejected():
    with pytest.raises(DatasetError, match=".csv"):
        read_csv_bytes(b"a,b\n1,2\n", "x.xlsx")


def test_missing_content_column_message():
    with pytest.raises(DatasetError, match="Missing required column 'content'"):
        validate_content(csv("id,likes\n1,5\n"))


def test_column_aliases_recognized():
    df, rep = validate_content(csv("Text,Published At,Impressions\nhello world,2025-01-01,100\n"))
    assert {"content", "date", "views"} <= set(rep.recognized)
    assert df.loc[0, "content"] == "hello world"


# ------------------------------------------------------------------ cleaning
def test_cleaning_counts():
    raw = csv(
        "id,date,platform,content,likes,comments,shares,views\n"
        "1,2025-01-01,X,Great AI marketing tips for brands,10,1,1,100\n"
        "2,2025-01-01,X,Great AI marketing tips for brands,10,1,1,100\n"   # duplicate
        "3,2025-01-02,X,,1,1,1,10\n"                                         # missing content
        "4,not-a-date,X,SEO keyword research checklist guide,n/a,2,3,50\n"   # bad date + bad number
    )
    df, _ = validate_content(raw)
    clean, stats = clean_content(df)
    assert stats["records_received"] == 4
    assert stats["duplicates_removed"] == 1
    assert stats["missing_content"] == 1
    assert stats["invalid_dates"] == 1
    assert stats["invalid_numeric_values"] == 1
    assert stats["records_cleaned"] == 2
    assert clean.loc[clean["id"] == "4", "likes"].iloc[0] == 0  # invalid -> 0


def test_text_preprocessing():
    toks = tokenize("Check our NEW #ContentStrategy guide at https://x.com for brands & strategies!!")
    assert "http" not in " ".join(toks)
    assert "content" in toks and "strategy" in toks and "brand" in toks
    assert "our" not in toks and "for" not in toks
    assert lemmatize("strategies") == "strategy" and lemmatize("business") == "business"
    assert " short form video " in normalize_for_match("Short-Form video!")


# ------------------------------------------------------ features + clustering
@pytest.fixture(scope="module")
def sample():
    raw = read_csv_bytes(config.SAMPLE_CONTENT_CSV.read_bytes(), "sample_content.csv")
    df, _ = validate_content(raw)
    clean, stats = clean_content(df)
    fs = extract_features(clean)
    return clean, stats, fs


def test_sample_dataset_size(sample):
    clean, stats, _ = sample
    assert stats["records_received"] >= 1000
    assert stats["duplicates_removed"] > 0 and stats["missing_content"] > 0


def test_tfidf(sample):
    clean, _, fs = sample
    assert fs.matrix.shape[0] == len(clean)
    assert 100 < fs.matrix.shape[1] <= config.TFIDF_MAX_FEATURES
    norms = np.sqrt(np.asarray(fs.matrix.multiply(fs.matrix).sum(axis=1)).ravel())
    assert np.allclose(norms[norms > 0], 1.0)  # L2 normalised
    assert fs.stats["bigrams"] > 0


def test_kmeans_and_topic_names(sample):
    clean, _, fs = sample
    cr = run_kmeans(fs.matrix, 5)
    assert len(set(cr.labels)) == 5
    names = name_clusters(cr.centroids, fs.terms)
    labels = [n["name"] for n in names]
    assert len(set(labels)) == 5
    assert not any(l.lower().startswith("cluster") for l in labels)
    assert "AI & Technology" in labels
    assert all(n["top_terms"] for n in names)


def test_not_enough_records_for_clustering(sample):
    _, _, fs = sample
    with pytest.raises(DatasetError, match="Not enough records"):
        run_kmeans(fs.matrix[:12], 5)


# ------------------------------------------------------------------ engagement
def test_engagement_rate_formula():
    df = pd.DataFrame({"likes": [8.0], "comments": [1.0], "shares": [1.0], "views": [200.0]})
    out, meta = compute_engagement(df, True, True)
    assert meta["mode"] == "rate"
    assert out["engagement"].iloc[0] == pytest.approx(5.0)


def test_engagement_fallback_without_views():
    df = pd.DataFrame({"likes": [10.0], "comments": [2.0], "shares": [1.0], "views": [np.nan]})
    out, meta = compute_engagement(df, True, False)
    assert meta["mode"] == "interactions"
    assert out["engagement"].iloc[0] == 10 + 2 * 2 + 3 * 1


# ------------------------------------------------------------ trends/forecast
def test_direction_thresholds():
    assert direction(25) == "Increasing" and direction(-25) == "Decreasing" and direction(3) == "Stable"
    assert direction(None) == "Insufficient data"


def test_market_classification():
    assert classify_market(104, 15, 20, 60) == "Growing"
    assert classify_market(104, -12, -20, 40) == "Declining"
    assert classify_market(104, 2, 5, 50) == "Stable"
    assert classify_market(104, 10, 300, 70) == "Emerging"
    assert classify_market(6, 30, None, 40) == "Emerging"


def test_forecast_refuses_short_history():
    res = forecast_series([f"2026-0{1 + i // 4}-0{1 + i % 4}" for i in range(10)], list(range(10)))
    assert res["available"] is False
    assert res["reason"] == "Insufficient history for reliable forecasting."


def test_forecast_rising_series():
    dates = [str(np.datetime64("2025-01-05") + np.timedelta64(7 * i, "D")) for i in range(60)]
    vals = [20 + i * 0.8 + (i % 3) for i in range(60)]
    res = forecast_series(dates, vals)
    assert res["available"] and len(res["points"]) == config.FORECAST_HORIZON_WEEKS
    assert res["direction"] == "Projected upward"
    assert all(p["lower"] <= p["forecast"] <= p["upper"] for p in res["points"])
    assert res["backtest"]["mape_pct"] < 15


# -------------------------------------------------------------- opportunities
def test_opportunity_scores_bounded_and_ranked(sample):
    clean, _, fs = sample
    cr = run_kmeans(fs.matrix, 5)
    clean = clean.copy()
    clean["row"] = np.arange(len(clean))
    clean["match_text"] = clean["text"].map(normalize_for_match)
    clean, _ = compute_engagement(clean, True, True)
    market = [
        {"topic": "AI Agents", "keywords": ["ai agents"], "current_score": 80.0, "growth_pct": 20.0, "status": "Emerging",
         "strength": "Very High", "yoy_pct": 300.0, "category": "AI"},
        {"topic": "SEO", "keywords": ["seo"], "current_score": 50.0, "growth_pct": -10.0, "status": "Declining",
         "strength": "High", "yoy_pct": -15.0, "category": "Search"},
    ]
    res = compute_opportunities(clean, fs.matrix, fs.vectorizer, cr.centroids, {i: str(i) for i in range(5)}, market, True)
    ops = res["opportunities"]
    assert all(0 <= o["score"] <= 100 for o in ops)
    assert ops[0]["topic"] == "AI Agents"          # growing + under-covered beats declining + covered
    seo = next(o for o in ops if o["topic"] == "SEO")
    assert seo["coverage_level"] == "High"
    total = sum(c["contribution"] for c in ops[0]["breakdown"]["components"])
    assert total == pytest.approx(ops[0]["score"], abs=0.2)


def test_market_validation():
    mdf, warnings = validate_market(csv("topic,date,trend_score\nA,2025-01-05,40\nA,2025-01-12,oops\n"))
    assert len(mdf) == 1 and any("non-numeric" in w for w in warnings)
    with pytest.raises(DatasetError, match="missing required"):
        validate_market(csv("topic,score_x\nA,1\n"))
