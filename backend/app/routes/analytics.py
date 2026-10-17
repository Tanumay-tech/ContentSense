"""Keyword, engagement, overview and insight endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.analytics.engagement import engagement_summary
from app.analytics.keywords import keyword_analysis, keywords_by_group
from app.core.state import STATE
from app.models.schemas import InsightsResponse
from app.routes.deps import analysis, cached, filters_dep
from app.utils.filters import Filters, apply_filters
from app.utils.serialization import jsonable

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/keywords")
def keywords(f: Filters = Depends(filters_dep)):
    a = analysis()

    def compute():
        sub = apply_filters(a.df, f)
        res = keyword_analysis(sub, a.X, a.terms, a.global_mean)
        res["by_topic"] = keywords_by_group(sub, a.X, a.terms, "topic") if len(sub) else []
        res["by_category"] = keywords_by_group(sub, a.X, a.terms, "category") if len(sub) else []
        res["total_records"] = int(len(a.df))
        return jsonable(res)

    return cached(a, ("keywords", f.key()), compute)


@router.get("/engagement")
def engagement(f: Filters = Depends(filters_dep), granularity: str = Query("month", pattern="^(day|week|month)$")):
    a = analysis()

    def compute():
        sub = apply_filters(a.df, f)
        res = engagement_summary(sub, a.engagement_meta, granularity)
        res["insights"] = _engagement_insights(res) if res.get("available") else []
        res["total_records"] = int(len(a.df))
        return jsonable(res)

    return cached(a, ("engagement", f.key(), granularity), compute)


def _engagement_insights(res: dict) -> list[dict]:
    unit = res["meta"]["unit"]
    h = res["highlights"]
    out = []
    if h["best_topic"] and h["worst_topic"] and h["best_topic"]["name"] != h["worst_topic"]["name"]:
        b, w = h["best_topic"], h["worst_topic"]
        diff = (b["avg_engagement"] / w["avg_engagement"] - 1) * 100 if w["avg_engagement"] else None
        if diff is not None:
            out.append({"text": f"{b['name']} content averages {diff:.0f}% higher engagement than {w['name']} content.",
                        "metric": f"{b['avg_engagement']:.2f}{unit} vs {w['avg_engagement']:.2f}{unit}", "tone": "positive"})
    if h["best_category"]:
        b = h["best_category"]
        out.append({"text": f"{b['name']} is the highest-engagement category ({b['vs_overall_pct']:+.0f}% vs average).",
                    "metric": f"{b['records']} records", "tone": "positive"})
    if h["worst_category"] and h["worst_category"] is not h["best_category"]:
        w = h["worst_category"]
        out.append({"text": f"{w['name']} is the lowest-engagement category ({w['vs_overall_pct']:+.0f}% vs average).",
                    "metric": f"{w['records']} records", "tone": "warning"})
    if h["best_platform"] and h["worst_platform"] and h["best_platform"]["name"] != h["worst_platform"]["name"]:
        b, w = h["best_platform"], h["worst_platform"]
        out.append({"text": f"{b['name']} delivers the strongest engagement; {w['name']} the weakest.",
                    "metric": f"{b['avg_engagement']:.2f}{unit} vs {w['avg_engagement']:.2f}{unit}", "tone": "neutral"})
    return out


@router.get("/overview", summary="Home dashboard summary")
def overview():
    a = analysis()

    def compute():
        eng = a.engagement
        best = None
        if eng.get("available"):
            cands = [t for t in eng["by_topic"] if t["records"] >= 10]
            best = cands[0] if cands else None
        opps = a.opportunities
        vol = [{"period": v["period"], "records": v["records"]} for v in a.trends.get("volume", [])] if a.trends.get("available") else []
        return jsonable({
            "kpis": {
                "total_content": int(len(a.df)),
                "topics_identified": a.k,
                "avg_engagement": eng["overall"]["avg_engagement"] if eng.get("available") else None,
                "engagement_label": a.engagement_meta["label"], "engagement_unit": a.engagement_meta["unit"],
                "top_topic": best,
                "opportunities_detected": opps.get("detected_count") if opps.get("available") else None,
                "strong_opportunities": opps.get("strong_count") if opps.get("available") else None,
                "market_loaded": opps.get("available", False),
            },
            "topic_distribution": [{"name": t["name"], "records": t["size"], "share_pct": t["share_pct"]} for t in a.topics],
            "engagement_by_topic": eng.get("by_topic", []) if eng.get("available") else [],
            "volume_over_time": vol,
            "top_opportunity": opps["opportunities"][0] if opps.get("available") and opps["opportunities"] else None,
            "insights": a.insights[:4],
            "dataset": {"source": STATE.content_source, "market_source": STATE.market_source,
                        "records_received": a.pipeline["cleaning"]["records_received"],
                        "date_range": a.pipeline["cleaning"].get("date_range"), "ran_at": a.ran_at},
        })

    return cached(a, ("overview",), compute)


@router.get("/insights", response_model=InsightsResponse)
def insights():
    a = analysis()
    return jsonable({"insights": a.insights, "content_trend_insights": a.trends.get("insights", [])})
