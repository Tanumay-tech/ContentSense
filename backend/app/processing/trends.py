"""Trend analysis.

Content trends (the brand's own content):
    change % = (records in 2nd half of period - records in 1st half) / records in 1st half * 100
    ↑ Increasing if change > +10 %, ↓ Decreasing if change < -10 %, → Stable otherwise.

Market trends (authorised market dataset, weekly 0-100 interest index):
    current level  = mean of the last 4 weeks
    growth (12w)   = current level vs the 4-week mean 12 weeks earlier
    momentum       = slope of a linear fit over the last 8 weeks (% of mean per week)
    YoY change     = current level vs the 4-week mean 52 weeks earlier
    status         = Emerging / Growing / Stable / Declining (rules in classify_market)
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sstats
from sklearn.feature_extraction.text import CountVectorizer

from app import config

FREQ = {"day": "D", "week": "W-MON", "month": "MS"}


def direction(change: float | None) -> str:
    if change is None:
        return "Insufficient data"
    if change > config.TREND_CHANGE_THRESHOLD:
        return "Increasing"
    if change < -config.TREND_CHANGE_THRESHOLD:
        return "Decreasing"
    return "Stable"


def _pct(a: float, b: float) -> float | None:
    if a is None or b is None or a == 0 or np.isnan(a) or np.isnan(b):
        return None
    return round((b - a) / a * 100, 1)


def _r(v, nd=3):
    try:
        v = float(v)
        return None if np.isnan(v) else round(v, nd)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Content trends
# ---------------------------------------------------------------------------
def content_trends(df: pd.DataFrame, granularity: str = "month", engagement_available: bool = True) -> dict:
    d = df.dropna(subset=["date"])
    if d.empty:
        return {"available": False, "reason": "No valid dates in the dataset, so trends over time cannot be calculated."}
    freq = FREQ.get(granularity, "MS")
    start, end = d["date"].min(), d["date"].max()
    span_days = (end - start).days
    mid = start + (end - start) / 2
    h1, h2 = d[d["date"] < mid], d[d["date"] >= mid]
    enough = span_days >= 28 and len(h1) >= 5 and len(h2) >= 5

    vol = d.set_index("date").resample(freq)["id"].count()
    volume = [{"period": i.date().isoformat(), "records": int(v)} for i, v in vol.items()]

    topics = d["topic"].value_counts().index.tolist()
    ts = d.set_index("date").groupby("topic").resample(freq)["id"].count().unstack(0).fillna(0)
    ts = ts.reindex(vol.index, fill_value=0)
    topic_series = [{"period": i.date().isoformat(), **{t: int(r.get(t, 0)) for t in topics}} for i, r in ts.iterrows()]

    def topic_row(name: str, s1: pd.DataFrame, s2: pd.DataFrame) -> dict:
        n1, n2 = len(s1), len(s2)
        ch = _pct(n1, n2) if enough and n1 >= 3 else None
        share1 = n1 / max(1, len(h1)) * 100
        share2 = n2 / max(1, len(h2)) * 100
        e1 = s1["engagement"].mean() if engagement_available else np.nan
        e2 = s2["engagement"].mean() if engagement_available else np.nan
        return {"name": name, "first_half": n1, "second_half": n2, "change_pct": ch, "direction": direction(ch),
                "share_first_pct": round(share1, 1), "share_second_pct": round(share2, 1),
                "share_change_pp": round(share2 - share1, 1),
                "engagement_first": _r(e1), "engagement_second": _r(e2), "engagement_change_pct": _pct(e1, e2)}

    topic_trends = [topic_row(t, h1[h1["topic"] == t], h2[h2["topic"] == t]) for t in topics]
    topic_trends.sort(key=lambda r: (r["change_pct"] is None, -(r["change_pct"] or 0)))
    category_trends = [topic_row(c, h1[h1["category"] == c], h2[h2["category"] == c])
                       for c in d["category"].value_counts().index]
    category_trends.sort(key=lambda r: -r["share_change_pp"])

    vol_change = _pct(len(h1), len(h2)) if enough else None
    eng_series, eng_change = [], None
    if engagement_available:
        es = d.set_index("date").resample(freq)["engagement"].mean()
        eng_series = [{"period": i.date().isoformat(), "avg_engagement": _r(v)} for i, v in es.items() if not np.isnan(v)]
        eng_change = _pct(h1["engagement"].mean(), h2["engagement"].mean()) if enough else None

    emerging, fading = emerging_keywords(d)

    insights = []
    if enough:
        grow = [t for t in topic_trends if t["change_pct"] is not None and t["direction"] == "Increasing"]
        fall = [t for t in topic_trends if t["change_pct"] is not None and t["direction"] == "Decreasing"]
        if grow:
            g = max(grow, key=lambda r: r["change_pct"])
            insights.append({"text": f"{g['name']} content increased {g['change_pct']:.0f}% between the first and second half of the selected period.",
                             "metric": f"{g['first_half']} → {g['second_half']} records", "tone": "positive"})
        if fall:
            f = min(fall, key=lambda r: r["change_pct"])
            insights.append({"text": f"{f['name']} content decreased {abs(f['change_pct']):.0f}% over the same comparison.",
                             "metric": f"{f['first_half']} → {f['second_half']} records", "tone": "negative"})
        if vol_change is not None and eng_change is not None:
            vd, ed = direction(vol_change), direction(eng_change)
            if vol_change > 0 and eng_change < -3:
                txt = f"Content volume increased {vol_change:.0f}%, but average engagement declined {abs(eng_change):.0f}%."
                tone = "warning"
            elif vol_change > 0 and eng_change > 3:
                txt = f"Both content volume (+{vol_change:.0f}%) and average engagement (+{eng_change:.0f}%) increased."
                tone = "positive"
            else:
                txt = f"Content volume is {vd.lower()} ({vol_change:+.0f}%) and engagement is {ed.lower()} ({eng_change:+.0f}%)."
                tone = "neutral"
            insights.append({"text": txt, "metric": "second half vs first half", "tone": tone})
        if emerging:
            e = emerging[0]
            insights.append({"text": f"'{e['term']}' is an emerging keyword: it appears in {e['recent_share_pct']}% of recent content vs {e['earlier_share_pct']}% earlier.",
                             "metric": f"lift ×{e['lift']}", "tone": "neutral"})

    return {
        "available": True,
        "range": {"start": start.date().isoformat(), "end": end.date().isoformat(), "midpoint": mid.date().isoformat(),
                  "days": int(span_days)},
        "comparison_available": enough,
        "comparison_note": None if enough else "Select a longer period (at least 4 weeks with 5+ records per half) to compare trends.",
        "granularity": granularity,
        "volume": volume,
        "volume_change_pct": vol_change, "volume_direction": direction(vol_change),
        "engagement_over_time": eng_series,
        "engagement_change_pct": eng_change, "engagement_direction": direction(eng_change),
        "topics": topics,
        "topic_series": topic_series,
        "topic_trends": topic_trends,
        "category_trends": category_trends,
        "emerging_keywords": emerging, "fading_keywords": fading,
        "insights": insights,
    }


def emerging_keywords(d: pd.DataFrame, top: int = 10) -> tuple[list[dict], list[dict]]:
    if len(d) < 30:
        return [], []
    start, end = d["date"].min(), d["date"].max()
    cut = start + (end - start) * (2 / 3)
    early, recent = d[d["date"] < cut], d[d["date"] >= cut]
    if len(early) < 10 or len(recent) < 10:
        return [], []
    cv = CountVectorizer(ngram_range=(1, 2), binary=True, min_df=5, token_pattern=r"(?u)\b[a-z][a-z]+\b")
    try:
        cv.fit(d["clean_text"])
    except ValueError:
        return [], []
    Me, Mr = cv.transform(early["clean_text"]), cv.transform(recent["clean_text"])
    se = np.asarray(Me.sum(axis=0)).ravel() / len(early)
    sr = np.asarray(Mr.sum(axis=0)).ravel() / len(recent)
    cr = np.asarray(Mr.sum(axis=0)).ravel()
    ce = np.asarray(Me.sum(axis=0)).ravel()
    eps = 1 / len(early)
    lift = (sr + eps) / (se + eps)
    terms = cv.get_feature_names_out()

    def row(i):
        return {"term": str(terms[i]), "recent_docs": int(cr[i]), "earlier_docs": int(ce[i]),
                "recent_share_pct": round(float(sr[i]) * 100, 2), "earlier_share_pct": round(float(se[i]) * 100, 2),
                "lift": round(float(lift[i]), 2)}

    # rank by absolute change in document share so that well-supported terms lead
    delta = sr - se
    em = [row(i) for i in np.argsort(delta)[::-1] if cr[i] >= 6 and lift[i] >= 1.5][:top]
    fa = [row(i) for i in np.argsort(delta) if ce[i] >= 8 and lift[i] <= 0.67][:top]
    return em, fa


# ---------------------------------------------------------------------------
# Market trends
# ---------------------------------------------------------------------------
def market_weekly(mdf: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Aggregate keyword rows into one weekly series per topic (mean score, summed volume)."""
    m = mdf.copy()
    m["week"] = m["date"].dt.to_period("W-SUN").dt.end_time.dt.normalize()
    score = m.groupby(["week", "topic"])["trend_score"].mean().unstack("topic").sort_index()
    vol = m.groupby(["week", "topic"])["volume"].sum(min_count=1).unstack("topic").sort_index()
    return score, vol


def _window_mean(s: pd.Series, end_offset: int, width: int) -> float | None:
    """Mean of `width` points ending `end_offset` points before the last one."""
    n = len(s)
    stop = n - end_offset
    start = stop - width
    if start < 0:
        return None
    return float(s.iloc[start:stop].mean())


def classify_market(n_weeks: int, growth: float | None, yoy: float | None, current: float) -> str:
    if n_weeks < config.MARKET_EMERGING_MAX_HISTORY and (growth or 0) > config.MARKET_GROWING_THRESHOLD:
        return "Emerging"
    if yoy is not None and yoy >= config.MARKET_EMERGING_YOY and current >= 25 and (growth or 0) > 0:
        return "Emerging"
    if growth is None:
        return "Insufficient data"
    if growth >= config.MARKET_GROWING_THRESHOLD:
        return "Growing"
    if growth <= -config.MARKET_GROWING_THRESHOLD:
        return "Declining"
    return "Stable"


def strength_label(score: float) -> str:
    return "Very High" if score >= 70 else "High" if score >= 50 else "Moderate" if score >= 30 else "Low"


def market_metrics(mdf: pd.DataFrame) -> list[dict]:
    score, vol = market_weekly(mdf)
    out = []
    R, L = config.MARKET_RECENT_WEEKS, config.MARKET_GROWTH_LOOKBACK_WEEKS
    for topic in score.columns:
        s = score[topic].dropna()
        n = len(s)
        if n == 0:
            continue
        current = float(s.iloc[-R:].mean())
        base = _window_mean(s, L, R)
        short_history = base is None
        if short_history and n >= 2:
            base = float(s.iloc[: max(1, min(R, n // 2))].mean())
        growth = _pct(base, current) if base else None
        yoy_base = _window_mean(s, 52, R)
        yoy = _pct(yoy_base, current) if yoy_base else None
        mom = None
        if n >= 4:
            w = s.iloc[-8:]
            slope = sstats.linregress(np.arange(len(w)), w.values).slope
            mom = round(float(slope / max(w.mean(), 1e-6) * 100), 2)
        keywords = sorted(mdf.loc[mdf["topic"] == topic, "keyword"].unique().tolist())
        cats = mdf.loc[mdf["topic"] == topic, "category"]
        sources = sorted(mdf.loc[mdf["topic"] == topic, "source"].unique().tolist())
        v = vol[topic].dropna() if topic in vol else pd.Series(dtype=float)
        status = classify_market(n, growth, yoy, current)
        out.append({
            "topic": str(topic),
            "category": str(cats.mode().iloc[0]) if not cats.empty else "General",
            "keywords": keywords,
            "sources": sources,
            "history_weeks": int(n),
            "first_week": s.index[0].date().isoformat(), "last_week": s.index[-1].date().isoformat(),
            "current_score": round(current, 1),
            "peak_score": round(float(s.max()), 1),
            "growth_pct": growth,
            "growth_basis": "first weeks available (short history)" if short_history else f"vs {L} weeks earlier",
            "yoy_pct": yoy,
            "momentum_pct_per_week": mom,
            "recent_volume": int(v.iloc[-R:].sum()) if len(v) else None,
            "status": status,
            "strength": strength_label(current),
            "sparkline": [round(float(x), 1) for x in s.iloc[-26:].values],
        })
    return out


def topic_history(mdf: pd.DataFrame, topic: str) -> dict | None:
    score, vol = market_weekly(mdf)
    if topic not in score.columns:
        return None
    s = score[topic].dropna()
    v = vol[topic].reindex(s.index) if topic in vol else pd.Series(index=s.index, dtype=float)
    growth = s.pct_change(periods=4) * 100
    rolling = s.rolling(4, min_periods=1).mean()
    return {
        "topic": topic,
        "dates": [d.date().isoformat() for d in s.index],
        "points": [{"date": d.date().isoformat(), "score": round(float(s[d]), 2),
                    "rolling_4w": round(float(rolling[d]), 2),
                    "growth_4w_pct": None if np.isnan(growth[d]) else round(float(growth[d]), 1),
                    "volume": None if pd.isna(v.get(d)) else int(v.get(d))} for d in s.index],
        "values": [float(x) for x in s.values],
        "keywords": [
            {"keyword": k, "current_score": round(float(g.sort_values("date")["trend_score"].iloc[-4:].mean()), 1)}
            for k, g in mdf[mdf["topic"] == topic].groupby("keyword")
        ],
    }
