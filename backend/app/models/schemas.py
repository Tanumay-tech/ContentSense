"""Request / response models.

Core entities are typed explicitly. Analytical payloads (chart series, tables)
allow extra fields so the analytics modules can evolve without breaking the
contract; their documented keys are declared here for OpenAPI.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class Flexible(BaseModel):
    model_config = ConfigDict(extra="allow")


class ErrorResponse(BaseModel):
    detail: str
    code: str = "error"


class RunRequest(BaseModel):
    n_clusters: int = Field(5, ge=2, le=12, description="Number of K-Means clusters (topics)")


class Insight(BaseModel):
    id: str
    kind: str
    tone: str
    priority: int
    text: str
    metric: Optional[str] = None
    link: Optional[str] = None


class InsightsResponse(BaseModel):
    insights: list[Insight]
    content_trend_insights: list[dict[str, Any]] = []


class StatusResponse(Flexible):
    content_loaded: bool
    market_loaded: bool
    analysis_ready: bool
    run_id: Optional[str] = None
    n_clusters: int
    records_analyzed: int


class UploadResponse(Flexible):
    source: dict[str, Any]
    validation: Optional[dict[str, Any]] = None
    warnings: list[str] = []
    preview: list[dict[str, Any]] = []


class ContentItem(BaseModel):
    id: str
    date: Optional[str]
    platform: str
    title: str
    snippet: str
    topic: str
    category: str
    engagement: Optional[float]
    likes: int
    comments: int
    shares: int
    views: Optional[int]


class ContentPage(BaseModel):
    items: list[ContentItem]
    total: int
    page: int
    page_size: int
    pages: int
    engagement_label: str
    engagement_unit: str


class ContentDetail(ContentItem):
    content: str
    author: str
    url: Optional[str]
    cluster: int
    keywords: list[str]
    clean_text: str
    interactions: int
    topic_avg_engagement: Optional[float]
    dataset_avg_engagement: Optional[float]


class Topic(Flexible):
    cluster_id: int
    name: str
    label_method: str
    size: int
    share_pct: float
    avg_engagement: Optional[float]
    top_terms: list[dict[str, Any]]


class TopicsResponse(Flexible):
    n_clusters: int
    topics: list[Topic]
    clustering: dict[str, Any]
    features: dict[str, Any]


class Opportunity(Flexible):
    rank: int
    topic: str
    score: float
    band: str
    reason: str
    recommendation: str
    breakdown: dict[str, Any]


class OpportunitiesResponse(Flexible):
    available: bool
    opportunities: list[Opportunity] = []
