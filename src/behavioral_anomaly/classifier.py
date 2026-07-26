"""Supervised anomaly family classification."""

from __future__ import annotations

import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from .features import FEATURE_COLUMNS


class AnomalyClassifier:
    def __init__(self, random_state: int = 42):
        self.model = RandomForestClassifier(n_estimators=250, class_weight="balanced", random_state=random_state)

    def fit(self, features: pd.DataFrame) -> "AnomalyClassifier":
        anomalies = features.loc[features.is_anomaly == 1]
        self.model.fit(anomalies[FEATURE_COLUMNS], anomalies.anomaly_type)
        return self

    def predict(self, features: pd.DataFrame) -> pd.DataFrame:
        result = features.copy()
        result["predicted_anomaly_type"] = self.model.predict(result[FEATURE_COLUMNS])
        result["classification_confidence"] = self.model.predict_proba(result[FEATURE_COLUMNS]).max(axis=1)
        return result
