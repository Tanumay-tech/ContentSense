"""Topic Mining: clusters, generated labels, 2-D projection, k evaluation."""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter
from fastapi.responses import Response

from app.core.state import STATE
from app.models.schemas import TopicsResponse
from app.processing.topics import TOPIC_LEXICON
from app.routes.deps import analysis
from app.utils.serialization import jsonable, to_csv_bytes

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=TopicsResponse)
def topics():
    a = analysis()
    return jsonable({
        "n_clusters": a.k, "topics": a.topics,
        "clustering": a.pipeline["clustering"], "features": a.pipeline["features"],
        "engagement": a.engagement_meta,
        "labeling": {
            "method": "Each centroid's top TF-IDF terms are scored against a lexicon of marketing topic labels; "
                      "the best-scoring unused label is assigned. When a second label scores at least 40% of the first, the "
                      "cluster is mixed and gets a compound name (e.g. 'Promotions & Travel'). If no label explains at least 10% of the "
                      "centroid's top-term weight, the name is built from the cluster's own top terms.",
            "lexicon_size": len(TOPIC_LEXICON),
        },
    })


@router.get("/scatter")
def scatter():
    return jsonable(analysis().scatter)


@router.get("/evaluate-k", summary="Elbow (inertia) and silhouette for k = 2..10")
def evaluate_k():
    return jsonable({"current_k": analysis().k, "results": STATE.k_evaluation()})


@router.get("/export", summary="Topic summary as CSV")
def export_topics():
    a = analysis()
    rows = [{
        "topic": t["name"], "cluster_id": t["cluster_id"], "label_method": t["label_method"],
        "records": t["size"], "share_pct": t["share_pct"], "avg_engagement": t["avg_engagement"],
        "engagement_vs_avg_pct": t["engagement_vs_avg_pct"],
        "top_terms": ", ".join(x["term"] for x in t["top_terms"][:10]),
        "top_categories": ", ".join(f"{c['name']} ({c['share_pct']}%)" for c in t["top_categories"]),
    } for t in a.topics]
    return Response(to_csv_bytes(pd.DataFrame(rows)), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="contentsense_topics.csv"'})
