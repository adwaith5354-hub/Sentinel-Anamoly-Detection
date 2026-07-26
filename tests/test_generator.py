import pandas as pd
import pytest

from behavioral_anomaly.constants import ANOMALY_TYPES
from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator


@pytest.fixture
def small_gen() -> SyntheticDataGenerator:
    return SyntheticDataGenerator(GenerationConfig(entities=10, days=3, seed=42))


def test_generates_dataframe(small_gen):
    df = small_gen.generate()
    assert isinstance(df, pd.DataFrame)
    assert len(df) > 0


def test_expected_columns(small_gen):
    expected = {"event_id", "entity_id", "timestamp", "anomaly_type", "is_anomaly"}
    assert expected.issubset(small_gen.generate().columns)


def test_normal_records_are_marked_valid(small_gen):
    df = small_gen.generate()
    normal = df[df.anomaly_type == "normal"]
    assert (normal.is_anomaly == 0).all()


def test_all_attack_types_present(small_gen):
    df = small_gen.generate()
    present = df.anomaly_type.unique()
    for attack in ("brute_force", "impossible_travel", "credential_stuffing",
                   "lateral_movement", "device_spoofing", "low_slow_exfiltration", "insider_drift"):
        assert attack in present, f"{attack} not generated"


def test_brute_force_triggers_failures(small_gen):
    df = small_gen.generate()
    bf = df[df.anomaly_type == "brute_force"]
    assert len(bf) > 0
    assert bf.outcome.iloc[0] == "failure"


def test_impossible_travel_has_different_countries(small_gen):
    df = small_gen.generate()
    it = df[df.anomaly_type == "impossible_travel"]
    assert it.country.nunique() > 1
