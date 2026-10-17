"""Data ingestion, demo loading, reset and pipeline execution."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app import config

from app.core.state import STATE, load_content_upload, load_market_upload
from app.models.schemas import RunRequest, StatusResponse, UploadResponse
from app.utils.serialization import jsonable

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/status", response_model=StatusResponse)
def status():
    return jsonable(STATE.status())


@router.post("/data/upload", response_model=UploadResponse, summary="Upload a content CSV (validated, not yet analysed)")
async def upload_content(file: UploadFile = File(...)):
    raw = await file.read()
    return jsonable(load_content_upload(raw, file.filename or "upload.csv"))


@router.post("/data/load-demo", response_model=StatusResponse, summary="Load demo content + market data and run the analysis")
def load_demo():
    return jsonable(STATE.load_demo())


@router.post("/data/reset", response_model=StatusResponse, summary="Clear all data and analysis")
def reset():
    STATE.reset()
    return jsonable(STATE.status())


@router.get("/data/preview", summary="First rows of the loaded content dataset (raw)")
def preview(limit: int = Query(20, ge=1, le=200)):
    if STATE.content_raw is None:
        return {"rows": [], "columns": [], "total": 0}
    df = STATE.content_raw.head(limit)
    return {"rows": df.to_dict(orient="records"), "columns": list(df.columns), "total": int(len(STATE.content_raw))}


@router.post("/market-data/upload", response_model=UploadResponse, summary="Upload a market trend CSV (re-runs analysis if content is loaded)")
async def upload_market(file: UploadFile = File(...)):
    raw = await file.read()
    return jsonable(load_market_upload(raw, file.filename or "market.csv"))


@router.get("/market-data/preview")
def market_preview(limit: int = Query(20, ge=1, le=200)):
    if STATE.market_df is None:
        return {"rows": [], "columns": [], "total": 0}
    df = STATE.market_df.head(limit).copy()
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    return jsonable({"rows": df.to_dict(orient="records"), "columns": list(df.columns), "total": int(len(STATE.market_df))})


@router.post("/analysis/run", response_model=StatusResponse, summary="Run the full mining pipeline")
def run_analysis(body: Optional[RunRequest] = None):
    k = body.n_clusters if body else None
    return jsonable(STATE.run(k))


@router.get("/analysis/pipeline", summary="Processing statistics of the latest run")
def pipeline():
    a = STATE.require()
    return jsonable({"run_id": a.run_id, "ran_at": a.ran_at, **a.pipeline})


@router.get("/data/sample/{kind}", summary="Download a sample dataset (content | market) to use as a template")
def sample_file(kind: str):
    path = {"content": config.SAMPLE_CONTENT_CSV, "market": config.SAMPLE_MARKET_CSV}.get(kind)
    if path is None or not path.exists():
        raise HTTPException(404, detail="Sample file not found.")
    return FileResponse(path, media_type="text/csv", filename=path.name)
