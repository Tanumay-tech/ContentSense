"""Content trends, market trends, forecasting and opportunities."""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app import config
from app.core.state import STATE
from app.models.schemas import OpportunitiesResponse
from app.processing.forecasting import forecast_series
from app.processing.trends import content_trends, topic_history
from app.routes.deps import analysis, cached, filters_dep
from app.utils.filters import Filters, apply_filters
from app.utils.serialization import jsonable, to_csv_bytes

router = APIRouter(prefix="/api", tags=["trends & market"])


@router.get("/trends/content")
def trends_content(f: Filters = Depends(filters_dep), granularity: str = Query("month", pattern="^(day|week|month)$")):
    a = analysis()
    return cached(a, ("trends", f.key(), granularity),
                  lambda: jsonable(content_trends(apply_filters(a.df, f), granularity, a.engagement_meta["available"])))


def _market_required():
    a = analysis()
    if STATE.market_df is None or not a.market:
        raise HTTPException(409, detail="No market trend dataset loaded. Load the demo data or upload a market trend CSV "
                                        "on the Data & Processing page.")
    return a


@router.get("/trends/market")
def trends_market():
    a = _market_required()
    trending = sorted([m for m in a.market if m["status"] in ("Emerging", "Growing") and m["growth_pct"] is not None],
                      key=lambda m: m["growth_pct"], reverse=True)[:5]
    return jsonable({
        "topics": a.market, "trending_now": trending,
        "source": STATE.market_source, "warnings": STATE.market_warnings,
        "method": {
            "current_level": f"Mean of the last {config.MARKET_RECENT_WEEKS} weeks (0–100 interest index)",
            "growth": f"Current level vs the {config.MARKET_RECENT_WEEKS}-week mean {config.MARKET_GROWTH_LOOKBACK_WEEKS} weeks earlier",
            "momentum": "Slope of a linear fit over the last 8 weeks, as % of the mean per week",
            "status_rules": {
                "Emerging": f"Year-over-year growth ≥ {config.MARKET_EMERGING_YOY:.0f}% with rising recent growth, "
                            f"or under {config.MARKET_EMERGING_MAX_HISTORY} weeks of history with growth > {config.MARKET_GROWING_THRESHOLD:.0f}%",
                "Growing": f"Growth ≥ +{config.MARKET_GROWING_THRESHOLD:.0f}%",
                "Stable": f"Growth between −{config.MARKET_GROWING_THRESHOLD:.0f}% and +{config.MARKET_GROWING_THRESHOLD:.0f}%",
                "Declining": f"Growth ≤ −{config.MARKET_GROWING_THRESHOLD:.0f}%",
            },
        },
    })


@router.get("/trends/market/{topic}")
def trends_market_topic(topic: str):
    a = _market_required()
    hist = topic_history(STATE.market_df, topic)
    if hist is None:
        raise HTTPException(404, detail=f"Market topic '{topic}' not found.")
    fc = forecast_series(hist["dates"], hist["values"])
    metrics = next((m for m in a.market if m["topic"] == topic), None)
    opp = next((o for o in a.opportunities.get("opportunities", []) if o["topic"] == topic), None)
    hist.pop("values")
    return jsonable({**hist, "metrics": metrics, "forecast": fc, "opportunity": opp})


@router.get("/opportunities", response_model=OpportunitiesResponse)
def opportunities():
    a = analysis()
    return jsonable(a.opportunities)


@router.get("/opportunities/export", summary="Opportunity summary as CSV")
def export_opportunities():
    a = _market_required()
    rows = [{
        "rank": o["rank"], "topic": o["topic"], "opportunity_score": o["score"], "band": o["band"],
        "market_score": o["market_score"], "market_growth_pct": o["market_growth_pct"], "market_status": o["market_status"],
        "your_records": o["your_volume"], "your_share_of_voice_pct": o["share_of_voice_pct"],
        "market_attention_pct": o["market_attention_pct"], "coverage_gap": o["gap"],
        "engagement_index": o["engagement_index"], "coverage_level": o["coverage_level"],
        "reason": o["reason"], "recommendation": o["recommendation"],
    } for o in a.opportunities["opportunities"]]
    return Response(to_csv_bytes(pd.DataFrame(rows)), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="contentsense_opportunities.csv"'})
