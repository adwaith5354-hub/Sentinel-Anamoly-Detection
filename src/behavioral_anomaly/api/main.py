from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import math
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "api_data")
_cache = {}

def _load(name):
    if name not in _cache:
        path = os.path.join(DATA_DIR, f"{name}.json")
        if not os.path.exists(path):
            path = os.path.join("api_data", f"{name}.json")
        with open(path) as f:
            _cache[name] = json.load(f)
    return _cache[name]

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load("stats")
    _load("alerts")
    _load("all_events")
    _load("entity_history")
    _load("events_by_id")
    _load("metrics")
    yield

app = FastAPI(title="Behavioral Anomaly API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _nan_to_none(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return None
    if isinstance(obj, dict):
        return {k: _nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nan_to_none(v) for v in obj]
    return obj

def explain_event(event):
    factors = []
    if event.get("geo_velocity_kmh", 0) > 900:
        factors.append(f"geo velocity of {event['geo_velocity_kmh']:,.0f} km/h")
    if event.get("new_device", 0):
        factors.append("previously unseen device")
    if event.get("new_country", 0):
        factors.append("new source country")
    if event.get("failed_login", 0):
        factors.append("failed authentication")
    if event.get("bytes_transferred", 0) >= 1_000_000:
        factors.append(f"large transfer ({event['bytes_transferred']:,.0f} bytes)")
    if event.get("is_sensitive_resource", 0):
        factors.append("sensitive resource access")
    if event.get("resource_novelty", 0):
        factors.append("new resource for this entity")
    return factors or ["unusual combination of behavioral features"]

@app.get("/api/stats")
def get_stats():
    return _load("stats")

@app.get("/api/alerts")
def get_alerts(min_score: float = 0.5, show_all: bool = False, attack_types: str = ""):
    alerts = _load("alerts")
    filtered = []
    for r in alerts:
        score = r.get("anomaly_score", 0)
        if score < min_score:
            continue
        if not show_all and r.get("is_flagged") != 1:
            continue
        if attack_types:
            types_list = [t.strip() for t in attack_types.split(",")]
            if types_list and r.get("predicted_anomaly_type") not in types_list:
                continue
        filtered.append(r)
    return filtered[:200]

@app.get("/api/alerts/{event_id}")
def get_alert_detail(event_id: str):
    events = _load("events_by_id")
    event = events.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    record = dict(event)
    record["explanation_factors"] = explain_event(event)
    return record

@app.get("/api/entities/{entity_id}/history")
def get_entity_history(entity_id: str, limit: int = 50):
    history = _load("entity_history")
    return history.get(entity_id, [])[:limit]

@app.get("/api/metrics")
def get_metrics():
    return _load("metrics")
