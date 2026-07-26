from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from typing import List, Dict, Any, Optional
import math
import numpy as np
import sklearn.metrics as sk_metrics

from behavioral_anomaly.explain import explain_event
from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator
from behavioral_anomaly.pipeline import BehavioralAnomalyPipeline

app = FastAPI(title="Behavioral Anomaly API")

# Allow CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state to hold the dataset (for prototyping)
# In a real app, this would be queried from a database.
_cached_data: Optional[pd.DataFrame] = None

import os

def get_data() -> pd.DataFrame:
    global _cached_data
    if _cached_data is None:
        if os.path.exists("data.pkl"):
            _cached_data = pd.read_pickle("data.pkl")
        else:
            raise FileNotFoundError("data.pkl not found!")
    return _cached_data

# Helper to handle NaN values before JSON serialization
def clean_record(record: dict) -> dict:
    cleaned = {}
    for k, v in record.items():
        if isinstance(v, float) and math.isnan(v):
            cleaned[k] = None
        else:
            cleaned[k] = v
    return cleaned


@app.get("/api/stats")
def get_stats():
    df = get_data()
    return {
        "total_events": len(df),
        "flagged_events": int(df.is_flagged.sum()),
        "distinct_anomaly_types": int(df.anomaly_type.nunique()),
        "distinct_entities": int(df.entity_id.nunique())
    }

@app.get("/api/alerts")
def get_alerts(min_score: float = 0.5, show_all: bool = False, attack_types: str = ""):
    df = get_data()
    
    # Filter logic
    mask = df.anomaly_score >= min_score
    if not show_all:
        mask &= df.is_flagged == 1
        
    if attack_types:
        types_list = [t.strip() for t in attack_types.split(",")]
        if types_list:
            mask &= df.predicted_anomaly_type.isin(types_list)
            
    subset = df[mask].head(200)
    
    # Convert to list of dicts and clean NaNs
    records = subset.to_dict(orient="records")
    return [clean_record(r) for r in records]

@app.get("/api/alerts/{event_id}")
def get_alert_detail(event_id: str):
    df = get_data()
    row = df[df.event_id == event_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Event not found")
        
    event = row.iloc[0]
    factors = explain_event(event)
    
    record = clean_record(event.to_dict())
    record["explanation_factors"] = factors
    
    return record

@app.get("/api/entities/{entity_id}/history")
def get_entity_history(entity_id: str, limit: int = 50):
    df = get_data()
    history = df[df.entity_id == entity_id].sort_values("timestamp", ascending=False).head(limit)
    if history.empty:
        return []
    records = history.to_dict(orient="records")
    return [clean_record(r) for r in records]

@app.get("/api/metrics")
def get_metrics():
    df = get_data()
    
    y_true = df["is_anomaly"].fillna(0).astype(int)
    y_score = df["anomaly_score"].fillna(0)
    
    if y_true.sum() == 0 or len(y_score.unique()) == 1:
        pr_auc = 0.0
        precision_at_1pct = 0.0
        recall_at_1pct = 0.0
    else:
        precision, recall, _ = sk_metrics.precision_recall_curve(y_true, y_score)
        pr_auc = sk_metrics.auc(recall, precision)
        
        threshold_1pct = np.percentile(y_score, 99)
        y_pred_1pct = (y_score >= threshold_1pct).astype(int)
        precision_at_1pct = sk_metrics.precision_score(y_true, y_pred_1pct, zero_division=0)
        recall_at_1pct = sk_metrics.recall_score(y_true, y_pred_1pct, zero_division=0)
        
    flagged = df[df.is_flagged == 1]
    if not flagged.empty:
        cm = pd.crosstab(flagged.anomaly_type, flagged.predicted_anomaly_type)
        cm_dict = cm.to_dict(orient="index")
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

    return {
        "pr_auc": float(pr_auc),
        "precision_at_1pct": float(precision_at_1pct),
        "recall_at_1pct": float(recall_at_1pct),
        "confusion_matrix": cm_dict,
        "cold_start": {
            "events": int(cold_start_events_count),
            "stream_percentage": float(stream_pct),
            "cold_precision": float(cold_precision),
            "warm_precision": float(warm_precision)
        }
    }
