"""Shared filtering used by Content Explorer, Keywords, Engagement and Trends."""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from app.utils.text import normalize_for_match


@dataclass(frozen=True)
class Filters:
    q: str | None = None
    topic: str | None = None
    category: str | None = None
    platform: str | None = None
    start: str | None = None
    end: str | None = None
    min_engagement: float | None = None
    max_engagement: float | None = None

    def key(self) -> tuple:
        return (self.q, self.topic, self.category, self.platform, self.start, self.end,
                self.min_engagement, self.max_engagement)


def _multi(value: str | None) -> list[str]:
    return [v for v in (value or "").split(",") if v.strip()] if value else []


def apply_filters(df: pd.DataFrame, f: Filters) -> pd.DataFrame:
    mask = pd.Series(True, index=df.index)
    if f.topic:
        mask &= df["topic"].isin(_multi(f.topic))
    if f.category:
        mask &= df["category"].isin(_multi(f.category))
    if f.platform:
        mask &= df["platform"].isin(_multi(f.platform))
    if f.start:
        mask &= df["date"] >= pd.to_datetime(f.start, errors="coerce")
    if f.end:
        end = pd.to_datetime(f.end, errors="coerce")
        if pd.notna(end):
            mask &= df["date"] < end + pd.Timedelta(days=1)
    if f.min_engagement is not None:
        mask &= df["engagement"] >= f.min_engagement
    if f.max_engagement is not None:
        mask &= df["engagement"] <= f.max_engagement
    if f.q and f.q.strip():
        needle = normalize_for_match(f.q).strip()
        if needle:
            hay = df["match_text"]
            # word-prefix match: "market" finds "marketing", "ai" finds "ai agents"
            mask &= hay.str.contains(" " + needle, regex=False) | (df["id"].str.lower() == f.q.strip().lower())
    return df[mask]
