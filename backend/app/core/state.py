"""Application state and pipeline orchestration.

The full Web Content Mining pipeline runs here:

    ingest -> clean -> TF-IDF -> K-Means -> topic naming -> engagement
           -> content trends -> market trends -> opportunities -> insights

Results are cached in memory for fast API responses; raw datasets and the
processed records are persisted to the database so the analysis survives a
restart.
"""
from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app import config
from app.analytics.engagement import compute_engagement, engagement_summary
from app.analytics.insights import generate_insights
from app.analytics.keywords import keyword_analysis
from app.analytics.opportunities import compute_opportunities
from app.db import database as db
from app.processing.cleaning import clean_content, preprocessing_example
from app.processing.clustering import check_cluster_feasible, evaluate_k, project_2d, run_kmeans
from app.processing.features import extract_features, top_terms_per_doc
from app.processing.ingestion import DatasetError, read_csv_bytes, validate_content, validate_market
from app.processing.topics import name_clusters, representative_docs
from app.processing.trends import content_trends, market_metrics
from app.utils.text import normalize_for_match


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Analysis:
    run_id: str
    ran_at: str
    k: int
    df: pd.DataFrame
    X: Any
    vectorizer: Any
    terms: np.ndarray
    global_mean: np.ndarray
    centroids: np.ndarray
    topics: list[dict]
    topic_names: dict[int, str]
    scatter: dict
    engagement_meta: dict
    engagement: dict
    trends: dict
    keywords: dict
    market: list[dict]
    opportunities: dict
    insights: list[dict]
    pipeline: dict
    k_eval: list[dict] | None = None
    cache: dict = field(default_factory=dict)


class AppState:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.content_raw: pd.DataFrame | None = None
        self.content_source: dict | None = None
        self.ingestion: dict | None = None
        self.market_df: pd.DataFrame | None = None
        self.market_source: dict | None = None
        self.market_warnings: list[str] = []
        self.analysis: Analysis | None = None
        self.last_error: str | None = None
        self.k = config.DEFAULT_CLUSTERS

    # ------------------------------------------------------------------ data
    def set_content(self, raw: pd.DataFrame, source: dict, persist: bool = True) -> dict:
        df, report = validate_content(raw)  # raises DatasetError
        with self.lock:
            self.content_raw = raw.astype(str)
            self.content_source = {**source, "rows": int(len(raw)), "loaded_at": _now()}
            self.ingestion = report.__dict__
            self.analysis = None
            if persist:
                db.save_frame("content_raw", self.content_raw)
                db.set_state("content_source", self.content_source)
        return {"source": self.content_source, "validation": report.__dict__,
                "preview": df.head(8).fillna("").astype(str).to_dict(orient="records")}

    def set_market(self, raw: pd.DataFrame, source: dict, persist: bool = True) -> dict:
        mdf, warnings = validate_market(raw)
        with self.lock:
            self.market_df = mdf
            self.market_warnings = warnings
            self.market_source = {**source, "rows": int(len(mdf)), "topics": int(mdf["topic"].nunique()),
                                  "loaded_at": _now(),
                                  "date_range": [mdf["date"].min().date().isoformat(), mdf["date"].max().date().isoformat()]}
            if persist:
                out = mdf.copy()
                out["date"] = out["date"].dt.strftime("%Y-%m-%d")
                db.save_frame("market_raw", out)
                db.set_state("market_source", self.market_source)
        return {"source": self.market_source, "warnings": warnings}

    def load_demo(self) -> dict:
        if not config.SAMPLE_CONTENT_CSV.exists() or not config.SAMPLE_MARKET_CSV.exists():
            raise DatasetError("Demo datasets not found. Run `python data/generate_sample_data.py` first.")
        content = read_csv_bytes(config.SAMPLE_CONTENT_CSV.read_bytes(), config.SAMPLE_CONTENT_CSV.name)
        market = read_csv_bytes(config.SAMPLE_MARKET_CSV.read_bytes(), config.SAMPLE_MARKET_CSV.name)
        self.set_content(content, {"name": config.SAMPLE_CONTENT_CSV.name, "kind": "demo"})
        self.set_market(market, {"name": config.SAMPLE_MARKET_CSV.name, "kind": "demo"})
        return self.run(config.DEFAULT_CLUSTERS)

    def reset(self) -> None:
        with self.lock:
            self.content_raw = self.content_source = self.ingestion = None
            self.market_df = self.market_source = None
            self.market_warnings = []
            self.analysis = None
            self.last_error = None
            self.k = config.DEFAULT_CLUSTERS
            db.clear_all()

    def restore(self) -> bool:
        """Reload persisted datasets on startup and re-run the analysis."""
        db.init_db()
        raw = db.load_frame("content_raw")
        market = db.load_frame("market_raw")
        if market is not None and len(market):
            try:
                self.set_market(market.astype(str), db.get_state("market_source", {"name": "stored", "kind": "stored"}), persist=False)
            except DatasetError:
                pass
        if raw is not None and len(raw):
            try:
                self.set_content(raw.fillna(""), db.get_state("content_source", {"name": "stored", "kind": "stored"}), persist=False)
                self.run(int(db.get_state("n_clusters", config.DEFAULT_CLUSTERS)))
                return True
            except DatasetError as exc:
                self.last_error = str(exc)
        return False

    # -------------------------------------------------------------- pipeline
    def run(self, k: int | None = None) -> dict:
        with self.lock:
            if self.content_raw is None:
                raise DatasetError("No content dataset loaded. Upload a CSV or load the demo data first.", "no_data")
            k = int(k or self.k)
            timings: dict[str, float] = {}

            def tick(name: str, t0: float) -> float:
                timings[name] = round((time.perf_counter() - t0) * 1000, 1)
                return time.perf_counter()

            t = time.perf_counter()
            base, report = validate_content(self.content_raw.copy())
            has_eng_cols = bool({"likes", "comments", "shares"} & set(report.recognized))
            has_views = "views" in report.recognized
            t = tick("ingestion", t)

            df, clean_stats = clean_content(base)
            if df.empty:
                raise DatasetError("No usable records remain after cleaning (all rows were empty, duplicated or too short).")
            t = tick("cleaning", t)

            check_cluster_feasible(len(df), k)
            fs = extract_features(df)
            t = tick("feature_extraction", t)

            cr = run_kmeans(fs.matrix, k)
            t = tick("clustering", t)

            named = name_clusters(cr.centroids, fs.terms)
            names = {n["cluster_id"]: n["name"] for n in named}
            df["row"] = np.arange(len(df))
            df["cluster"] = cr.labels
            df["topic"] = df["cluster"].map(names)
            df["keywords"] = top_terms_per_doc(fs.matrix, fs.terms, 6, df["text"].tolist())
            df["match_text"] = df["text"].map(normalize_for_match)
            t = tick("topic_labelling", t)

            df, eng_meta = compute_engagement(df, has_eng_cols, has_views)
            topics = self._topic_summaries(df, fs.matrix, cr, named, eng_meta)
            coords, var = project_2d(fs.matrix)
            scatter = self._scatter(df, coords, var)
            eng = engagement_summary(df, eng_meta)
            t = tick("engagement_analysis", t)

            trends = content_trends(df, "month", eng_meta["available"])
            global_mean = np.asarray(fs.matrix.mean(axis=0)).ravel()
            kw = keyword_analysis(df, fs.matrix, fs.terms, global_mean)
            t = tick("trend_and_keyword_analysis", t)

            market = market_metrics(self.market_df) if self.market_df is not None else []
            opps = compute_opportunities(df, fs.matrix, fs.vectorizer, cr.centroids, names, market, eng_meta["available"])
            t = tick("market_comparison", t)

            insights = generate_insights(topics, eng, trends, opps, kw, len(df))
            t = tick("insight_generation", t)

            pipeline = {
                "insights": {"generated": len(insights), "opportunities_scored": len(opps.get("opportunities", []))},
                "ingestion": {"records_received": clean_stats["records_received"], "columns_recognized": report.recognized,
                              "columns_ignored": report.ignored, "missing_optional": report.missing_optional,
                              "warnings": report.warnings},
                "cleaning": clean_stats,
                "features": fs.stats,
                "clustering": cr.stats,
                "topics": {"topics_generated": len(named), "lexicon_labels": sum(1 for n in named if n["label_method"].startswith("lexicon")),
                           "fallback_labels": sum(1 for n in named if n["label_method"] == "top-terms")},
                "engagement": eng_meta,
                "market": {"loaded": self.market_df is not None, "topics": len(market),
                           "rows": int(len(self.market_df)) if self.market_df is not None else 0,
                           "warnings": self.market_warnings},
                "timings_ms": timings,
                "total_ms": round(sum(timings.values()), 1),
                "preprocessing_example": preprocessing_example(df),
            }

            self.k = k
            self.analysis = Analysis(
                run_id=uuid.uuid4().hex[:10], ran_at=_now(), k=k, df=df, X=fs.matrix, vectorizer=fs.vectorizer,
                terms=fs.terms, global_mean=global_mean, centroids=cr.centroids, topics=topics, topic_names=names,
                scatter=scatter, engagement_meta=eng_meta, engagement=eng, trends=trends, keywords=kw,
                market=market, opportunities=opps, insights=insights, pipeline=pipeline,
            )
            self.last_error = None
            self._persist_processed(df, k)
            return self.status()

    def _persist_processed(self, df: pd.DataFrame, k: int) -> None:
        try:
            out = df[["id", "date", "platform", "title", "category", "author", "topic", "cluster",
                      "likes", "comments", "shares", "views", "engagement"]].copy()
            out["date"] = out["date"].dt.strftime("%Y-%m-%d")
            out["keywords"] = df["keywords"].map(lambda k_: ", ".join(k_))
            db.save_frame("content_processed", out)
            db.set_state("n_clusters", k)
            db.set_state("last_run", _now())
        except Exception:  # persistence is best-effort; the in-memory analysis is authoritative
            pass

    def _topic_summaries(self, df, X, cr, named, eng_meta) -> list[dict]:
        overall = float(df["engagement"].mean()) if eng_meta["available"] else None
        out = []
        n = len(df)
        for info in named:
            c = info["cluster_id"]
            sub = df[df["cluster"] == c]
            avg = float(sub["engagement"].mean()) if eng_meta["available"] and len(sub) else None
            dates = sub["date"].dropna()
            out.append({
                **info,
                "size": int(len(sub)),
                "share_pct": round(len(sub) / n * 100, 1),
                "avg_engagement": round(avg, 3) if avg is not None and not np.isnan(avg) else None,
                "median_engagement": round(float(sub["engagement"].median()), 3) if eng_meta["available"] and len(sub) else None,
                "engagement_vs_avg_pct": round((avg / overall - 1) * 100, 1) if avg and overall else None,
                "top_categories": [{"name": k, "share_pct": round(v * 100, 1)} for k, v in sub["category"].value_counts(normalize=True).head(3).items()],
                "top_platforms": [{"name": k, "share_pct": round(v * 100, 1)} for k, v in sub["platform"].value_counts(normalize=True).head(3).items()],
                "date_range": [dates.min().date().isoformat(), dates.max().date().isoformat()] if len(dates) else None,
                "representative": representative_docs(X, cr.labels, cr.centroids, df, c, 3),
            })
        out.sort(key=lambda x: x["size"], reverse=True)
        return out

    def _scatter(self, df, coords, var) -> dict:
        idx = np.arange(len(df))
        if len(idx) > config.SCATTER_MAX_POINTS:
            rng = np.random.default_rng(config.RANDOM_STATE)
            idx = np.sort(rng.choice(idx, config.SCATTER_MAX_POINTS, replace=False))
        pts = []
        for i in idx:
            r = df.iloc[i]
            e = r["engagement"]
            pts.append({"x": round(float(coords[i, 0]), 4), "y": round(float(coords[i, 1]), 4),
                        "cluster": int(r["cluster"]), "topic": r["topic"], "id": r["id"],
                        "title": r["title"], "preview": r["content"][:110],
                        "engagement": None if pd.isna(e) else round(float(e), 2)})
        return {"method": "Truncated SVD (PCA for sparse TF-IDF)", "explained_variance_pct": var,
                "points": pts, "sampled": len(idx) < len(df), "total": int(len(df))}

    # ---------------------------------------------------------------- views
    def require(self) -> Analysis:
        if self.analysis is None:
            if self.content_raw is None:
                raise DatasetError("No data loaded yet. Go to Data & Processing and load the demo data or upload a CSV.", "no_data")
            raise DatasetError("Data is loaded but not analysed yet. Run the analysis from Data & Processing.", "not_analyzed")
        return self.analysis

    def k_evaluation(self) -> list[dict]:
        a = self.require()
        if a.k_eval is None:
            a.k_eval = evaluate_k(a.X, list(range(config.MIN_CLUSTERS, 11)))
        return a.k_eval

    def status(self) -> dict:
        a = self.analysis
        return {
            "content_loaded": self.content_raw is not None,
            "market_loaded": self.market_df is not None,
            "analysis_ready": a is not None,
            "content_source": self.content_source,
            "market_source": self.market_source,
            "market_warnings": self.market_warnings,
            "validation": self.ingestion,
            "run_id": a.run_id if a else None,
            "ran_at": a.ran_at if a else None,
            "n_clusters": a.k if a else self.k,
            "records_analyzed": int(len(a.df)) if a else 0,
            "pipeline": a.pipeline if a else None,
            "engagement": a.engagement_meta if a else None,
            "last_error": self.last_error,
            "limits": {"min_clusters": config.MIN_CLUSTERS, "max_clusters": config.MAX_CLUSTERS,
                       "default_clusters": config.DEFAULT_CLUSTERS},
        }


STATE = AppState()


def load_content_upload(raw: bytes, filename: str) -> dict:
    df = read_csv_bytes(raw, filename)
    return STATE.set_content(df, {"name": filename, "kind": "upload"})


def load_market_upload(raw: bytes, filename: str) -> dict:
    df = read_csv_bytes(raw, filename)
    result = STATE.set_market(df, {"name": filename, "kind": "upload"})
    if STATE.content_raw is not None:
        STATE.run(STATE.k)
    return result
