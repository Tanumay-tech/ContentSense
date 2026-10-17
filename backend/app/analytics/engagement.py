"""Engagement metrics.

Primary metric (when views are available for most records):
    Engagement Rate (%) = (likes + comments + shares) / views * 100

Fallback (views unavailable):
    Weighted Interactions = 1*likes + 2*comments + 3*shares
    (comments and shares take more effort than a like, so they weigh more)
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app import config


def compute_engagement(df: pd.DataFrame, has_engagement_cols: bool, has_views_col: bool) -> tuple[pd.DataFrame, dict]:
    df = df.copy()
    df["interactions"] = df["likes"] + df["comments"] + df["shares"]
    views_ok = df["views"].fillna(0) >= config.MIN_VIEWS_FOR_RATE
    coverage = float(views_ok.mean()) if len(df) else 0.0

    if not has_engagement_cols:
        df["engagement"] = np.nan
        meta = {"available": False, "mode": "none", "label": "Engagement", "unit": "",
                "formula": "Engagement columns (likes, comments, shares) were not provided.",
                "records_without_metric": int(len(df))}
    elif has_views_col and coverage >= config.VIEWS_COVERAGE_FOR_RATE:
        df["engagement"] = np.where(views_ok, df["interactions"] / df["views"].where(views_ok) * 100, np.nan)
        meta = {"available": True, "mode": "rate", "label": "Engagement rate", "unit": "%",
                "formula": "(likes + comments + shares) / views × 100",
                "records_without_metric": int((~views_ok).sum()),
                "note": (f"{int((~views_ok).sum())} record(s) without usable views are excluded from rate averages."
                         if (~views_ok).any() else None)}
    else:
        w = config.FALLBACK_WEIGHTS
        df["engagement"] = w["likes"] * df["likes"] + w["comments"] * df["comments"] + w["shares"] * df["shares"]
        meta = {"available": True, "mode": "interactions", "label": "Weighted interactions", "unit": "",
                "formula": "1×likes + 2×comments + 3×shares (fallback: views unavailable)",
                "records_without_metric": 0,
                "note": "Views are missing for most records, so the weighted-interactions fallback is used instead of a rate."}
    meta["views_coverage_pct"] = round(coverage * 100, 1)
    return df, meta


def _agg(df: pd.DataFrame, by: str, overall: float | None) -> list[dict]:
    if df.empty:
        return []
    g = df.groupby(by).agg(
        records=("id", "count"),
        avg_engagement=("engagement", "mean"),
        median_engagement=("engagement", "median"),
        likes=("likes", "sum"), comments=("comments", "sum"), shares=("shares", "sum"),
        views=("views", "sum"),
    ).reset_index().rename(columns={by: "name"})
    g = g.sort_values("avg_engagement", ascending=False)
    rows = []
    for _, r in g.iterrows():
        avg = _num(r["avg_engagement"])
        rows.append({
            "name": str(r["name"]), "records": int(r["records"]),
            "avg_engagement": avg, "median_engagement": _num(r["median_engagement"]),
            "likes": int(r["likes"]), "comments": int(r["comments"]), "shares": int(r["shares"]),
            "views": int(r["views"]) if not pd.isna(r["views"]) else None,
            "vs_overall_pct": round((avg / overall - 1) * 100, 1) if avg is not None and overall else None,
        })
    return rows


def _num(v, nd: int = 3):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(v) else round(v, nd)


def histogram(values: pd.Series, bins: int = 20) -> list[dict]:
    v = values.dropna()
    if v.empty:
        return []
    hi = float(v.quantile(0.98))  # clip long tail for a readable distribution
    lo = float(v.min())
    if hi <= lo:
        hi = lo + 1
    counts, edges = np.histogram(v.clip(upper=hi), bins=bins, range=(lo, hi))
    return [{"bin_start": round(float(edges[i]), 3), "bin_end": round(float(edges[i + 1]), 3),
             "label": f"{edges[i]:.1f}–{edges[i + 1]:.1f}", "count": int(counts[i])} for i in range(len(counts))]


def engagement_summary(df: pd.DataFrame, meta: dict, granularity: str = "month") -> dict:
    if not meta.get("available") or df.empty:
        return {"meta": meta, "available": False, "records": int(len(df))}
    e = df["engagement"]
    overall = _num(e.mean())
    totals = {k: int(df[k].sum()) for k in ["likes", "comments", "shares"]}
    totals["views"] = int(df["views"].sum()) if df["views"].notna().any() else None

    by_topic = _agg(df, "topic", overall)
    by_category = _agg(df, "category", overall)
    by_platform = _agg(df, "platform", overall)

    over_time = []
    dated = df.dropna(subset=["date"])
    if not dated.empty:
        freq = {"day": "D", "week": "W-MON", "month": "MS"}.get(granularity, "MS")
        s = dated.set_index("date").resample(freq).agg({"engagement": "mean", "id": "count"})
        over_time = [{"period": idx.date().isoformat(), "avg_engagement": _num(r["engagement"]), "records": int(r["id"])}
                     for idx, r in s.iterrows() if r["id"] > 0]

    top = df.dropna(subset=["engagement"]).sort_values("engagement", ascending=False).head(10)
    top_content = [{"id": r["id"], "title": r["title"], "platform": r["platform"], "topic": r["topic"],
                    "category": r["category"], "date": r["date"].date().isoformat() if pd.notna(r["date"]) else None,
                    "engagement": _num(r["engagement"]), "likes": int(r["likes"]), "comments": int(r["comments"]),
                    "shares": int(r["shares"]), "views": int(r["views"]) if pd.notna(r["views"]) else None}
                   for _, r in top.iterrows()]

    # only compare groups with enough records to be meaningful
    def best(rows, min_n=10):
        c = [r for r in rows if r["records"] >= min_n and r["avg_engagement"] is not None]
        return (c[0], c[-1]) if c else (None, None)

    bt, wt = best(by_topic)
    bc, wc = best(by_category)
    bp, wp = best(by_platform)
    return {
        "available": True, "meta": meta, "records": int(len(df)),
        "overall": {"avg_engagement": overall, "median_engagement": _num(e.median()),
                    "p90_engagement": _num(e.quantile(0.9)), **totals},
        "distribution": histogram(e),
        "by_topic": by_topic, "by_category": by_category, "by_platform": by_platform,
        "over_time": over_time, "top_content": top_content,
        "highlights": {
            "best_topic": bt, "worst_topic": wt, "best_category": bc, "worst_category": wc,
            "best_platform": bp, "worst_platform": wp,
            "best_content": top_content[0] if top_content else None,
        },
    }
