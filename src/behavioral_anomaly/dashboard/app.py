"""Streamlit dashboard for analyst review of behavioral anomaly alerts."""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
import streamlit as st

from behavioral_anomaly.explain import explain_event
from behavioral_anomaly.generator import GenerationConfig, SyntheticDataGenerator
from behavioral_anomaly.pipeline import BehavioralAnomalyPipeline

st.set_page_config(page_title="Anomaly Detection Dashboard", layout="wide")
st.title("Behavioral Anomaly Detection - Analyst Queue")

MODEL_PATH = Path("artifacts/models/pipeline.joblib")


@st.cache_data
def load_data() -> pd.DataFrame:
    gen = SyntheticDataGenerator(GenerationConfig(entities=100, days=14, anomaly_rate=0.04))
    raw = gen.generate()
    pipe = BehavioralAnomalyPipeline()
    pipe.fit(raw)
    scored = pipe.score(raw)
    return scored


@st.cache_resource
def load_model():
    return joblib.load(str(MODEL_PATH)) if MODEL_PATH.exists() else None


data = load_data()

# Sidebar filters
st.sidebar.header("Filters")
min_score = st.sidebar.slider("Min anomaly score", 0.0, 1.0, 0.5)
show_all = st.sidebar.checkbox("Show all events (not only flagged)", value=False)
attack_filter = st.sidebar.multiselect("Attack type", sorted(data.predicted_anomaly_type.unique()),
                                       default=["brute_force", "impossible_travel", "credential_stuffing"])

mask = data.anomaly_score >= min_score
if not show_all:
    mask &= data.is_flagged == 1
mask &= data.predicted_anomaly_type.isin(attack_filter)

subset = data[mask].head(200)

st.metric("Total events", len(data))
col1, col2, col3 = st.columns(3)
col1.metric("Flagged (any threshold)", int(data.is_flagged.sum()))
col2.metric("Anomaly types", data.anomaly_type.nunique())
col3.metric("Distinct entities", data.entity_id.nunique())

st.dataframe(
    subset[["event_id", "entity_id", "timestamp", "resource", "anomaly_score",
            "predicted_anomaly_type", "classification_confidence", "explanation"]],
    column_config={
        "anomaly_score": st.column_config.ProgressColumn(format="%.3f", min_value=0, max_value=1),
        "classification_confidence": st.column_config.ProgressColumn(format="%.2f", min_value=0, max_value=1),
        "timestamp": st.column_config.DatetimeColumn(format="YYYY-MM-DD HH:mm"),
    },
    use_container_width=True,
    hide_index=True,
)

# Detail view
st.subheader("Alert Detail")
if not subset.empty:
    selected_id = st.selectbox("Select an event to inspect", subset.event_id, format_func=lambda x: x[:8] + "...")
    row = data[data.event_id == selected_id]
    if not row.empty:
        event = row.iloc[0]
        factors = explain_event(event)
        st.markdown(f"**Risk score:** {event.anomaly_score:.3f}")
        st.markdown(f"**Type:** {event.predicted_anomaly_type}  (confidence {event.classification_confidence:.2f})")
        st.markdown(f"**Why flagged:** {'; '.join(factors)}")
else:
    st.info("No events match the current filters.")
