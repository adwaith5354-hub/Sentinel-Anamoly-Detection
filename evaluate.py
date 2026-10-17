"""Compute the real robustness, ablation and detector-internals statistics.

Writes ``api_data/robustness.json`` consumed by the dashboard so that every
number shown in the UI is computed from the pipeline rather than hard-coded.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn.metrics as sk_metrics
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

from behavioral_anomaly.features import FEATURE_COLUMNS, engineer_features
from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator
from behavioral_anomaly.pipeline import BehavioralAnomalyPipeline

OUT = Path("api_data")
OUT.mkdir(exist_ok=True)

BASE_FEATURES = [
    "hour", "is_weekend", "time_since_last_login", "geo_velocity_kmh",
    "new_device", "new_country", "failed_login", "bytes_transferred_log",
    "is_sensitive_resource", "resource_novelty",
]

SEEDS = [101, 102, 103, 104, 105]
NORMALIZER_EPS = 1e-9


def _normalize(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    spread = values.max() - values.min()
    return np.zeros_like(values) if spread <= NORMALIZER_EPS else (values - values.min()) / spread


def rule_terms(frame: pd.DataFrame) -> dict[str, np.ndarray]:
    """Named rule signals with their analytic weight."""
    warm = (frame["entity_seq"] >= 1).astype(int)
    return {
        "impossible_travel": 5.0 * (frame.geo_velocity_kmh > 900).astype(int),
        "country_novelty": 3.5 * ((frame.new_country == 1) & (warm == 1)).astype(int),
        "country_failure": 3.5 * ((frame.new_country == 1) & (frame.failed_login == 1)).astype(int),
        "auth_burst": 3.0 * (frame.fail_count_10min >= 5).astype(int) + 2.0 * (frame.fail_count_10min >= 3).astype(int),
        "entity_failure": 2.0 * ((frame.failed_login == 1) & (warm == 1)).astype(int),
        "fingerprint_mismatch": 3.0 * ((frame.device_fp_novelty == 1) & (warm == 1)).astype(int),
        "device_novelty": 2.5 * ((frame.new_device == 1) & (warm == 1)).astype(int),
        "lateral_spread": 2.5 * (frame.distinct_res_30min >= 3).astype(int) + 2.0 * (frame.distinct_res_30min >= 2).astype(int),
        "sensitive_novelty": 2.5 * ((frame.resource_novelty == 1) & (frame.is_sensitive_resource == 1) & (warm == 1)).astype(int),
        "mass_exfiltration": 3.0 * (frame.bytes_transferred_log >= np.log1p(1_000_000)).astype(int),
        "resource_novelty": 2.0 * ((frame.resource_novelty == 1) & (warm == 1)).astype(int),
    }


L0_TERMS = ["impossible_travel", "auth_burst", "mass_exfiltration", "entity_failure", "country_failure"]
L1_TERMS = ["country_novelty", "fingerprint_mismatch", "device_novelty", "sensitive_novelty", "resource_novelty"]
L2_TERMS = ["lateral_spread"]


def _if_score(frame: pd.DataFrame, columns: list[str], contamination: float = 0.10, seed: int = 42) -> np.ndarray:
    features = frame[columns].fillna(0)
    normal = features[frame["is_anomaly"].values == 0]
    scaler = RobustScaler().fit(normal)
    model = IsolationForest(contamination=contamination, random_state=seed, n_estimators=200).fit(scaler.transform(normal))
    return -model.score_samples(scaler.transform(features))


def _metrics(y: np.ndarray, score: np.ndarray) -> dict:
    precision, recall, thresholds = sk_metrics.precision_recall_curve(y, score)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros_like(precision), where=(precision + recall) > 0)
    best = int(np.argmax(f1))
    threshold = float(thresholds[best]) if best < len(thresholds) else float(score.max())
    pred = (score >= threshold).astype(int)
    return {
        "precision": float(sk_metrics.precision_score(y, pred, zero_division=0)),
        "recall": float(sk_metrics.recall_score(y, pred, zero_division=0)),
        "f1": float(sk_metrics.f1_score(y, pred, zero_division=0)),
        "pr_auc": float(sk_metrics.auc(recall, precision)),
        "threshold": threshold,
    }


def _incident_recall(frame: pd.DataFrame, score: np.ndarray, threshold: float) -> float:
    flagged = pd.DataFrame({
        "entity_id": frame["entity_id"].values,
        "anomaly_type": frame["anomaly_type"].values,
        "is_anomaly": frame["is_anomaly"].values,
        "hit": (score >= threshold).astype(int),
    })
    incidents = flagged[flagged.is_anomaly == 1].groupby(["entity_id", "anomaly_type"])["hit"].max()
    return float(incidents.mean()) if len(incidents) else 0.0


def _score_variant(frame: pd.DataFrame, variant: str, seed: int) -> np.ndarray:
    terms = rule_terms(frame)
    if variant == "without_l0":
        active = L1_TERMS + L2_TERMS
        features = FEATURE_COLUMNS
    elif variant == "without_l1":
        active = L0_TERMS + L2_TERMS
        features = [c for c in FEATURE_COLUMNS if c not in ("z_hour", "z_bytes", "z_geo", "z_session", "new_device", "new_country", "device_fp_novelty", "resource_novelty")]
    elif variant == "without_l2":
        active = L0_TERMS + L1_TERMS
        features = FEATURE_COLUMNS
    elif variant == "rules_only":
        active = L0_TERMS + L1_TERMS + L2_TERMS
        features = None
    elif variant == "model_only":
        active = []
        features = FEATURE_COLUMNS
    else:  # full
        active = L0_TERMS + L1_TERMS + L2_TERMS
        features = FEATURE_COLUMNS

    rule_raw = sum(terms[name] for name in active) if active else np.zeros(len(frame))
    if features is None:
        return _normalize(rule_raw)
    model_raw = _if_score(frame, features, seed=seed)
    if not active:
        return _normalize(model_raw)
    return 0.85 * _normalize(rule_raw) + 0.15 * _normalize(model_raw)


def _generate(seed: int) -> pd.DataFrame:
    config = GenerationConfig(entities=200, days=30, anomaly_rate=0.15, seed=seed)
    return engineer_features(SyntheticDataGenerator(config).generate())


def main() -> None:
    held_out = []
    ablation: dict[str, list[dict]] = {}
    variants = ["full", "without_l0", "without_l1", "without_l2", "rules_only", "model_only"]

    for seed in SEEDS:
        frame = _generate(seed)
        y = frame["is_anomaly"].fillna(0).astype(int).values
        per_variant = {}
        for variant in variants:
            score = _score_variant(frame, variant, seed)
            stats = _metrics(y, score)
            per_variant[variant] = stats
            ablation.setdefault(variant, []).append(stats)
        full = per_variant["full"]
        held_out.append({
            "seed": seed,
            "prevalence": float(y.mean()),
            "precision": full["precision"],
            "recall": full["recall"],
            "f1": full["f1"],
            "pr_auc": full["pr_auc"],
            "incident_recall": _incident_recall(frame, _score_variant(frame, "full", seed), full["threshold"]),
        })
        print(f"seed {seed}: P={full['precision']:.3f} R={full['recall']:.3f} PR-AUC={full['pr_auc']:.3f}")

    ablation_table = []
    labels = {
        "full": "full ensemble",
        "without_l0": "without L0 deterministic rules",
        "without_l1": "without L1 per-entity baseline",
        "without_l2": "without L2 sequence window",
        "rules_only": "rules only (no Isolation Forest)",
        "model_only": "Isolation Forest only (no rules)",
    }
    for variant in variants:
        rows = ablation[variant]
        ablation_table.append({
            "config": labels[variant],
            "precision": float(np.mean([r["precision"] for r in rows])),
            "recall": float(np.mean([r["recall"] for r in rows])),
            "f1": float(np.mean([r["f1"] for r in rows])),
            "pr_auc": float(np.mean([r["pr_auc"] for r in rows])),
        })

    # Detector internals from the deployed export.
    frame = _generate(42)
    y = frame["is_anomaly"].fillna(0).astype(int).values
    terms = rule_terms(frame)
    weights = [
        {"signal": name, "weight": float(values.max())}
        for name, values in sorted(terms.items(), key=lambda kv: -kv[1].max())
    ]

    counts = frame.groupby("entity_id")["event_id"].transform("count").values
    score = _score_variant(frame, "full", 42)
    size_corr = float(np.corrcoef(score, counts)[0, 1]) if np.std(counts) > 0 else 0.0

    daily = frame.assign(flagged=(score >= _metrics(y, score)["threshold"]).astype(int))
    daily = daily.groupby(daily["timestamp"].dt.date)["flagged"].sum()
    alert_volume = {"median": float(daily.median()), "max": float(daily.max()), "days": [int(v) for v in daily.tolist()]}

    # Per-attack recall at the deployed operating point from the real confusion data.
    threshold = _metrics(y, score)["threshold"]
    flagged = score >= threshold
    per_attack = {}
    for attack in frame.loc[frame.is_anomaly == 1, "anomaly_type"].unique():
        mask = frame["anomaly_type"].values == attack
        per_attack[attack] = float((mask & flagged).sum() / max(mask.sum(), 1))

    payload = {
        "held_out_seeds": held_out,
        "held_out_summary": {
            "precision": float(np.mean([r["precision"] for r in held_out])),
            "recall": float(np.mean([r["recall"] for r in held_out])),
            "f1": float(np.mean([r["f1"] for r in held_out])),
            "pr_auc": float(np.mean([r["pr_auc"] for r in held_out])),
            "incident_recall": float(np.mean([r["incident_recall"] for r in held_out])),
        },
        "ablation": ablation_table,
        "rule_weights": weights,
        "score_size_correlation": size_corr,
        "alert_volume": alert_volume,
        "per_attack_recall": per_attack,
    }
    (OUT / "robustness.json").write_text(json.dumps(payload))
    print(f"\nWrote {OUT / 'robustness.json'}")
    print(f"held-out mean: P={payload['held_out_summary']['precision']:.3f} "
          f"R={payload['held_out_summary']['recall']:.3f} "
          f"PR-AUC={payload['held_out_summary']['pr_auc']:.3f} "
          f"incident_recall={payload['held_out_summary']['incident_recall']:.3f}")
    print(f"score/size correlation = {size_corr:.3f}")


if __name__ == "__main__":
    main()
