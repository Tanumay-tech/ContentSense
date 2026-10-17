"""Stage 2 - Data cleaning & text preprocessing.

Record-level cleaning (types, missing values, duplicates) followed by
text preprocessing (normalisation, tokenisation, stop words, lemmatisation).
Every decision is counted so the Data & Processing page can report it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app import config
from app.utils.text import dedupe_key, preprocess

NUMERIC = ["likes", "comments", "shares", "views"]


def clean_content(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = raw.copy()
    stats: dict = {"records_received": int(len(df))}

    for col in ["id", "platform", "title", "content", "category", "author", "url", "date"]:
        df[col] = df[col].fillna("").astype(str).str.strip()

    # --- missing content ---------------------------------------------------
    empty = df["content"] == ""
    stats["missing_content"] = int(empty.sum())
    df = df[~empty]

    # --- duplicates: same text on the same platform on the same date ---------
    key = df["content"].map(dedupe_key) + "|" + df["platform"].str.lower() + "|" + df["date"]
    dup = key.duplicated(keep="first")
    stats["duplicates_removed"] = int(dup.sum())
    df = df[~dup]

    # --- ids -----------------------------------------------------------------
    no_id = df["id"] == ""
    df.loc[no_id, "id"] = [f"R{i:06d}" for i in range(int(no_id.sum()))]
    dup_id = df["id"].duplicated(keep="first")
    if dup_id.any():
        df.loc[dup_id, "id"] = df.loc[dup_id, "id"] + "-" + pd.Series(range(int(dup_id.sum())), index=df.index[dup_id]).astype(str)
    stats["ids_generated"] = int(no_id.sum())

    # --- numeric coercion ----------------------------------------------------
    invalid_numeric = 0
    for col in NUMERIC:
        s = df[col].fillna("").astype(str).str.replace(",", "", regex=False).str.strip()
        num = pd.to_numeric(s, errors="coerce")
        bad = num.isna() & (s != "")
        neg = num < 0
        invalid_numeric += int(bad.sum() + neg.sum())
        num[neg] = np.nan
        df[col] = num
    stats["invalid_numeric_values"] = invalid_numeric
    for col in ["likes", "comments", "shares"]:
        df[col] = df[col].fillna(0).astype(float)
    stats["missing_views"] = int(df["views"].isna().sum())

    # --- dates -----------------------------------------------------------------
    parsed = pd.to_datetime(df["date"].replace("", np.nan), errors="coerce", format="mixed")
    stats["invalid_dates"] = int((parsed.isna() & (df["date"] != "")).sum())
    stats["missing_dates"] = int((df["date"] == "").sum())
    df["date"] = parsed.dt.tz_localize(None) if getattr(parsed.dt, "tz", None) is not None else parsed

    # --- categorical defaults ------------------------------------------------
    df.loc[df["platform"] == "", "platform"] = "Unknown"
    missing_cat = df["category"] == ""
    stats["missing_category"] = int(missing_cat.sum())
    df.loc[missing_cat, "category"] = "Uncategorized"
    df.loc[df["author"] == "", "author"] = "Unknown"
    no_title = df["title"] == ""
    df.loc[no_title, "title"] = df.loc[no_title, "content"].str.slice(0, 70).str.rsplit(" ", n=1).str[0] + "…"

    # --- text preprocessing --------------------------------------------------
    df["text"] = df["title"] + ". " + df["content"]
    df["clean_text"] = df["text"].map(preprocess)
    df["token_count"] = df["clean_text"].str.split().str.len().fillna(0).astype(int)
    too_short = df["token_count"] < config.MIN_TOKENS_PER_DOC
    stats["insufficient_text"] = int(too_short.sum())
    df = df[~too_short]

    df = df.reset_index(drop=True)
    stats["records_cleaned"] = int(len(df))
    stats["records_removed"] = stats["records_received"] - stats["records_cleaned"]
    stats["avg_tokens_per_record"] = round(float(df["token_count"].mean()), 1) if len(df) else 0.0
    stats["date_range"] = (
        [df["date"].min().date().isoformat(), df["date"].max().date().isoformat()]
        if df["date"].notna().any() else None
    )
    return df, stats


def preprocessing_example(df: pd.DataFrame) -> dict | None:
    """One before/after example for the methodology UI."""
    if df.empty:
        return None
    row = df.loc[df["content"].str.len().sort_values().index[len(df) // 2]]
    return {"original": row["text"], "cleaned": row["clean_text"]}
