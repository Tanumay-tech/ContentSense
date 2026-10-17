"""Stage 3 - Feature extraction with TF-IDF.

TF-IDF(t, d) = tf(t, d) * idf(t),  idf(t) = ln((1 + N) / (1 + df(t))) + 1
with sublinear tf (1 + ln tf) and L2-normalised document vectors, so that the
Euclidean distance used by K-Means behaves like cosine distance.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

from app import config


@dataclass
class FeatureSet:
    vectorizer: TfidfVectorizer
    matrix: sparse.csr_matrix
    terms: np.ndarray
    stats: dict


def extract_features(df: pd.DataFrame) -> FeatureSet:
    n = len(df)
    min_df = config.TFIDF_MIN_DF if n >= 50 else 1
    max_df = config.TFIDF_MAX_DF if n >= 50 else 1.0
    vec = TfidfVectorizer(
        ngram_range=config.TFIDF_NGRAM_RANGE,
        max_features=config.TFIDF_MAX_FEATURES,
        min_df=min_df,
        max_df=max_df,
        sublinear_tf=True,
        norm="l2",
        token_pattern=r"(?u)\b[a-z][a-z]+\b",
    )
    try:
        X = vec.fit_transform(df["clean_text"])
    except ValueError:
        # vocabulary empty after pruning -> relax constraints
        vec.set_params(min_df=1, max_df=1.0)
        X = vec.fit_transform(df["clean_text"])
    terms = vec.get_feature_names_out()
    nnz = X.nnz
    stats = {
        "documents": int(X.shape[0]),
        "features_extracted": int(X.shape[1]),
        "unigrams": int(sum(1 for t in terms if " " not in t)),
        "bigrams": int(sum(1 for t in terms if " " in t)),
        "sparsity_pct": round(100 * (1 - nnz / max(1, X.shape[0] * X.shape[1])), 2),
        "avg_terms_per_doc": round(nnz / max(1, X.shape[0]), 1),
        "params": {"ngram_range": list(config.TFIDF_NGRAM_RANGE), "min_df": min_df, "max_df": max_df,
                   "max_features": config.TFIDF_MAX_FEATURES, "sublinear_tf": True, "norm": "l2"},
    }
    return FeatureSet(vec, X.tocsr(), terms, stats)


def top_terms_per_doc(X: sparse.csr_matrix, terms: np.ndarray, k: int = 6,
                      raw_texts: list[str] | None = None) -> list[list[str]]:
    """Top TF-IDF terms of each record.

    A two-word feature is only shown as a keyword when it occurs as a real,
    contiguous phrase in that record's original text (e.g. "machine learning"),
    not when the words merely became neighbours after stop-word removal.
    """
    from app.utils.text import lemmatize, normalize_for_match

    out = []
    for i in range(X.shape[0]):
        row = X.getrow(i)
        if row.nnz == 0:
            out.append([])
            continue
        raw = None
        if raw_texts is not None:
            # phrases may not cross sentence punctuation
            segs = re.split(r"[.,;:!?()]+", raw_texts[i])
            raw = " | ".join(" ".join(lemmatize(w) for w in normalize_for_match(seg).split()) for seg in segs)
            raw = " " + raw + " "
        picked = []
        for j in row.indices[np.argsort(row.data)[::-1]]:
            t = str(terms[j])
            if " " in t and raw is not None and f" {t} " not in raw:
                continue
            picked.append(t)
            if len(picked) == k:
                break
        out.append(picked)
    return out
