"""Features derived only from event history, suitable for model scoring."""

from __future__ import annotations

import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "hour", "is_weekend", "time_since_last_login", "geo_velocity_kmh",
    "new_device", "new_country", "failed_login", "bytes_transferred_log",
    "is_sensitive_resource", "resource_novelty",
]


def engineer_features(events: pd.DataFrame) -> pd.DataFrame:
    frame = events.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame = frame.sort_values(["entity_id", "timestamp"]).reset_index(drop=True)
    frame["hour"] = frame.timestamp.dt.hour
    frame["is_weekend"] = (frame.timestamp.dt.dayofweek >= 5).astype(int)
    frame["time_since_last_login"] = frame.groupby("entity_id").timestamp.diff().dt.total_seconds().div(3600).fillna(24).clip(0, 168)
    previous_lat = frame.groupby("entity_id").latitude.shift()
    previous_lon = frame.groupby("entity_id").longitude.shift()
    hours = frame["time_since_last_login"].clip(lower=1 / 60)
    # Equirectangular approximation is sufficient for ranking synthetic events.
    distance = 111 * np.sqrt((frame.latitude - previous_lat).pow(2) + ((frame.longitude - previous_lon) * np.cos(np.radians(frame.latitude))).pow(2))
    frame["geo_velocity_kmh"] = distance.div(hours).fillna(0).clip(0, 50_000)
    frame["new_device"] = (~frame.duplicated(["entity_id", "device_id"])).astype(int)
    frame["new_country"] = (~frame.duplicated(["entity_id", "country"])).astype(int)
    frame["resource_novelty"] = (~frame.duplicated(["entity_id", "resource"])).astype(int)
    frame["failed_login"] = (frame.outcome == "failure").astype(int)
    frame["bytes_transferred_log"] = np.log1p(frame.bytes_transferred)
    return frame
