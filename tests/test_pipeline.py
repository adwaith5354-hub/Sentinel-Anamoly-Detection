import pytest

from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator
from behavioral_anomaly.pipeline import BehavioralAnomalyPipeline


@pytest.fixture
def small_data():
    gen = SyntheticDataGenerator(GenerationConfig(entities=10, days=3))
    return gen.generate()


def test_pipeline_fit_and_score(small_data):
    pipe = BehavioralAnomalyPipeline()
    pipe.fit(small_data)
    scored = pipe.score(small_data)
    assert "anomaly_score" in scored.columns
    assert "is_flagged" in scored.columns
    assert scored.anomaly_score.max() <= 1.0
    assert scored.anomaly_score.min() >= 0.0


def test_pipeline_adds_explanations(small_data):
    pipe = BehavioralAnomalyPipeline()
    pipe.fit(small_data)
    scored = pipe.score(small_data)
    assert "explanation" in scored.columns
    assert scored.explanation.notna().all()
