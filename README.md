# Behavioral Anomaly Detection

AI/ML system for detecting and classifying anomalous access behavior in authentication and resource access logs.

## Project Structure

```
src/behavioral_anomaly/
  generator.py   - Synthetic data generator (normal + 7 attack patterns)
  features.py    - Feature engineering (geo-velocity, device novelty, etc.)
  detector.py    - Isolation Forest baseline detector
  sequence.py    - PyTorch LSTM autoencoder (optional)
  classifier.py  - Random Forest anomaly type classifier
  explain.py     - Rule-based explanation engine
  pipeline.py    - End-to-end orchestration
  dashboard/     - Streamlit app
```

## Quick Start

```bash
# Install
python -m venv .venv && .venv\Scripts\activate
pip install -e .

# Train & evaluate
python train.py --entities 200 --days 30

# Run dashboard
streamlit run src/behavioral_anomaly/dashboard/app.py

# Run tests
python -m pytest tests/ -v
```

## Attack Patterns Generated

| Attack | Description |
|--------|-------------|
| brute_force | Rapid failed logins followed by success |
| impossible_travel | Two auth events from distant countries within minutes |
| credential_stuffing | Many rapid failures from unknown devices |
| lateral_movement | User accesses resources in escalating privilege order |
| device_spoofing | Event from an unseen device fingerprint |
| low_slow_exfiltration | Small transfers at regular intervals over hours |
| insider_drift | Gradual expansion to sensitive resources over days |

## Pipeline

1. **Generate** synthetic events with labeled anomalies
2. **Feature engineer** temporal, geospatial, and behavioral features
3. **Detect** anomalies via Isolation Forest (unsupervised)
4. **Classify** the type of anomaly (supervised Random Forest)
5. **Explain** each flag with human-readable reasons
6. **Display** ranked alert queue in Streamlit dashboard
