ANOMALY_TYPES = (
    "normal",
    "brute_force",
    "impossible_travel",
    "credential_stuffing",
    "lateral_movement",
    "device_spoofing",
    "low_slow_exfiltration",
    "insider_drift",
)

ATTACK_TYPES = ANOMALY_TYPES[1:]

COUNTRIES = {
    "US": (40.7128, -74.0060),
    "GB": (51.5072, -0.1276),
    "DE": (52.5200, 13.4050),
    "IN": (19.0760, 72.8777),
    "JP": (35.6762, 139.6503),
    "AU": (-33.8688, 151.2093),
    "BR": (-23.5505, -46.6333),
}

RESOURCES = ("email", "crm", "hr_portal", "finance", "vpn", "git", "files", "admin")
SENSITIVE_RESOURCES = {"finance", "admin", "files"}
