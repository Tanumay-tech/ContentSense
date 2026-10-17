"""ContentSense API - Content & Market Intelligence Platform."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.core.state import STATE
from app.processing.ingestion import DatasetError
from app.routes import analytics, content, data, topics, trends

log = logging.getLogger("contentsense")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        restored = STATE.restore()
        if not restored and config.AUTO_LOAD_DEMO:
            STATE.load_demo()
            log.info("Demo data loaded on first start")
    except Exception as exc:  # never block startup; the UI shows the error state
        STATE.last_error = str(exc)
        log.exception("Startup data load failed")
    yield


app = FastAPI(
    title="ContentSense API",
    description="Web Content Mining pipeline: cleaning → TF-IDF → K-Means → topics → analytics → market opportunities.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(DatasetError)
async def dataset_error(_: Request, exc: DatasetError):
    status = 409 if exc.code in ("no_data", "not_analyzed") else 422
    return JSONResponse(status_code=status, content={"detail": str(exc), "code": exc.code})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong while processing the request. "
                                                            "Check the backend logs for details.", "code": "server_error"})


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "analysis_ready": STATE.analysis is not None}


@app.get("/", include_in_schema=False)
def root():
    return {"name": "ContentSense API", "docs": "/docs", "health": "/api/health"}


for r in (data.router, content.router, topics.router, analytics.router, trends.router):
    app.include_router(r)
