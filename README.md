# Sentinel | AI-Powered Behavioral Anomaly Detection

**Sentinel** is a full-stack Security Operations Center (SOC) dashboard and machine learning inference engine designed to detect, classify, and explain malicious network behavior in near real-time. 

Built specifically to handle extreme class imbalances and concept drift, Sentinel ingests massive streams of sequential access-log telemetry, isolates true intrusions from legitimate behavioral drift, and provides human-readable explainability factors for SOC analysts.

---

## 🚀 Live Demo
- **Frontend Dashboard:** [Deployed on Vercel](#) *(Insert your Vercel Link here!)*
- **Backend API Docs:** [Deployed on Render (Swagger UI)](https://sentinel-anamoly-detection.onrender.com/docs)

---

## 🧠 Core Features & Hackathon Compliance

This project was purpose-built to satisfy the rigorous requirements of modern behavioral anomaly detection:

### 1. Advanced Threat Simulation & Synthetic Data
Because real-world intrusion datasets are heavily privacy-restricted, Sentinel features a proprietary Python Data Generator that utilizes `Faker` to build realistic user/device behavioral baselines. We systematically inject complex threat patterns into this noise, including:
- **Brute Force:** Rapid failed-auth attempts.
- **Impossible Travel:** Geographically distant logins within an implausible time gap.
- **Credential Stuffing:** High failure rates across many entity IDs from few source IPs.
- **Lateral Movement & Privilege Escalation:** Accessing unusual sequences of resources.
- **Data Exfiltration:** Large data transfers over extended sessions during off-hours.

### 2. Explainable AI (XAI)
A risk score is useless without context. Sentinel utilizes a robust `Isolation Forest` ensemble model. When an event is flagged, the model computes **Explainability Factors** (e.g., *"Source IP deviates from historical baseline"*, *"Anomalous Device Fingerprint"*), allowing analysts to understand *why* an alert fired.

### 3. Entity Tracking & Concept Drift Mitigation
To combat Concept Drift (where legitimate user behavior naturally evolves over time), our frontend features an **Entity Tracking** engine. Analysts can query any `entity_id` to visualize their complete historical timeline, comparing standard baselines against sudden malicious spikes to accurately tune false-positives.

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
uvicorn src.behavioral_anomaly.api.main:app --reload --port 8000
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
