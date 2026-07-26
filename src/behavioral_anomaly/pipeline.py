"""End-to-end train and score orchestration."""

from __future__ import annotations

import pandas as pd

from .classifier import AnomalyClassifier
from .detector import IsolationForestDetector
from .explain import explain_event
from .features import engineer_features
from .sequence import SequenceDetector


class BehavioralAnomalyPipeline:
    def __init__(self, contamination: float = 0.04, use_sequence_model: bool = True):
        if use_sequence_model:
            self.detector = SequenceDetector()
        else:
            self.detector = IsolationForestDetector(contamination=contamination)
        self.classifier = AnomalyClassifier()
        self.has_classifier = False

    def fit(self, events: pd.DataFrame) -> "BehavioralAnomalyPipeline":
        features = engineer_features(events)
        self.detector.fit(features)
        anomalies = features.loc[features.is_anomaly == 1, "anomaly_type"]
        if anomalies.nunique() > 1:
            self.classifier.fit(features)
            self.has_classifier = True
        return self

    def score(self, events: pd.DataFrame) -> pd.DataFrame:
        features = engineer_features(events)
        scored = self.detector.score(features)
        if self.has_classifier:
            scored = self.classifier.predict(scored)
        else:
            scored["predicted_anomaly_type"] = "unknown"
            scored["classification_confidence"] = 0.0
        scored["explanation"] = scored.apply(lambda row: "; ".join(explain_event(row)), axis=1)
        return scored.sort_values("anomaly_score", ascending=False).reset_index(drop=True)
