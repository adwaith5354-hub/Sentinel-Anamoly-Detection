"""Unsupervised baseline anomaly detector."""

from __future__ import annotations

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

from .features import FEATURE_COLUMNS


class IsolationForestDetector:
    def __init__(self, contamination: float = 0.04, random_state: int = 42):
        self.scaler = RobustScaler()
        self.model = IsolationForest(contamination=contamination, random_state=random_state, n_estimators=200)

    def fit(self, features: pd.DataFrame) -> "IsolationForestDetector":
        normal = features.loc[features.is_anomaly == 0, FEATURE_COLUMNS]
        self.model.fit(self.scaler.fit_transform(normal))
        return self

    def score(self, features: pd.DataFrame) -> pd.DataFrame:
        result = features.copy()
        raw = -self.model.score_samples(self.scaler.transform(result[FEATURE_COLUMNS]))
        result["anomaly_score"] = (raw - raw.min()) / max(raw.max() - raw.min(), 1e-9)
        result["is_flagged"] = (self.model.predict(self.scaler.transform(result[FEATURE_COLUMNS])) == -1).astype(int)
        return result

    def save(self, path: str) -> None:
        joblib.dump(self, path)
