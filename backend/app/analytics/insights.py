"""Rule-based business insight engine.

Every insight is computed from pipeline outputs and carries the metric it is
based on, so nothing is fabricated. Rules only fire when their data exists
and passes minimum-support checks.
"""
from __future__ import annotations


def _fmt_pct(v: float) -> str:
    return f"{abs(v):.0f}%"


def generate_insights(topics: list[dict], engagement: dict, trends: dict, opportunities: dict,
                      keywords: dict | None, n_records: int) -> list[dict]:
    out: list[dict] = []

    # 1. dominant topic
    if topics:
        t = max(topics, key=lambda x: x["size"])
        out.append({"id": "dominant_topic", "kind": "topic", "tone": "neutral", "priority": 1,
                    "text": f"{t['name']} represents {t['share_pct']:.0f}% of analyzed content.",
                    "metric": f"{t['size']:,} of {n_records:,} records", "link": "/topics"})

    # 2. engagement: category comparison and best topic
    if engagement.get("available"):
        unit = engagement["meta"]["unit"]
        cats = [c for c in engagement["by_category"] if c["records"] >= 15 and c["avg_engagement"]]
        if len(cats) >= 2:
            best, worst = cats[0], cats[-1]
            diff = (best["avg_engagement"] / worst["avg_engagement"] - 1) * 100
            out.append({"id": "category_engagement", "kind": "engagement", "tone": "positive", "priority": 2,
                        "text": f"{best['name']} content has {_fmt_pct(diff)} higher average engagement than {worst['name']} content.",
                        "metric": f"{best['avg_engagement']:.2f}{unit} vs {worst['avg_engagement']:.2f}{unit}", "link": "/engagement"})
            out.append({"id": "lowest_category", "kind": "engagement", "tone": "warning", "priority": 7,
                        "text": f"{worst['name']} is the lowest-performing category, {_fmt_pct(worst['vs_overall_pct'] or 0)} below the dataset average.",
                        "metric": f"{worst['records']} records · avg {worst['avg_engagement']:.2f}{unit}", "link": "/engagement"})
        tops = [t for t in engagement["by_topic"] if t["records"] >= 10 and t["vs_overall_pct"] is not None]
        if tops:
            bt = tops[0]
            out.append({"id": "best_topic_engagement", "kind": "engagement", "tone": "positive", "priority": 5,
                        "text": f"{bt['name']} is the highest-engagement topic, {_fmt_pct(bt['vs_overall_pct'])} "
                                f"{'above' if bt['vs_overall_pct'] >= 0 else 'below'} the dataset average.",
                        "metric": f"avg {bt['avg_engagement']:.2f}{unit} across {bt['records']} records", "link": "/engagement"})

    # 3. fastest growing topic in own content
    if trends.get("available") and trends.get("comparison_available"):
        grow = [t for t in trends["topic_trends"] if t["direction"] == "Increasing" and t["change_pct"] is not None]
        if grow:
            g = max(grow, key=lambda r: r["change_pct"])
            out.append({"id": "fastest_growing_topic", "kind": "trend", "tone": "positive", "priority": 4,
                        "text": f"{g['name']} is your fastest-growing topic, up {g['change_pct']:.0f}% in the second half of the period.",
                        "metric": f"{g['first_half']} → {g['second_half']} records", "link": "/trends"})
        v, e = trends.get("volume_change_pct"), trends.get("engagement_change_pct")
        if v is not None and e is not None and v > 10 and e < -5:
            out.append({"id": "volume_vs_engagement", "kind": "trend", "tone": "warning", "priority": 6,
                        "text": f"Content volume increased {v:.0f}%, but average engagement declined {abs(e):.0f}%.",
                        "metric": "second half vs first half of the dataset", "link": "/trends"})

    # 4. market opportunity and gap
    if opportunities.get("available") and opportunities["opportunities"]:
        top = opportunities["opportunities"][0]
        out.append({"id": "top_opportunity", "kind": "market", "tone": "positive", "priority": 3,
                    "text": f"{top['topic']} is {'an' if top['market_status'][0] in 'AEIOU' else 'a'} {top['market_status'].lower()} market topic with {top['coverage_level'].lower()} coverage in your content.",
                    "metric": f"Opportunity score {top['score']:.0f}/100 · {top['band']}", "link": "/market"})
        under = [o for o in opportunities["opportunities"]
                 if o["engagement_index"] and o["engagement_index"] >= 1.15 and o["coverage_level"] == "Low" and o["your_volume"] >= 3]
        if under:
            u = max(under, key=lambda o: o["engagement_index"])
            out.append({"id": "underused_high_engagement", "kind": "gap", "tone": "positive", "priority": 5,
                        "text": f"Content mentioning {u['topic']} earns {u['engagement_index']:.1f}× the average engagement but makes up only {u['your_share_pct']:.1f}% of your content.",
                        "metric": f"{u['your_volume']} related records", "link": "/market"})

    # 5. keywords: frequency vs importance
    if keywords and keywords.get("important") and keywords.get("frequent"):
        imp, freq = keywords["important"][0]["term"], keywords["frequent"][0]["term"]
        text = (f"'{imp}' is both the most frequent and the most informative keyword." if imp == freq else
                f"'{freq}' is the most frequent keyword, but '{imp}' carries the highest TF-IDF importance.")
        out.append({"id": "keywords", "kind": "keyword", "tone": "neutral", "priority": 8, "text": text,
                    "metric": f"{keywords['frequent'][0]['frequency']:,} occurrences of '{freq}'", "link": "/keywords"})

    out.sort(key=lambda x: x["priority"])
    return out
