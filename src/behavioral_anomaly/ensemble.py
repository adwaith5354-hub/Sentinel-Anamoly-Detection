"""Rule + Isolation Forest ensemble detector.

Combines the deterministic L0 rule layer with an unsupervised Isolation Forest
on the engineered per-entity features. The rule layer carries most of the signal
(its precision is near-perfect on high-confidence signatures); the Isolation
Forest contributes a smooth, model-based anomaly score that generalises to
attack shapes the rules do not enumerate.
"""

from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

from .features import FEATURE_COLUMNS
from .rules import rule_score


def _normalize(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    spread = values.max() - values.min()
    if spread <= 1e-9:
        return np.zeros_like(values)
    return (values - values.min()) / spread


class EnsembleDetector:
    def __init__(self, contamination: float = 0.10, rule_weight: float = 0.85, random_state: int = 42):
        self.contamination = contamination
        self.rule_weight = rule_weight
        self.random_state = random_state
        self.scaler = RobustScaler()
        self.model = IsolationForest(
            contamination=contamination, random_state=random_state, n_estimators=300
        )

    def fit(self, features: pd.DataFrame) -> "EnsembleDetector":
        normal = features.loc[features.is_anomaly == 0, FEATURE_COLUMNS]
        scaled = self.scaler.fit_transform(normal)
        self.model.fit(scaled)
        return self

    def score(self, features: pd.DataFrame) -> pd.DataFrame:
        result = features.copy()
        model_raw = -self.model.score_samples(self.scaler.transform(result[FEATURE_COLUMNS]))
        rule_raw = rule_score(result)

        result["rule_score"] = rule_raw
        result["model_score"] = model_raw
        combined = self.rule_weight * _normalize(rule_raw) + (1 - self.rule_weight) * _normalize(model_raw)
        result["anomaly_score"] = combined

        threshold = np.percentile(combined, 100 * (1 - self.contamination))
        result["is_flagged"] = (combined >= threshold).astype(int)
        return result

    def save(self, path: str) -> None:
        joblib.dump(self, path)
