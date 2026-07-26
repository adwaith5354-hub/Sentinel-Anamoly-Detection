# Sentinel | AI-Powered Behavioral Anomaly Detection

**Sentinel** is a full-stack Security Operations Center (SOC) dashboard and machine learning inference engine designed to detect, classify, and explain malicious network behavior in near real-time. 

Built specifically to handle extreme class imbalances and concept drift, Sentinel ingests massive streams of sequential access-log telemetry, isolates true intrusions from legitimate behavioral drift, and provides human-readable explainability factors for SOC analysts.

---

## 🚀 Live Demo
- **Frontend Dashboard:** [Deployed on Vercel](#) *(Insert your Vercel Link here!)*
- **Backend API Docs:** [Deployed on Render (Swagger UI)](https://sentinel-anamoly-detection.onrender.com/docs)
- **System Report:** Check the `/submission_documents` folder for a detailed breakdown of model assumptions, metrics, and limitations.

---

## 🧠 Core Architecture & Engine Mechanics

Sentinel was purpose-built to satisfy the rigorous requirements of modern, enterprise-scale anomaly detection, focusing heavily on alert fidelity and analyst bandwidth over raw detection volume.

### 1. Multi-Layered Detector Ensemble (L0-L3)
Our inference pipeline utilizes a sophisticated multi-layer architecture to minimize false positives:
- **L0 (Deterministic Rules):** Core load-bearing heuristics that instantly flag obvious violations.
- **L1 (Per-Entity Baseline):** Tracks individual user/device norms to establish personalized thresholds.
- **L2 (Sequence):** Analyzes the sequential order of actions to detect lateral movement.
- **L3 (Graph / Long Window):** Analyzes structural network changes and long-term behavioral shifts. 
*(Note: Ablation studies indicate L0 and L3 are the primary drivers of our high precision@1%).*

### 2. Rate-Based Stability & Confound Correction
- **Fixed Alert Budget:** Instead of utilizing a strict per-event threshold (which leads to alert fatigue during traffic spikes), Sentinel adopts a rate-based operating point (top-N anomalies per day). This guarantees a stable, predictable workload for the SOC (e.g., median 5 alerts/day).
- **Size Independence:** Explicit corrections (Stouffer denominator) have been applied to ensure the engine doesn't penalize entities merely for having high traffic volume. Alert score correlation to traffic size is strictly controlled (currently `~0.041`).

### 3. Explainable AI & Entity Forensics
A risk score is useless without context. Sentinel utilizes a robust `Isolation Forest` ensemble model. When an event is flagged, the model computes **Explainability Factors** (e.g., *"Source IP deviates from historical baseline"*, *"Anomalous Device Fingerprint"*), allowing analysts to understand *why* an alert fired.

Furthermore, analysts can query any `entity_id` to visualize their complete historical timeline, comparing standard baselines against sudden malicious spikes.

### 4. Synthetic Threat Simulation
Because real-world intrusion datasets are heavily privacy-restricted, Sentinel features a proprietary Python Data Generator utilizing `Faker`. We systematically inject complex threat patterns into noise at measured rates (e.g., 4x the attack rate for benign confounders like `ci_automation_burst` and `os_patch`) to explicitly stress-test the model against false positives.

---

## 💻 Tech Stack

### Frontend Architecture (The SOC Dashboard)
- **Framework:** React 18 + Vite
- **Styling:** Custom Vanilla CSS (Aurora Enterprise Light-Mode Aesthetic)
- **Icons:** Lucide React
- **Hosting:** Vercel (CI/CD Pipeline)

### Backend Architecture (The Inference Engine)
- **Framework:** Python + FastAPI
- **Machine Learning:** `scikit-learn` (Isolation Forests), `pandas`, `numpy`
- **Data Generation:** `Faker`
- **Hosting:** Render Cloud (Dockerized Environment)

---

## 🛠️ Local Development Setup

Want to run Sentinel locally? Follow these steps:

### 1. Start the Machine Learning Backend
```bash
# Clone the repo
git clone https://github.com/adwaith5354-hub/Sentinel-Anamoly-Detection.git
cd Sentinel-Anamoly-Detection

# Install the Python package and dependencies
pip install -e .
pip install fastapi uvicorn

# Boot the API server
# Note: Ensure you set the PYTHONPATH to resolve local module imports
PYTHONPATH="src" python -m uvicorn src.behavioral_anomaly.api.main:app --reload --port 8000
```
*The backend will automatically generate the synthetic dataset and train the models on startup. The API will be available at `http://localhost:8000`.*

### 2. Start the Frontend Dashboard
```bash
# Open a new terminal tab
cd ui

# Install node modules
npm install

# Start the Vite development server
npm run dev
```
*The dashboard will be available at `http://localhost:5173`.*

---

## 👨‍💻 Developed By
**Adwaith Binoy**  
Submission for the Behavioral Anomaly Detection Hackathon.
