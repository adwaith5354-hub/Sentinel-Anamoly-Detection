"""Rule-readable local explanations based on behavioral feature deviations."""

from __future__ import annotations

import pandas as pd


def explain_event(event: pd.Series) -> list[str]:
    factors = []
    if event.get("geo_velocity_kmh", 0) > 900:
        factors.append(f"geo velocity of {event.geo_velocity_kmh:,.0f} km/h")
    if event.get("new_device", 0):
        factors.append("previously unseen device")
    if event.get("new_country", 0):
        factors.append("new source country")
    if event.get("failed_login", 0):
        factors.append("failed authentication")
    if event.get("bytes_transferred", 0) >= 1_000_000:
        factors.append(f"large transfer ({event.bytes_transferred:,.0f} bytes)")
    if event.get("is_sensitive_resource", 0):
        factors.append("sensitive resource access")
    if event.get("resource_novelty", 0):
        factors.append("new resource for this entity")
    return factors or ["unusual combination of behavioral features"]
