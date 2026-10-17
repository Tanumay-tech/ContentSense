"""Content Explorer: search, filter, sort, paginate, inspect and export records."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.models.schemas import ContentDetail, ContentPage
from app.routes.deps import analysis, filters_dep
from app.utils.filters import Filters, apply_filters
from app.utils.serialization import to_csv_bytes

router = APIRouter(prefix="/api", tags=["content"])

SORTABLE = {"date", "engagement", "likes", "comments", "shares", "views", "platform", "topic", "category", "title"}


def _num(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) or pd.isna(v) else v


def _item(r) -> dict:
    return {
        "id": r["id"], "date": r["date"].date().isoformat() if pd.notna(r["date"]) else None,
        "platform": r["platform"], "title": r["title"], "snippet": r["content"][:160],
        "topic": r["topic"], "category": r["category"],
        "engagement": None if pd.isna(r["engagement"]) else round(float(r["engagement"]), 3),
        "likes": int(r["likes"]), "comments": int(r["comments"]), "shares": int(r["shares"]),
        "views": None if pd.isna(r["views"]) else int(r["views"]),
    }


@router.get("/content", response_model=ContentPage)
def list_content(
    f: Filters = Depends(filters_dep),
    sort: str = Query("date"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=200),
):
    a = analysis()
    df = apply_filters(a.df, f)
    col = sort if sort in SORTABLE else "date"
    df = df.sort_values(col, ascending=(order == "asc"), na_position="last", kind="mergesort")
    total = len(df)
    pages = max(1, math.ceil(total / page_size))
    chunk = df.iloc[(page - 1) * page_size: page * page_size]
    return {"items": [_item(r) for _, r in chunk.iterrows()], "total": total, "page": page, "page_size": page_size,
            "pages": pages, "engagement_label": a.engagement_meta["label"], "engagement_unit": a.engagement_meta["unit"]}


@router.get("/content/export", summary="Export the filtered content as CSV")
def export_content(f: Filters = Depends(filters_dep)):
    a = analysis()
    df = apply_filters(a.df, f).copy()
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    df["keywords"] = df["keywords"].map(", ".join)
    df["engagement"] = df["engagement"].round(4)
    cols = ["id", "date", "platform", "title", "content", "topic", "category", "author", "likes", "comments",
            "shares", "views", "engagement", "keywords", "url"]
    return Response(to_csv_bytes(df[cols]), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="contentsense_content.csv"'})


@router.get("/content/{content_id}", response_model=ContentDetail)
def get_content(content_id: str):
    a = analysis()
    hit = a.df[a.df["id"] == content_id]
    if hit.empty:
        raise HTTPException(404, detail=f"Content record '{content_id}' was not found.")
    r = hit.iloc[0]
    topic_avg = a.df.loc[a.df["topic"] == r["topic"], "engagement"].mean()
    overall = a.df["engagement"].mean()
    return {
        **_item(r),
        "content": r["content"], "author": r["author"], "url": r["url"] or None, "cluster": int(r["cluster"]),
        "keywords": list(r["keywords"]), "clean_text": r["clean_text"], "interactions": int(r["interactions"]),
        "topic_avg_engagement": None if np.isnan(topic_avg) else round(float(topic_avg), 3),
        "dataset_avg_engagement": None if np.isnan(overall) else round(float(overall), 3),
    }


@router.get("/meta", summary="Filter options and dataset bounds")
def meta():
    a = analysis()
    d = a.df["date"].dropna()
    e = a.df["engagement"].dropna()
    return {
        "topics": [t["name"] for t in a.topics],
        "categories": a.df["category"].value_counts().index.tolist(),
        "platforms": a.df["platform"].value_counts().index.tolist(),
        "date_min": d.min().date().isoformat() if len(d) else None,
        "date_max": d.max().date().isoformat() if len(d) else None,
        "engagement": {**a.engagement_meta,
                       "min": float(e.min()) if len(e) else None, "max": float(e.max()) if len(e) else None,
                       "p25": float(e.quantile(.25)) if len(e) else None, "p75": float(e.quantile(.75)) if len(e) else None},
        "records": int(len(a.df)),
    }
