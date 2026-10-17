"""Stage 4 - Clustering with K-Means on TF-IDF vectors, plus a 2-D projection
for visualisation and a k-evaluation helper (elbow + silhouette)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import sparse
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics import silhouette_score

from app import config
from app.processing.ingestion import DatasetError


@dataclass
class ClusterResult:
    model: KMeans
    labels: np.ndarray
    centroids: np.ndarray
    stats: dict


def check_cluster_feasible(n_docs: int, k: int) -> None:
    if k < config.MIN_CLUSTERS or k > config.MAX_CLUSTERS:
        raise DatasetError(f"Number of topics must be between {config.MIN_CLUSTERS} and {config.MAX_CLUSTERS}.")
    need = max(10, k * config.MIN_DOCS_PER_CLUSTER)
    if n_docs < need:
        raise DatasetError(
            f"Not enough records for clustering: {k} topics need at least {need} usable records, "
            f"but only {n_docs} remain after cleaning. Upload more content or choose fewer topics.",
            "insufficient_data",
        )


def run_kmeans(X: sparse.csr_matrix, k: int) -> ClusterResult:
    check_cluster_feasible(X.shape[0], k)
    km = KMeans(n_clusters=k, init="k-means++", n_init=config.KMEANS_N_INIT,
                max_iter=300, random_state=config.RANDOM_STATE)
    labels = km.fit_predict(X)
    sil = _silhouette(X, labels)
    stats = {
        "algorithm": "K-Means (k-means++ init)",
        "clusters_generated": int(k),
        "inertia": round(float(km.inertia_), 2),
        "silhouette": sil,
        "iterations": int(km.n_iter_),
        "n_init": config.KMEANS_N_INIT,
        "random_state": config.RANDOM_STATE,
    }
    return ClusterResult(km, labels, km.cluster_centers_, stats)


def _silhouette(X, labels, sample: int = 2000) -> float | None:
    if len(set(labels)) < 2:
        return None
    try:
        return round(float(silhouette_score(X, labels, metric="cosine",
                                            sample_size=min(sample, X.shape[0]),
                                            random_state=config.RANDOM_STATE)), 4)
    except ValueError:
        return None


def project_2d(X: sparse.csr_matrix) -> tuple[np.ndarray, list[float]]:
    """Truncated SVD (the sparse-friendly equivalent of PCA / LSA)."""
    if X.shape[1] < 3:
        return np.zeros((X.shape[0], 2)), [0.0, 0.0]
    svd = TruncatedSVD(n_components=2, random_state=config.RANDOM_STATE)
    coords = svd.fit_transform(X)
    return coords, [round(float(v) * 100, 2) for v in svd.explained_variance_ratio_]


def evaluate_k(X: sparse.csr_matrix, k_values: list[int]) -> list[dict]:
    out = []
    for k in k_values:
        if X.shape[0] < max(10, k * config.MIN_DOCS_PER_CLUSTER):
            continue
        km = KMeans(n_clusters=k, init="k-means++", n_init=3, random_state=config.RANDOM_STATE)
        labels = km.fit_predict(X)
        out.append({"k": k, "inertia": round(float(km.inertia_), 2), "silhouette": _silhouette(X, labels, 1500)})
    return out
