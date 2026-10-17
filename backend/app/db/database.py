"""Persistence layer (SQLAlchemy). SQLite by default; set DATABASE_URL to use
PostgreSQL or any other SQLAlchemy-supported database without code changes.

Tables
  content_raw        uploaded/demo content exactly as received (strings)
  market_raw         validated market trend rows
  content_processed  one row per cleaned record with its topic, cluster,
                     keywords and engagement (written after each analysis run)
  app_state          key/value JSON (dataset names, number of clusters, last run)
"""
from __future__ import annotations

import json

import pandas as pd
from sqlalchemy import create_engine, inspect, text

from app import config

engine = create_engine(config.DATABASE_URL, future=True)


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE IF NOT EXISTS app_state (key VARCHAR(64) PRIMARY KEY, value TEXT)"))


def save_frame(name: str, df: pd.DataFrame) -> None:
    df.to_sql(name, engine, if_exists="replace", index=False, chunksize=2000)


def load_frame(name: str) -> pd.DataFrame | None:
    if not inspect(engine).has_table(name):
        return None
    return pd.read_sql_table(name, engine)


def drop_frame(name: str) -> None:
    with engine.begin() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {name}"))


def set_state(key: str, value) -> None:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM app_state WHERE key = :k"), {"k": key})
        conn.execute(text("INSERT INTO app_state (key, value) VALUES (:k, :v)"), {"k": key, "v": json.dumps(value)})


def get_state(key: str, default=None):
    with engine.connect() as conn:
        row = conn.execute(text("SELECT value FROM app_state WHERE key = :k"), {"k": key}).fetchone()
    return json.loads(row[0]) if row else default


def clear_all() -> None:
    for t in ("content_raw", "market_raw", "content_processed"):
        drop_frame(t)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM app_state"))
