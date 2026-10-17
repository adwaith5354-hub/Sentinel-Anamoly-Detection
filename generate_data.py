"""Generate the synthetic corpus, score it through the pipeline, export data.pkl."""

import sys
from pathlib import Path

import sklearn.metrics as sk_metrics

from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator
from behavioral_anomaly.pipeline import BehavioralAnomalyPipeline


def main() -> None:
    config = GenerationConfig(entities=200, days=30, anomaly_rate=0.15)
    print(f"Generating {config.entities} entities x {config.days} days...")
    data = SyntheticDataGenerator(config).generate()
    print(f"  -> {len(data):,} events ({int(data.is_anomaly.sum()):,} anomalies)")

    pipe = BehavioralAnomalyPipeline()
    pipe.fit(data)
    scored = pipe.score(data)
    scored.to_pickle("data.pkl")
    print(f"Saved data.pkl ({len(scored):,} rows)")

    y_true = scored["is_anomaly"].fillna(0).astype(int)
    y_score = scored["anomaly_score"].fillna(0)
    precision, recall, thresholds = sk_metrics.precision_recall_curve(y_true, y_score)
    f1 = 2 * precision * recall / (precision + recall + 1e-12)
    best = int(f1.argmax())
    print(f"  PR-AUC={sk_metrics.auc(recall, precision):.3f}")
    print(f"  operating point: precision={precision[best]:.3f} recall={recall[best]:.3f} f1={f1[best]:.3f}")


if __name__ == "__main__":
    main()
