"""Deterministic synthetic authentication and access-event generator."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from ipaddress import IPv4Address

import numpy as np
import pandas as pd
from faker import Faker

from .constants import ANOMALY_TYPES, COUNTRIES, RESOURCES, SENSITIVE_RESOURCES


@dataclass(frozen=True)
class GenerationConfig:
    entities: int = 200
    days: int = 30
    anomaly_rate: float = 0.15
    seed: int = 42


class SyntheticDataGenerator:
    """Generate normal per-user habits, then inject labeled attack sequences."""

    def __init__(self, config: GenerationConfig | None = None):
        self.config = config or GenerationConfig()
        self.rng = np.random.default_rng(self.config.seed)
        self.fake = Faker()
        self.fake.seed_instance(self.config.seed)

    def generate(self) -> pd.DataFrame:
        profiles = [self._profile(index) for index in range(self.config.entities)]
        events = [event for profile in profiles for event in self._normal_events(profile)]
        frame = pd.DataFrame(events)
        attack_count = max(7, round(len(frame) * self.config.anomaly_rate / 5))
        for attack_index in range(attack_count):
            profile = profiles[attack_index % len(profiles)]
            attack = ANOMALY_TYPES[1 + (attack_index % (len(ANOMALY_TYPES) - 1))]
            frame = pd.concat([frame, pd.DataFrame(self._inject(profile, attack))], ignore_index=True)
        return frame.sort_values("timestamp").reset_index(drop=True)

    def _profile(self, index: int) -> dict:
        country = list(COUNTRIES)[index % len(COUNTRIES)]
        entity_type = "service_account" if index % 10 == 0 else "user"
        os = self.rng.choice(["Win10", "macOS", "Linux"])
        browser = self.rng.choice(["Chrome", "Firefox", "Edge", "Safari"])
        mac = self.fake.mac_address()
        return {
            "entity_id": f"{entity_type[:3]}-{index + 1:04d}",
            "entity_type": entity_type,
            "country": country,
            "device": f"device-{index + 1:04d}",
            "device_fingerprint": f"{os}/{browser}/MAC:{mac}",
            "home_resource": RESOURCES[index % 5],
            "work_start": int(self.rng.integers(7, 11)),
        }

    def _normal_events(self, profile: dict) -> list[dict]:
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        start -= timedelta(days=self.config.days)
        records = []
        for day in range(self.config.days):
            count = int(self.rng.integers(2, 7))
            for _ in range(count):
                hour = int(np.clip(self.rng.normal(profile["work_start"], 2), 0, 23))
                timestamp = start + timedelta(days=day, hours=hour, minutes=int(self.rng.integers(60)))
                records.append(self._event(profile, timestamp, profile["country"], profile["device"],
                                           profile["home_resource"], "success", 0, "normal", 0))
        return records

    def _inject(self, profile: dict, attack: str) -> list[dict]:
        base = datetime.now(timezone.utc) - timedelta(hours=int(self.rng.integers(1, self.config.days * 24)))
        other_country = next(country for country in COUNTRIES if country != profile["country"])
        if attack == "brute_force":
            return [self._event(profile, base + timedelta(minutes=i), profile["country"], profile["device"],
                                "vpn", "failure" if i < 9 else "success", 0, attack, 1) for i in range(10)]
        if attack == "impossible_travel":
            return [
                self._event(profile, base, profile["country"], profile["device"], "email", "success", 0, attack, 1),
                self._event(profile, base + timedelta(minutes=30), other_country, profile["device"], "email", "success", 0, attack, 1),
            ]
        if attack == "credential_stuffing":
            return [self._event(profile, base + timedelta(seconds=i * 20), other_country, f"unknown-{i % 4}",
                                "vpn", "failure", 0, attack, 1) for i in range(12)]
        if attack == "lateral_movement":
            return [self._event(profile, base + timedelta(minutes=i * 3), profile["country"], profile["device"],
                                resource, "success", 0, attack, 1)
                    for i, resource in enumerate(("vpn", "git", "files", "admin"))]
        if attack == "device_spoofing":
            return [self._event(profile, base, profile["country"], "device-unseen-9999", profile["home_resource"],
                                "success", 0, attack, 1)]
        if attack == "low_slow_exfiltration":
            return [self._event(profile, base + timedelta(hours=i * 6), profile["country"], profile["device"],
                                "files", "success", 5_000_000, attack, 1) for i in range(8)]
        # Insider drift steadily expands access from the user's habitual resource.
        return [self._event(profile, base + timedelta(days=i), profile["country"], profile["device"], resource,
                            "success", 0, attack, 1)
                for i, resource in enumerate(("crm", "finance", "files", "admin"))]

    def _event(self, profile: dict, timestamp: datetime, country: str, device: str, resource: str,
               outcome: str, bytes_transferred: int, anomaly_type: str, is_anomaly: int) -> dict:
        latitude, longitude = COUNTRIES[country]
        ip_value = int(self.rng.integers(1, 2**32 - 1))
        
        # Handle unseen devices for device_spoofing
        if device == "device-unseen-9999":
            fingerprint = "UnknownOS/UnknownBrowser/MAC:00-00-00-00-00-00"
        elif device.startswith("unknown-"):
            fingerprint = "Script/Bot/MAC:" + self.fake.mac_address()
        else:
            fingerprint = profile.get("device_fingerprint", "Win10/Chrome/MAC:00-00-00")

        return {
            "event_id": self.fake.uuid4(), 
            "entity_id": profile["entity_id"], 
            "entity_type": profile.get("entity_type", "user"),
            "timestamp": timestamp,
            "source_ip": str(IPv4Address(ip_value)), "country": country,
            "latitude": latitude + self.rng.normal(0, 0.05), "longitude": longitude + self.rng.normal(0, 0.05),
            "device_id": device, 
            "device_fingerprint": fingerprint,
            "resource": resource, "action": "access", "outcome": outcome,
            "auth_method": self.rng.choice(["password", "token", "biometric", "certificate"]),
            "session_duration": max(1, int(self.rng.normal(45, 15))),
            "command_sequence": ["login", "read", "logout"] if outcome == "success" else ["login_failed"],
            "bytes_transferred": bytes_transferred, "is_sensitive_resource": int(resource in SENSITIVE_RESOURCES),
            "is_anomaly": is_anomaly, "anomaly_type": anomaly_type,
        }
