"""Shared route helpers: filter parsing and per-run caching."""
from __future__ import annotations

from typing import Callable, Optional

from fastapi import Query

from app.core.state import STATE, Analysis
from app.utils.filters import Filters

CACHE_LIMIT = 128


def filters_dep(
    q: Optional[str] = Query(None, description="Keyword search (word-prefix match)"),
    topic: Optional[str] = Query(None, description="Topic name(s), comma-separated"),
    category: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="YYYY-MM-DD"),
    min_engagement: Optional[float] = Query(None),
    max_engagement: Optional[float] = Query(None),
) -> Filters:
    return Filters(q, topic, category, platform, start, end, min_engagement, max_engagement)


def cached(a: Analysis, key: tuple, fn: Callable):
    if key in a.cache:
        return a.cache[key]
    val = fn()
    if len(a.cache) > CACHE_LIMIT:
        a.cache.clear()
    a.cache[key] = val
    return val


def analysis() -> Analysis:
    return STATE.require()
