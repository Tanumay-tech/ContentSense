// Response shapes of the ContentSense API (see backend/app/models/schemas.py).

export interface EngagementMeta {
  available: boolean;
  mode: "rate" | "interactions" | "none";
  label: string;
  unit: string;
  formula: string;
  note?: string | null;
  views_coverage_pct?: number;
  records_without_metric?: number;
}

export interface Status {
  content_loaded: boolean;
  market_loaded: boolean;
  analysis_ready: boolean;
  run_id: string | null;
  ran_at: string | null;
  n_clusters: number;
  records_analyzed: number;
  content_source: { name: string; kind: string; rows: number; loaded_at: string } | null;
  market_source: { name: string; kind: string; rows: number; topics: number; loaded_at: string; date_range: string[] } | null;
  market_warnings: string[];
  validation: { rows: number; recognized: string[]; ignored: string[]; missing_optional: string[]; warnings: string[] } | null;
  pipeline: Pipeline | null;
  engagement: EngagementMeta | null;
  last_error: string | null;
  limits: { min_clusters: number; max_clusters: number; default_clusters: number };
}

export interface Pipeline {
  ingestion: { records_received: number; columns_recognized: string[]; columns_ignored: string[]; missing_optional: string[]; warnings: string[] };
  cleaning: {
    records_received: number; missing_content: number; duplicates_removed: number; invalid_numeric_values: number;
    missing_views: number; invalid_dates: number; missing_dates: number; missing_category: number; insufficient_text: number;
    records_cleaned: number; records_removed: number; avg_tokens_per_record: number; date_range: string[] | null; ids_generated: number;
  };
  features: { documents: number; features_extracted: number; unigrams: number; bigrams: number; sparsity_pct: number; avg_terms_per_doc: number; params: Record<string, unknown> };
  clustering: { algorithm: string; clusters_generated: number; inertia: number; silhouette: number | null; iterations: number; n_init: number; random_state: number };
  topics: { topics_generated: number; lexicon_labels: number; fallback_labels: number };
  engagement: EngagementMeta;
  market: { loaded: boolean; topics: number; rows: number; warnings: string[] };
  insights: { generated: number; opportunities_scored: number };
  timings_ms: Record<string, number>;
  total_ms: number;
  preprocessing_example: { original: string; cleaned: string } | null;
}

export interface Meta {
  topics: string[];
  categories: string[];
  platforms: string[];
  date_min: string | null;
  date_max: string | null;
  engagement: EngagementMeta & { min: number | null; max: number | null; p25: number | null; p75: number | null };
  records: number;
}

export interface Insight {
  id?: string;
  kind?: string;
  tone: "positive" | "negative" | "warning" | "neutral";
  text: string;
  metric?: string | null;
  link?: string | null;
}

export interface GroupStat {
  name: string;
  records: number;
  avg_engagement: number | null;
  median_engagement: number | null;
  likes: number;
  comments: number;
  shares: number;
  views: number | null;
  vs_overall_pct: number | null;
}

export interface Term { term: string; weight: number }

export interface Topic {
  cluster_id: number;
  name: string;
  label_method: "lexicon" | "lexicon-mixed" | "top-terms";
  label_score: number;
  also_covers: string[];
  label_candidates: { label: string; score: number }[];
  top_terms: Term[];
  size: number;
  share_pct: number;
  avg_engagement: number | null;
  median_engagement: number | null;
  engagement_vs_avg_pct: number | null;
  top_categories: { name: string; share_pct: number }[];
  top_platforms: { name: string; share_pct: number }[];
  date_range: string[] | null;
  representative: { id: string; title: string; snippet: string; platform: string; engagement: number | null }[];
}

export interface Opportunity {
  rank: number;
  topic: string;
  category: string;
  keywords: string[];
  match_phrases: string[];
  phrase_matches: Record<string, number>;
  your_volume: number;
  your_share_pct: number;
  your_recent_volume: number;
  your_recent_share_pct: number | null;
  share_of_voice_pct: number;
  market_attention_pct: number;
  avg_share_of_voice_pct: number;
  your_avg_engagement: number | null;
  engagement_index: number | null;
  engagement_basis: string;
  related_records: number;
  market_score: number;
  market_growth_pct: number | null;
  market_status: string;
  market_strength: string;
  market_yoy_pct: number | null;
  coverage_level: string;
  engagement_level: string;
  momentum_level: string;
  gap: number;
  gap_level: string;
  score: number;
  band: string;
  reason: string;
  recommendation: string;
  closest_content_group: { cluster_id: number; name: string; similarity: number } | null;
  explore_term: string;
  breakdown: { formula: string; components: { name: string; value: number; weight: number; contribution: number; explanation: string }[] };
}

export interface MarketTopic {
  topic: string;
  category: string;
  keywords: string[];
  sources: string[];
  history_weeks: number;
  first_week: string;
  last_week: string;
  current_score: number;
  peak_score: number;
  growth_pct: number | null;
  growth_basis: string;
  yoy_pct: number | null;
  momentum_pct_per_week: number | null;
  recent_volume: number | null;
  status: string;
  strength: string;
  sparkline: number[];
}
