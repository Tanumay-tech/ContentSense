"""User content vs market comparison, content-gap detection and the
Opportunity Score.

For every market topic T (with tracked keywords K_T):

  Coverage      a record covers T if its text contains the topic name or any
                tracked keyword as a whole phrase (transparent literal match).
  Share of voice (yours)   SOV_T = records covering T / records covering any market topic
  Market attention share   ATT_T = current_score_T / sum(current_score of all topics)
  Content gap   G = clip((ATT_T - SOV_T) / ATT_T, 0, 1)
                0 = you cover it at least as much as the market cares about it,
                1 = the market cares about it and you have no coverage.
  Momentum      M = 0.5 * (current_score / 100) + 0.5 * clip((growth% + 50) / 100, 0, 1)
  Engagement    E = clip(engagement_index / 2, 0, 1), engagement_index =
                avg engagement of related records / dataset average
                (related = covering records, or the 20 most similar records by
                TF-IDF cosine if fewer than 5 records cover the topic;
                neutral 0.5 if nothing related exists)

  Opportunity Score = 100 * (0.40 * M + 0.35 * G + 0.25 * E)      (weights in config.py)
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app import config
from app.utils.text import normalize_for_match, preprocess


def _clip(x: float) -> float:
    return float(min(1.0, max(0.0, x)))


def _band(score: float) -> str:
    for threshold, label in config.OPPORTUNITY_BANDS:
        if score >= threshold:
            return label
    return config.OPPORTUNITY_BANDS[-1][1]


def coverage_label(ratio: float) -> str:
    return "Low" if ratio < 0.5 else "Moderate" if ratio < 1.0 else "High"


def engagement_label(index: float | None) -> str:
    if index is None:
        return "Unknown"
    return "High" if index >= 1.15 else "Average" if index >= 0.9 else "Below average"


def momentum_label(status: str, strength: str) -> str:
    if status in ("Emerging", "Growing") and strength in ("Very High", "High"):
        return "Very High"
    if status in ("Emerging", "Growing"):
        return "High"
    if status == "Stable":
        return "Moderate" if strength in ("Very High", "High") else "Low"
    return "Low"


def compute_opportunities(df: pd.DataFrame, X, vectorizer, centroids: np.ndarray, topic_names: dict[int, str],
                          market: list[dict], engagement_available: bool) -> dict:
    if not market:
        return {"available": False, "reason": "No market trend dataset loaded. Load the demo data or upload a market trend CSV."}
    n = len(df)
    overall_eng = float(df["engagement"].mean()) if engagement_available else None
    hay = df["match_text"]
    dated = df.dropna(subset=["date"])
    recent_cut = dated["date"].max() - pd.Timedelta(days=180) if not dated.empty else None
    recent_mask = (df["date"] >= recent_cut) if recent_cut is not None else pd.Series(False, index=df.index)
    n_recent = int(recent_mask.sum())

    rows = []
    for m in market:
        phrases = sorted({normalize_for_match(p).strip() for p in [m["topic"], *m["keywords"]] if p})
        phrases = [p for p in phrases if p]
        mask = pd.Series(False, index=df.index)
        per_phrase = {}
        for p in phrases:
            hit = hay.str.contains(" " + p + " ", regex=False)
            per_phrase[p] = int(hit.sum())
            mask |= hit
        rows.append({"m": m, "phrases": phrases, "mask": mask, "per_phrase": per_phrase})

    total_cover = sum(int(r["mask"].sum()) for r in rows) or 1
    total_attention = sum(r["m"]["current_score"] for r in rows) or 1
    avg_sov = 1 / len(rows)

    results = []
    for r in rows:
        m, mask, phrases = r["m"], r["mask"], r["phrases"]
        vol = int(mask.sum())
        sov = vol / total_cover
        att = m["current_score"] / total_attention
        gap = _clip((att - sov) / att) if att > 0 else 0.0
        ratio = sov / att if att > 0 else 0.0
        recent_vol = int((mask & recent_mask).sum())

        # --- engagement potential -------------------------------------------
        q = vectorizer.transform([preprocess(" ".join([m["topic"], *m["keywords"]]))])
        eng_basis, related_n, related_eng, eng_index = "Engagement data unavailable", 0, None, None
        if engagement_available:
            if vol >= config.MIN_MATCHED_DOCS_FOR_ENGAGEMENT:
                related_eng = float(df.loc[mask, "engagement"].mean())
                related_n = vol
                eng_basis = f"Average of {vol} records that mention this topic"
            elif q.nnz:
                sims = np.asarray((X @ q.T).todense()).ravel()
                order = [i for i in np.argsort(sims)[::-1][:config.RELATED_DOCS_FALLBACK] if sims[i] >= config.RELATED_SIMILARITY_MIN]
                if len(order) >= 3:
                    related_eng = float(df.iloc[order]["engagement"].mean())
                    related_n = len(order)
                    eng_basis = f"Estimated from the {len(order)} most similar records (TF-IDF cosine similarity)"
            if related_eng is not None and not np.isnan(related_eng) and overall_eng:
                eng_index = related_eng / overall_eng
            else:
                eng_basis = "No related content found; neutral value used"
        E = _clip(eng_index / 2) if eng_index is not None else 0.5

        strength_norm = m["current_score"] / 100
        growth = m["growth_pct"]
        growth_norm = _clip((growth + 50) / 100) if growth is not None else 0.5
        M = 0.5 * strength_norm + 0.5 * growth_norm
        w = config.OPPORTUNITY_WEIGHTS
        score = 100 * (w["momentum"] * M + w["gap"] * gap + w["engagement"] * E)
        score = round(score, 1)
        band = _band(score)

        # closest content group (cluster) for navigation
        closest = None
        if q.nnz:
            cs = centroids @ np.asarray(q.todense()).ravel()
            ci = int(np.argmax(cs))
            closest = {"cluster_id": ci, "name": topic_names.get(ci), "similarity": round(float(cs[ci]), 3)}

        explore_term = max(r["per_phrase"], key=r["per_phrase"].get) if vol else (m["keywords"][0] if m["keywords"] else m["topic"])

        cov_l = coverage_label(ratio)
        eng_l = engagement_label(eng_index)
        mom_l = momentum_label(m["status"], m["strength"])
        reasons = []
        if m["status"] in ("Emerging", "Growing"):
            reasons.append(f"{m['status'].lower()} market interest ({'+' if (growth or 0) >= 0 else ''}{growth if growth is not None else 0:.0f}% vs 12 weeks earlier)")
        elif m["status"] == "Declining":
            reasons.append(f"declining market interest ({growth:.0f}%)")
        else:
            reasons.append("stable market interest")
        reasons.append(f"{cov_l.lower()} coverage in your content ({vol} records, {sov * 100:.1f}% share of voice vs {att * 100:.1f}% market attention)")
        if eng_index is not None:
            reasons.append(f"related content engagement {eng_index:.2f}× the dataset average")
        reason = "; ".join(reasons).capitalize() + "."

        if band == "Strong Opportunity":
            rec = f"{m['topic']} appears to be {'an' if m['status'][0] in 'AEIOU' else 'a'} {m['status'].lower()} market topic while your current coverage is limited. Consider exploring it for future content."
        elif band == "Moderate Opportunity":
            rec = f"{m['topic']} shows {mom_l.lower()} market momentum; it may be a potential area for increased coverage."
        elif band == "Worth Monitoring":
            rec = f"{m['topic']} is worth monitoring. Current signals do not yet point to a clear gap."
        else:
            rec = f"{m['topic']} is a lower priority right now: " + ("you already cover it well." if cov_l == "High" else "market momentum is limited.")
        if eng_index is not None and eng_index >= 1.15 and band != "Low Priority":
            rec += " Related content historically receives stronger engagement, which increases the potential value of additional coverage."

        results.append({
            "topic": m["topic"], "category": m["category"], "keywords": m["keywords"], "match_phrases": phrases,
            "phrase_matches": r["per_phrase"],
            "your_volume": vol, "your_share_pct": round(vol / max(1, n) * 100, 2),
            "your_recent_volume": recent_vol, "your_recent_share_pct": round(recent_vol / max(1, n_recent) * 100, 2) if n_recent else None,
            "share_of_voice_pct": round(sov * 100, 2), "market_attention_pct": round(att * 100, 2),
            "avg_share_of_voice_pct": round(avg_sov * 100, 2),
            "your_avg_engagement": round(related_eng, 3) if related_eng is not None else None,
            "engagement_index": round(eng_index, 2) if eng_index is not None else None,
            "engagement_basis": eng_basis, "related_records": related_n,
            "market_score": m["current_score"], "market_growth_pct": growth, "market_status": m["status"],
            "market_strength": m["strength"], "market_yoy_pct": m["yoy_pct"],
            "coverage_level": cov_l, "engagement_level": eng_l, "momentum_level": mom_l,
            "gap": round(gap, 3), "gap_level": "Large" if gap >= 0.6 else "Medium" if gap >= 0.3 else "Small",
            "score": score, "band": band, "reason": reason, "recommendation": rec,
            "closest_content_group": closest, "explore_term": explore_term,
            "breakdown": {
                "formula": "Score = 100 × (0.40 × Momentum + 0.35 × Gap + 0.25 × Engagement Potential)",
                "components": [
                    {"name": "Market Momentum", "value": round(M, 3), "weight": w["momentum"],
                     "contribution": round(100 * w["momentum"] * M, 1),
                     "explanation": f"0.5 × strength ({m['current_score']:.0f}/100) + 0.5 × growth factor "
                                    f"({'n/a' if growth is None else f'{growth:+.1f}%'} → {growth_norm:.2f})"},
                    {"name": "Content Gap", "value": round(gap, 3), "weight": w["gap"],
                     "contribution": round(100 * w["gap"] * gap, 1),
                     "explanation": f"Market attention {att * 100:.1f}% vs your share of voice {sov * 100:.1f}% → gap {gap:.2f}"},
                    {"name": "Engagement Potential", "value": round(E, 3), "weight": w["engagement"],
                     "contribution": round(100 * w["engagement"] * E, 1),
                     "explanation": (f"Related engagement index {eng_index:.2f} ÷ 2 (capped at 1). {eng_basis}."
                                     if eng_index is not None else f"{eng_basis}.")},
                ],
            },
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1
    return {
        "available": True,
        "opportunities": results,
        "strong_count": sum(1 for r in results if r["band"] == "Strong Opportunity"),
        "detected_count": sum(1 for r in results if r["band"] in ("Strong Opportunity", "Moderate Opportunity")),
        "weights": config.OPPORTUNITY_WEIGHTS,
        "bands": [{"min": t, "label": l} for t, l in config.OPPORTUNITY_BANDS],
        "recent_window_days": 180,
        "disclaimer": "Opportunity scores are decision-support signals derived from your data and the loaded market dataset. "
                      "They are suggestions to evaluate, not instructions or guaranteed outcomes.",
    }
