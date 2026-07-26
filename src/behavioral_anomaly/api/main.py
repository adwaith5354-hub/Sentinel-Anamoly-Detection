from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from typing import List, Dict, Any, Optional
import math

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

def get_data() -> pd.DataFrame:
    global _cached_data
    if _cached_data is None:
        print("Generating and scoring synthetic dataset...")
        gen = SyntheticDataGenerator(GenerationConfig(entities=100, days=14, anomaly_rate=0.04))
        raw = gen.generate()
        pipe = BehavioralAnomalyPipeline()
        pipe.fit(raw)
        _cached_data = pipe.score(raw)
        print("Dataset ready.")
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
