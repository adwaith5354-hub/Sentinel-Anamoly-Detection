"""Pre-compute all API responses as JSON so the server needs zero heavy imports."""
import json
import math
import os
import numpy as np
import pandas as pd
import sklearn.metrics as sk_metrics
from pathlib import Path

OUT = Path("api_data")
OUT.mkdir(exist_ok=True)

def nan_to_none(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return None
    if isinstance(obj, dict):
        return {k: nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [nan_to_none(v) for v in obj]
    return obj

df = pd.read_pickle("data.pkl")
df["timestamp"] = df["timestamp"].astype(str)

# stats.json
stats = {
    "total_events": len(df),
    "flagged_events": int(df.is_flagged.sum()),
    "distinct_anomaly_types": int(df.anomaly_type.nunique()),
    "distinct_entities": int(df.entity_id.nunique()),
}
(OUT / "stats.json").write_text(json.dumps(stats))

# all_events.json (full dataset for alerts, history, detail lookups)
records = nan_to_none(df.to_dict(orient="records"))
(OUT / "all_events.json").write_text(json.dumps(records))

# alerts.json (flagged, sorted by score)
flagged = [r for r in records if r.get("is_flagged") == 1]
flagged.sort(key=lambda r: r.get("anomaly_score") or 0, reverse=True)
(OUT / "alerts.json").write_text(json.dumps(flagged))

# entity_history.json (grouped by entity_id)
entity_history = {}
for r in records:
    eid = r.get("entity_id", "")
    if eid not in entity_history:
        entity_history[eid] = []
    entity_history[eid].append(r)
for eid in entity_history:
    entity_history[eid].sort(key=lambda r: r.get("timestamp", ""), reverse=True)
(OUT / "entity_history.json").write_text(json.dumps(entity_history))

# events_by_id.json (for detail lookup)
events_by_id = {r["event_id"]: r for r in records}
(OUT / "events_by_id.json").write_text(json.dumps(events_by_id))

# metrics.json
y_true = df["is_anomaly"].fillna(0).astype(int)
y_score = df["anomaly_score"].fillna(0)

if y_true.sum() == 0 or len(y_score.unique()) == 1:
    pr_auc = precision_at_1pct = recall_at_1pct = 0.0
else:
    precision, recall, _ = sk_metrics.precision_recall_curve(y_true, y_score)
    pr_auc = sk_metrics.auc(recall, precision)
    threshold_1pct = np.percentile(y_score, 99)
    y_pred_1pct = (y_score >= threshold_1pct).astype(int)
    precision_at_1pct = sk_metrics.precision_score(y_true, y_pred_1pct, zero_division=0)
    recall_at_1pct = sk_metrics.recall_score(y_true, y_pred_1pct, zero_division=0)

flagged_df = df[df.is_flagged == 1]
if not flagged_df.empty:
    cm = pd.crosstab(flagged_df.anomaly_type, flagged_df.predicted_anomaly_type)
    cm_dict = {k: {kk: int(vv) for kk, vv in v.items()} for k, v in cm.to_dict(orient="index").items()}
else:
    cm_dict = {}

entity_counts = df.groupby("entity_id").size()
cold_entities = entity_counts[entity_counts < 20].index
cold_events = df[df.entity_id.isin(cold_entities)]
cold_start_events_count = len(cold_events)
stream_pct = (cold_start_events_count / len(df)) * 100 if len(df) > 0 else 0
cold_flagged = cold_events[cold_events.is_flagged == 1]
cold_precision = sk_metrics.precision_score(cold_flagged.is_anomaly, cold_flagged.is_flagged, zero_division=0) * 100 if len(cold_flagged) > 0 else 0.0
warm_events = df[~df.entity_id.isin(cold_entities)]
warm_flagged = warm_events[warm_events.is_flagged == 1]
warm_precision = sk_metrics.precision_score(warm_flagged.is_anomaly, warm_flagged.is_flagged, zero_division=0) * 100 if len(warm_flagged) > 0 else 0.0

metrics = {
    "pr_auc": float(pr_auc),
    "precision_at_1pct": float(precision_at_1pct),
    "recall_at_1pct": float(recall_at_1pct),
    "confusion_matrix": cm_dict,
    "cold_start": {
        "events": int(cold_start_events_count),
        "stream_percentage": float(stream_pct),
        "cold_precision": float(cold_precision),
        "warm_precision": float(warm_precision),
    },
}
(OUT / "metrics.json").write_text(json.dumps(metrics))

print(f"Pre-computed {len(records)} events -> api_data/")
print(f"  stats.json, alerts.json ({len(flagged)} flagged), entity_history.json ({len(entity_history)} entities), metrics.json")
