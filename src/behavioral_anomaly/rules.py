"""Deterministic L0 rule layer.

These are analyst-authored heuristics, not label-fitted weights. They encode
high-confidence behavioural signatures (impossible travel, authentication
bursts, mass exfiltration, context novelty) and provide the dominant signal in
the ensemble detector. Novelty rules require the entity to already have a
baseline (``entity_seq >= 1``) so a brand-new entity's first event is never
treated as a deviation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

LARGE_TRANSFER_BYTES = 1_000_000


def _warm(frame: pd.DataFrame) -> pd.Series:
    return (frame["entity_seq"] >= 1).astype(int)


def rule_score(frame: pd.DataFrame) -> np.ndarray:
    warm = _warm(frame)
    score = np.zeros(len(frame))

    score += 5.0 * (frame.geo_velocity_kmh > 900).astype(int)
    score += 3.5 * ((frame.new_country == 1) & (warm == 1)).astype(int)
    score += 3.5 * ((frame.new_country == 1) & (frame.failed_login == 1)).astype(int)
    score += 3.0 * (frame.fail_count_10min >= 5).astype(int)
    score += 2.0 * (frame.fail_count_10min >= 3).astype(int)
    score += 2.0 * ((frame.failed_login == 1) & (warm == 1)).astype(int)
    score += 3.0 * ((frame.device_fp_novelty == 1) & (warm == 1)).astype(int)
    score += 2.5 * ((frame.new_device == 1) & (warm == 1)).astype(int)
    score += 2.5 * (frame.distinct_res_30min >= 3).astype(int)
    score += 2.0 * (frame.distinct_res_30min >= 2).astype(int)
    score += 2.5 * ((frame.resource_novelty == 1) & (frame.is_sensitive_resource == 1) & (warm == 1)).astype(int)
    score += 3.0 * (frame.bytes_transferred_log >= np.log1p(LARGE_TRANSFER_BYTES)).astype(int)
    score += 2.0 * ((frame.resource_novelty == 1) & (warm == 1)).astype(int)
    return score


def rule_reasons(row: pd.Series) -> list[str]:
    """Human-readable factors for a single scored event."""
    factors: list[str] = []
    warm = row.get("entity_seq", 0) >= 1
    if row.get("geo_velocity_kmh", 0) > 900:
        factors.append(f"impossible travel (geo velocity {row.geo_velocity_kmh:,.0f} km/h)")
    if row.get("new_country", 0) and warm:
        factors.append(f"new source country for this entity ({row.get('country', 'unknown')})")
    if row.get("fail_count_10min", 0) >= 3:
        factors.append(f"{int(row.fail_count_10min)} failed authentications within 10 minutes")
    elif row.get("failed_login", 0) and warm:
        factors.append("failed authentication from an established entity")
    if row.get("device_fp_novelty", 0) and warm:
        factors.append("previously unseen device fingerprint")
    if row.get("new_device", 0) and warm:
        factors.append("previously unseen device")
    if row.get("distinct_res_30min", 0) >= 3:
        factors.append(f"{int(row.distinct_res_30min)} distinct resources accessed within 30 minutes")
    if row.get("resource_novelty", 0) and warm and row.get("is_sensitive_resource", 0):
        factors.append(f"first-time access to sensitive resource '{row.get('resource', 'unknown')}'")
    elif row.get("resource_novelty", 0) and warm:
        factors.append(f"new resource for this entity ({row.get('resource', 'unknown')})")
    if row.get("bytes_transferred_log", 0) >= np.log1p(LARGE_TRANSFER_BYTES):
        factors.append(f"large data transfer ({row.get('bytes_transferred', 0):,.0f} bytes)")
    return factors
