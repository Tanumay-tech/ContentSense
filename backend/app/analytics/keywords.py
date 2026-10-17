"""Keyword intelligence: frequency vs importance.

* Frequency  = how many times a term occurs (raw counts after preprocessing).
* Importance = (average TF-IDF weight of the term in the documents that use it)
                × ln(1 + number of documents using it)
  The first factor rewards terms that dominate the documents they appear in
  (TF-IDF already down-weights terms spread across everything); the log factor
  keeps very rare terms from winning on a handful of posts. Terms must appear
  in at least max(3, 1%) of the selected documents. A frequent generic word
  ("plan", "work") therefore ranks lower than a less frequent but topical one.
* Distinctiveness (lift) = importance in the selection / importance in the
  full dataset. >1 means the term is characteristic of the selection.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer

TOKEN_PATTERN = r"(?u)\b[a-z][a-z]+\b"


def _phrase_analyzer(n: int):
    """n-grams over the lowercased text WITH stop words kept, discarding any
    n-gram that starts or ends with a stop word. This keeps natural phrases
    ("measure what matters", "short form video") instead of gluing words that
    were only adjacent after stop-word removal."""
    import re

    from app.utils.text import STOP_WORDS, normalize_raw

    word = re.compile(r"[a-z]+")

    boundary = re.compile(r"[.,;:!?()\"\u2014\u2013/]|\bbut\b|\band\b")

    def analyze(doc: str):
        out = []
        # phrases never cross punctuation or conjunctions
        for seg in boundary.split(normalize_raw(doc).lower().replace("-", " ")):
            toks = word.findall(seg)
            for i in range(len(toks) - n + 1):
                g = toks[i:i + n]
                if g[0] in STOP_WORDS or g[-1] in STOP_WORDS or any(len(t) < 2 for t in g):
                    continue
                out.append(" ".join(g))
        return out

    return analyze


def _phrases(texts: pd.Series, n: int, top: int) -> list[dict]:
    if texts.empty:
        return []
    cv = CountVectorizer(analyzer=_phrase_analyzer(n), min_df=min(2, len(texts)))
    try:
        M = cv.fit_transform(texts)
    except ValueError:
        return []
    freq = np.asarray(M.sum(axis=0)).ravel()
    docs = np.asarray((M > 0).sum(axis=0)).ravel()
    terms = cv.get_feature_names_out()
    order = np.argsort(freq)[::-1][:top]
    return [{"term": str(terms[i]), "frequency": int(freq[i]), "documents": int(docs[i]),
             "doc_share_pct": round(float(docs[i]) / len(texts) * 100, 2)} for i in order]


def _counts(texts: pd.Series, ngram: tuple[int, int], top: int, min_df: int = 2) -> list[dict]:
    if texts.empty:
        return []
    cv = CountVectorizer(ngram_range=ngram, token_pattern=TOKEN_PATTERN, min_df=min(min_df, len(texts)))
    try:
        M = cv.fit_transform(texts)
    except ValueError:
        return []
    freq = np.asarray(M.sum(axis=0)).ravel()
    docs = np.asarray((M > 0).sum(axis=0)).ravel()
    terms = cv.get_feature_names_out()
    order = np.argsort(freq)[::-1][:top]
    n = len(texts)
    return [{"term": str(terms[i]), "frequency": int(freq[i]), "documents": int(docs[i]),
             "doc_share_pct": round(float(docs[i]) / n * 100, 2)} for i in order]


def keyword_analysis(sub: pd.DataFrame, X, terms: np.ndarray, global_mean: np.ndarray, top: int = 25) -> dict:
    n = len(sub)
    if n == 0:
        return {"records": 0, "frequent": [], "important": [], "bigrams": [], "trigrams": [], "table": []}
    rows = sub["row"].to_numpy()
    Xs = X[rows]
    mean_w = np.asarray(Xs.mean(axis=0)).ravel()
    docs_w = np.asarray((Xs > 0).sum(axis=0)).ravel()
    sum_w = np.asarray(Xs.sum(axis=0)).ravel()
    min_support = max(3, int(0.01 * n)) if n >= 50 else 1
    imp_w = np.where(docs_w >= min_support, sum_w / np.maximum(docs_w, 1) * np.log1p(docs_w), 0.0)

    frequent = _counts(sub["clean_text"], (1, 1), top)
    freq_lookup = {r["term"]: r for r in _counts(sub["clean_text"], (1, 1), 5000, 1)}

    imp_idx = [i for i in np.argsort(imp_w)[::-1] if " " not in terms[i] and imp_w[i] > 0][:top]
    important = []
    for i in imp_idx:
        t = str(terms[i])
        important.append({
            "term": t, "importance": round(float(imp_w[i]) * 100, 2),
            "documents": int(docs_w[i]), "frequency": freq_lookup.get(t, {}).get("frequency", 0),
            "lift": round(float(mean_w[i] / global_mean[i]), 2) if global_mean[i] > 0 else None,
        })

    bigrams = _phrases(sub["text"], 2, 15)
    trigrams = _phrases(sub["text"], 3, 15)

    # detailed table: union of top-frequency and top-importance unigrams
    freq_rank = {r["term"]: i + 1 for i, r in enumerate(_counts(sub["clean_text"], (1, 1), 200))}
    term_index = {str(t): i for i, t in enumerate(terms)}
    imp_rank = {str(terms[i]): r + 1 for r, i in enumerate([i for i in np.argsort(imp_w)[::-1] if " " not in terms[i] and imp_w[i] > 0])}
    table_terms = list(dict.fromkeys([r["term"] for r in frequent] + [r["term"] for r in important]))
    table = []
    for t in table_terms:
        i = term_index.get(t)
        f = freq_lookup.get(t, {})
        table.append({
            "term": t,
            "frequency": f.get("frequency", 0),
            "documents": f.get("documents", 0),
            "doc_share_pct": f.get("doc_share_pct", 0.0),
            "importance": round(float(imp_w[i]) * 100, 2) if i is not None and imp_w[i] > 0 else None,
            "lift": round(float(mean_w[i] / global_mean[i]), 2) if i is not None and global_mean[i] > 0 else None,
            "frequency_rank": freq_rank.get(t),
            "importance_rank": imp_rank.get(t),
        })
    table.sort(key=lambda r: (r["importance"] or 0), reverse=True)

    # terms that are frequent but NOT informative, to teach the difference
    common_low_info = sorted([r for r in table if r["frequency_rank"] and r["frequency_rank"] <= 20
                              and (r["importance_rank"] is None or r["importance_rank"] > 40)],
                             key=lambda r: r["frequency_rank"])[:5]

    return {"records": int(n), "frequent": frequent, "important": important, "bigrams": bigrams,
            "trigrams": trigrams, "table": table, "frequent_not_important": common_low_info,
            "min_support": int(min_support)}


def keywords_by_group(df: pd.DataFrame, X, terms: np.ndarray, by: str, top: int = 8, max_groups: int = 12) -> list[dict]:
    out = []
    groups = df[by].value_counts().head(max_groups).index
    for g in groups:
        sub = df[df[by] == g]
        Xg = X[sub["row"].to_numpy()]
        docs_g = np.asarray((Xg > 0).sum(axis=0)).ravel()
        sup = max(3, int(0.02 * len(sub)))
        mean_w = np.where(docs_g >= sup, np.asarray(Xg.sum(axis=0)).ravel() / np.maximum(docs_g, 1), 0.0)
        mean_w = mean_w * np.log1p(docs_g)  # favour terms that are both characteristic and used
        idx = [i for i in np.argsort(mean_w)[::-1] if " " not in terms[i] and mean_w[i] > 0][:top]
        counts = {r["term"]: r["frequency"] for r in _counts(sub["clean_text"], (1, 1), 3000, 1)}
        out.append({"group": str(g), "records": int(len(sub)),
                    "keywords": [{"term": str(terms[i]), "importance": round(float(mean_w[i]) * 100, 2),
                                  "frequency": counts.get(str(terms[i]), 0)} for i in idx]})
    return out
