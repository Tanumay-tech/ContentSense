"""Stage 5 - Convert clusters into human-readable topics.

Each K-Means centroid is a weight vector over TF-IDF terms. We:
  1. take the top terms of every centroid (highest weights),
  2. score each centroid against a transparent lexicon of marketing topic
     labels (sum of centroid weights of the label's seed terms),
  3. assign labels greedily (highest score first, each label used once),
  4. fall back to a name built from the cluster's own top terms when no
     label matches well enough.
The method, score and top terms are returned so the UI can show *why* a
cluster got its name.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TOPIC_LEXICON: dict[str, set[str]] = {
    "AI & Technology": {"ai", "machine", "learning", "model", "generative", "genai", "automation", "tool", "cloud",
                        "engineer", "api", "chatbot", "copilot", "algorithm", "tech", "technology", "agent",
                        "agentic", "language", "vision", "predictive", "pilot", "rollout", "innovation", "data",
                        "pipeline", "assistant", "recommendation", "responsible", "privacy"},
    "Marketing Strategy": {"marketing", "campaign", "strategy", "brand", "funnel", "seo", "search", "conversion",
                           "channel", "audience", "attribution", "positioning", "keyword", "email", "acquisition",
                           "awareness", "influencer", "optimization", "engine", "intent", "calendar", "buyer",
                           "rate", "retention", "budget", "digital", "growth", "content"},
    "Product Promotion": {"sale", "sales", "discount", "offer", "launch", "shop", "save", "code", "checkout", "order",
                          "shipping", "deal", "limited", "plan", "premium", "upgrade", "trial", "demo",
                          "collection", "bundle", "membership", "flash", "introducing", "available", "stock",
                          "shoppable", "grab"},
    "Customer Engagement": {"community", "customer", "comment", "feedback", "story", "poll", "vote", "question",
                            "thank", "review", "member", "follower", "spotlight", "live", "answer", "conversation",
                            "reply", "listened", "favorite", "win", "hack", "routine", "mentor", "feature", "ugc"},
    "Fitness & Wellness": {"fitness", "workout", "training", "strength", "running", "yoga", "recovery", "nutrition",
                           "mobility", "hiit", "wellness", "sleep", "energy", "muscle", "health", "cycling",
                           "pilate", "posture", "drill", "exercise", "heart", "injury"},
    "Travel & Lifestyle": {"travel", "trip", "flight", "packing", "hidden", "gem", "tourism", "visa", "holiday",
                           "getaway", "cafe", "eat", "stay", "wander", "wanderlust", "lisbon", "kyoto", "iceland",
                           "bali", "season", "carry", "local", "photo", "diary"},
    "Personal Finance": {"finance", "money", "budgeting", "budget", "fund", "index", "retirement", "credit",
                         "score", "income", "inflation", "interest", "saving", "invoicing", "tax", "cash", "flow",
                         "fintech", "fee", "freelancer", "emergency", "account", "personal", "graduate"},
    "Sustainability": {"sustainability", "sustainable", "carbon", "emission", "plastic", "waste", "circular",
                       "renewable", "climate", "green", "greenwashing", "packaging", "supply", "chain", "supplier",
                       "water", "landfill", "energy", "report", "material", "action"},
    "Education & Learning": {"learn", "learning", "guide", "template", "course", "tutorial", "skill", "beginner",
                             "checklist", "practice", "cheat", "sheet", "concept", "mistake", "analysis",
                             "copywriting", "speaking", "sql", "editing", "spreadsheet", "modeling", "free",
                             "step", "lifelong", "mini", "save"},
    "Entertainment & Media": {"podcast", "episode", "music", "playlist", "film", "gaming", "stream", "comedy",
                              "sketch", "movie", "watch", "song", "blooper", "reel", "pop", "culture", "viral",
                              "challenge", "guest", "weekend", "friday", "entertainment", "laughed", "shoot"},
    "Social Video & Creators": {"video", "reel", "reels", "tiktok", "creator", "ugc", "short", "form", "influencer",
                                "youtube", "partnership", "ambassador", "economy"},
    "Business & Leadership": {"business", "team", "leadership", "startup", "hiring", "remote", "revenue",
                              "company", "founder", "owner", "client", "operation", "b2b", "decision", "maker"},
}
SHORT_NAMES = {
    "AI & Technology": "AI & Tech", "Marketing Strategy": "Marketing", "Product Promotion": "Promotions",
    "Customer Engagement": "Community", "Fitness & Wellness": "Fitness", "Travel & Lifestyle": "Travel",
    "Personal Finance": "Finance", "Sustainability": "Sustainability", "Education & Learning": "Education",
    "Entertainment & Media": "Entertainment", "Social Video & Creators": "Creators", "Business & Leadership": "Business",
}
MIN_LABEL_SHARE = 0.10   # share of a centroid's top-term weight a label must explain
MIXED_RATIO = 0.4        # a 2nd label scoring >= 40% of the 1st makes the cluster "mixed"
TOP_N_FOR_LABEL = 40


def _term_tokens(term: str) -> list[str]:
    return term.split()


def label_scores(centroid: np.ndarray, terms: np.ndarray) -> dict[str, float]:
    idx = np.argsort(centroid)[::-1][:TOP_N_FOR_LABEL]
    total = float(centroid[idx].sum()) or 1.0
    scores = {}
    for label, seeds in TOPIC_LEXICON.items():
        s = 0.0
        for j in idx:
            toks = _term_tokens(str(terms[j]))
            if any(t in seeds for t in toks):
                s += float(centroid[j])
        scores[label] = s / total
    return scores


def _fallback_name(top_terms: list[str], used: set[str]) -> str:
    words = []
    for t in top_terms:
        for w in t.split():
            if w not in words:
                words.append(w)
        if len(words) >= 2:
            break
    name = " & ".join(w.upper() if w in {"ai", "seo", "ugc", "sql"} else w.capitalize() for w in words[:2]) or "Mixed Content"
    base, i = name, 2
    while name in used:
        name = f"{base} ({i})"
        i += 1
    return name


def name_clusters(centroids: np.ndarray, terms: np.ndarray, top_k: int = 12) -> list[dict]:
    k = centroids.shape[0]
    tops, score_rows = [], []
    for c in range(k):
        idx = np.argsort(centroids[c])[::-1][:top_k]
        tops.append([{"term": str(terms[j]), "weight": round(float(centroids[c][j]), 4)} for j in idx])
        score_rows.append(label_scores(centroids[c], terms))

    # greedy global assignment: best (cluster, label) pair first
    pairs = sorted(((score_rows[c][lab], c, lab) for c in range(k) for lab in TOPIC_LEXICON), reverse=True)
    assigned: dict[int, tuple[str, float]] = {}
    used: set[str] = set()
    for score, c, lab in pairs:
        if c in assigned or lab in used or score < MIN_LABEL_SHARE:
            continue
        assigned[c] = (lab, score)
        used.add(lab)

    out = []
    for c in range(k):
        top_terms = [t["term"] for t in tops[c]]
        ranked = sorted(score_rows[c].items(), key=lambda x: x[1], reverse=True)
        if c in assigned:
            name, score = assigned[c]
            method = "lexicon"
            second = next(((lab, sc) for lab, sc in ranked if lab != name), None)
            if second and second[1] >= MIXED_RATIO * score and second[1] >= MIN_LABEL_SHARE:
                # mixed cluster: say so in the name instead of hiding the second theme
                name = f"{SHORT_NAMES[name]} & {SHORT_NAMES[second[0]]}"
                method = "lexicon-mixed"
        else:
            name = _fallback_name(top_terms, used)
            used.add(name)
            score = ranked[0][1]
            method = "top-terms"
        also = [lab for lab, s in ranked if lab != name and s >= 0.5 * max(score, 1e-9) and s >= MIN_LABEL_SHARE][:2]
        out.append({
            "cluster_id": c,
            "name": name,
            "label_method": method,
            "label_score": round(float(score), 3),
            "also_covers": also,
            "top_terms": tops[c],
            "label_candidates": [{"label": lab, "score": round(float(s), 3)} for lab, s in ranked[:3]],
        })
    return out


def representative_docs(X, labels: np.ndarray, centroids: np.ndarray, df: pd.DataFrame, cluster: int, n: int = 3) -> list[dict]:
    idx = np.where(labels == cluster)[0]
    if len(idx) == 0:
        return []
    sims = X[idx] @ centroids[cluster]
    order = idx[np.argsort(np.asarray(sims).ravel())[::-1][:n]]
    rows = []
    for i in order:
        r = df.iloc[i]
        rows.append({"id": r["id"], "title": r["title"], "snippet": r["content"][:180],
                     "platform": r["platform"], "engagement": _f(r.get("engagement"))})
    return rows


def _f(v):
    try:
        v = float(v)
        return None if np.isnan(v) else round(v, 3)
    except (TypeError, ValueError):
        return None
