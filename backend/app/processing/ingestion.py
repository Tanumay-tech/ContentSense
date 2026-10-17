"""Stage 1 - Ingestion & validation.

Reads user-supplied CSV bytes, normalises column names and validates the
schema. Raises DatasetError with a human-readable message on failure.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import pandas as pd

from app import config

CONTENT_COLUMNS = ["id", "date", "platform", "title", "content", "category", "author",
                   "likes", "comments", "shares", "views", "url"]
REQUIRED_CONTENT = ["content"]
RECOMMENDED_CONTENT = ["date"]

# common alternative header names -> canonical name
CONTENT_ALIASES = {
    "text": "content", "body": "content", "message": "content", "post": "content",
    "caption": "content", "description": "content", "post_text": "content", "content_text": "content",
    "published": "date", "published_at": "date", "created_at": "date", "timestamp": "date", "post_date": "date",
    "channel": "platform", "network": "platform", "source": "platform",
    "headline": "title", "subject": "title",
    "topic_category": "category", "type": "category",
    "reactions": "likes", "like_count": "likes", "comment_count": "comments", "retweets": "shares",
    "reposts": "shares", "share_count": "shares", "impressions": "views", "reach": "views", "view_count": "views",
    "link": "url", "permalink": "url", "creator": "author", "user": "author",
}

MARKET_COLUMNS = ["topic", "keyword", "date", "trend_score", "volume", "growth_rate", "source", "category"]
REQUIRED_MARKET = ["topic", "date", "trend_score"]
MARKET_ALIASES = {
    "score": "trend_score", "interest": "trend_score", "index": "trend_score", "trend": "trend_score",
    "term": "keyword", "query": "keyword", "week": "date", "period": "date", "searches": "volume",
    "growth": "growth_rate", "theme": "topic",
}


class DatasetError(ValueError):
    """Validation error with a message that is safe to show to users.

    code: invalid_data | no_data | not_analyzed | insufficient_data
    """

    def __init__(self, message: str, code: str = "invalid_data") -> None:
        super().__init__(message)
        self.code = code


@dataclass
class IngestionReport:
    rows: int
    columns: list[str]
    recognized: list[str]
    ignored: list[str]
    missing_optional: list[str]
    warnings: list[str] = field(default_factory=list)


def _canon(col: str) -> str:
    return str(col).strip().lower().replace(" ", "_").replace("-", "_")


def read_csv_bytes(raw: bytes, filename: str | None = None) -> pd.DataFrame:
    if not raw or not raw.strip():
        raise DatasetError("The uploaded file is empty.")
    if len(raw) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise DatasetError(f"The file is larger than {config.MAX_UPLOAD_MB} MB. Please upload a smaller extract.")
    if filename and not filename.lower().endswith((".csv", ".txt")):
        raise DatasetError("Please upload a .csv file.")
    for enc in ("utf-8-sig", "latin-1"):
        try:
            df = pd.read_csv(io.BytesIO(raw), dtype=str, keep_default_na=False, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
        except (pd.errors.ParserError, pd.errors.EmptyDataError) as exc:
            raise DatasetError(f"We couldn't read this file as CSV ({exc.__class__.__name__}). "
                               "Check that it is comma-separated with a single header row.") from exc
    else:  # pragma: no cover
        raise DatasetError("We couldn't decode this file. Please save it as UTF-8 CSV.")
    if df.shape[1] <= 1 and df.shape[0] > 0 and ";" in df.columns[0]:
        raise DatasetError("This file looks semicolon-separated. Please export it as comma-separated CSV.")
    if len(df) == 0:
        raise DatasetError("The file has a header but no data rows.")
    if len(df) > config.MAX_ROWS:
        raise DatasetError(f"The file has {len(df):,} rows; the limit is {config.MAX_ROWS:,}. Please upload a sample.")
    return df


def _rename(df: pd.DataFrame, known: list[str], aliases: dict[str, str]) -> tuple[pd.DataFrame, list[str]]:
    mapping, ignored = {}, []
    taken = set()
    for col in df.columns:
        c = _canon(col)
        target = c if c in known else aliases.get(c)
        if target and target not in taken:
            mapping[col] = target
            taken.add(target)
        else:
            ignored.append(str(col))
    return df.rename(columns=mapping)[list(mapping.values())], ignored


def validate_content(df: pd.DataFrame) -> tuple[pd.DataFrame, IngestionReport]:
    original_cols = [str(c) for c in df.columns]
    df, ignored = _rename(df, CONTENT_COLUMNS, CONTENT_ALIASES)
    missing_req = [c for c in REQUIRED_CONTENT if c not in df.columns]
    if missing_req:
        raise DatasetError(
            "Missing required column 'content' (the text of each post/article). "
            f"Columns found: {', '.join(original_cols[:15])}. "
            "Rename your text column to 'content' or one of: text, body, message, caption."
        )
    if (df["content"].astype(str).str.strip() == "").all():
        raise DatasetError("The 'content' column is empty for every row, so there is nothing to analyse.")

    warnings = []
    if "date" not in df.columns:
        warnings.append("No 'date' column: time-based trend analysis will be unavailable.")
    if not {"likes", "comments", "shares"} & set(df.columns):
        warnings.append("No engagement columns (likes/comments/shares): engagement analysis will be unavailable.")
    elif "views" not in df.columns:
        warnings.append("No 'views' column: engagement will use the weighted-interactions fallback instead of a rate.")

    present = [c for c in CONTENT_COLUMNS if c in df.columns]
    for col in CONTENT_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    report = IngestionReport(
        rows=len(df), columns=original_cols, recognized=present, ignored=ignored,
        missing_optional=[c for c in CONTENT_COLUMNS if c not in present], warnings=warnings,
    )
    return df[CONTENT_COLUMNS], report


def validate_market(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Validate and coerce a market trend dataset. Returns (clean_df, warnings)."""
    original_cols = [str(c) for c in df.columns]
    df, _ = _rename(df, MARKET_COLUMNS, MARKET_ALIASES)
    missing = [c for c in REQUIRED_MARKET if c not in df.columns]
    if missing:
        raise DatasetError(
            f"Market trend file is missing required column(s): {', '.join(missing)}. "
            f"Required: topic, date, trend_score. Columns found: {', '.join(original_cols[:15])}."
        )
    warnings = []
    df = df.copy()
    df["topic"] = df["topic"].astype(str).str.strip()
    df = df[df["topic"] != ""]
    if "keyword" not in df.columns or (df["keyword"].astype(str).str.strip() == "").all():
        df["keyword"] = df["topic"].str.lower()
        warnings.append("No 'keyword' column: topic names will be used to match your content.")
    df["keyword"] = df["keyword"].astype(str).str.strip().str.lower()
    df.loc[df["keyword"] == "", "keyword"] = df["topic"].str.lower()
    df["date"] = pd.to_datetime(df["date"], errors="coerce", format="mixed")
    bad_dates = int(df["date"].isna().sum())
    df["trend_score"] = pd.to_numeric(df["trend_score"], errors="coerce")
    bad_scores = int(df["trend_score"].isna().sum())
    df = df.dropna(subset=["date", "trend_score"])
    if bad_dates:
        warnings.append(f"{bad_dates} row(s) with invalid dates were skipped.")
    if bad_scores:
        warnings.append(f"{bad_scores} row(s) with non-numeric trend_score were skipped.")
    if df.empty:
        raise DatasetError("No valid market trend rows remain after validation (check dates and trend_score).")
    mx = df["trend_score"].max()
    if mx > 100 or df["trend_score"].min() < 0:
        # rescale to a 0-100 index so strength thresholds stay meaningful
        lo = min(0.0, df["trend_score"].min())
        df["trend_score"] = (df["trend_score"] - lo) / (mx - lo) * 100
        warnings.append("trend_score was outside 0-100 and has been rescaled to a 0-100 index.")
    for col in ("volume", "growth_rate"):
        df[col] = pd.to_numeric(df[col], errors="coerce") if col in df.columns else float("nan")
    for col in ("source", "category"):
        if col not in df.columns:
            df[col] = ""
        df[col] = df[col].astype(str).str.strip()
    df.loc[df["source"] == "", "source"] = "User upload"
    df.loc[df["category"] == "", "category"] = "General"
    return df[MARKET_COLUMNS].sort_values(["topic", "keyword", "date"]).reset_index(drop=True), warnings
