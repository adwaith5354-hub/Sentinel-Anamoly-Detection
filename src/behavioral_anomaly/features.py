"""Features derived only from event history, suitable for model scoring."""

from __future__ import annotations

import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "hour", "is_weekend", "time_since_last_login", "geo_velocity_kmh",
    "new_device", "new_country", "failed_login", "bytes_transferred_log",
    "is_sensitive_resource", "resource_novelty", "device_fp_novelty",
    "fail_count_10min", "distinct_res_30min", "events_10min", "entity_seq",
    "z_hour", "z_bytes", "z_geo", "z_session",
]


def _rolling_count_by_entity(frame: pd.DataFrame, column: str, window: str, agg: str = "sum") -> np.ndarray:
    indexed = frame.set_index("timestamp")
    rolled = getattr(indexed.groupby("entity_id")[column].rolling(window), agg)()
    return rolled.reset_index(drop=True, level=0).values


def _rolling_nunique_by_entity(frame: pd.DataFrame, column: str, window: str) -> np.ndarray:
    indexed = frame.set_index("timestamp")
    rolled = indexed.groupby("entity_id")[column].rolling(window).apply(
        lambda values: np.unique(values).size, raw=True
    )
    return rolled.reset_index(drop=True, level=0).values


def engineer_features(events: pd.DataFrame) -> pd.DataFrame:
    frame = events.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
    frame = frame.sort_values(["entity_id", "timestamp"]).reset_index(drop=True)
    grouped = frame.groupby("entity_id")

    frame["hour"] = frame.timestamp.dt.hour
    frame["is_weekend"] = (frame.timestamp.dt.dayofweek >= 5).astype(int)
    frame["time_since_last_login"] = grouped.timestamp.diff().dt.total_seconds().div(3600).fillna(24).clip(0, 168)

    previous_lat = grouped.latitude.shift()
    previous_lon = grouped.longitude.shift()
    hours = frame["time_since_last_login"].clip(lower=1 / 60)
    # Equirectangular approximation is sufficient for ranking synthetic events.
    distance = 111 * np.sqrt((frame.latitude - previous_lat).pow(2) + ((frame.longitude - previous_lon) * np.cos(np.radians(frame.latitude))).pow(2))
    frame["geo_velocity_kmh"] = distance.div(hours).fillna(0).clip(0, 50_000)

    # Novelty signals: first time an entity deviates from its own established context.
    frame["new_device"] = (~frame.duplicated(["entity_id", "device_id"])).astype(int)
    frame["new_country"] = (~frame.duplicated(["entity_id", "country"])).astype(int)
    frame["device_fp_novelty"] = (~frame.duplicated(["entity_id", "device_fingerprint"])).astype(int)
    frame["resource_novelty"] = (~frame.duplicated(["entity_id", "resource"])).astype(int)

    frame["failed_login"] = (frame.outcome == "failure").astype(int)
    frame["bytes_transferred_log"] = np.log1p(frame.bytes_transferred)
    frame["is_sensitive_resource"] = frame.is_sensitive_resource.astype(int)

    # Entity maturity: suppress novelty signals before any behavioural baseline exists.
    frame["entity_seq"] = grouped.cumcount()

    # Short-horizon burst behaviour (rate-based, per entity).
    frame["fail_count_10min"] = _rolling_count_by_entity(frame, "failed_login", "10min", "sum")
    frame["events_10min"] = _rolling_count_by_entity(frame, "failed_login", "10min", "count")
    frame["res_code"] = pd.factorize(frame["resource"])[0].astype(float)
    frame["distinct_res_30min"] = _rolling_nunique_by_entity(frame, "res_code", "30min")

    # Per-entity robust deviations (how far this event is from the entity's own norm).
    for source, target in [("hour", "z_hour"), ("bytes_transferred_log", "z_bytes"),
                           ("geo_velocity_kmh", "z_geo"), ("session_duration", "z_session")]:
        mean = grouped[source].transform(lambda series: series.expanding().mean())
        std = grouped[source].transform(lambda series: series.expanding().std()).replace(0, np.nan)
        frame[target] = ((frame[source] - mean) / std).fillna(0).clip(-10, 10)

    return frame
