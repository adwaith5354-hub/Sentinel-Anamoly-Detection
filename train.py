"""Train and export the full pipeline on synthetic data."""

import argparse
from pathlib import Path

from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator
from behavioral_anomaly.pipeline import BehavioralAnomalyPipeline


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--entities", type=int, default=200)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--anomaly-rate", type=float, default=0.04)
    parser.add_argument("--output-dir", type=str, default="artifacts/models")
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    config = GenerationConfig(entities=args.entities, days=args.days, anomaly_rate=args.anomaly_rate)
    print(f"Generating {args.entities} entities x {args.days} days...")
    data = SyntheticDataGenerator(config).generate()
    print(f"  -> {len(data):,} events ({data.is_anomaly.sum():,} anomalies)")

    pipe = BehavioralAnomalyPipeline()
    pipe.fit(data)
    out_path = out_dir / "pipeline.joblib"
    pipe.detector.save(str(out_path))
    print(f"Saved detector to {out_path}")

    scored = pipe.score(data)
    flagged = scored[scored.is_flagged == 1]
    print(f"Flagged {len(flagged)} / {len(scored)} events as anomalous")


if __name__ == "__main__":
    main()
