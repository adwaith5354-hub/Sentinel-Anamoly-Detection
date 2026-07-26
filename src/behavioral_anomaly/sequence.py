"""PyTorch LSTM autoencoder for temporal anomaly reconstruction error."""

from __future__ import annotations

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler


class LSTMAutoencoder(nn.Module):
    def __init__(self, feature_count: int, hidden_size: int = 32):
        super().__init__()
        self.encoder = nn.LSTM(feature_count, hidden_size, batch_first=True)
        self.decoder = nn.LSTM(hidden_size, hidden_size, batch_first=True)
        self.output = nn.Linear(hidden_size, feature_count)

    def forward(self, sequence: torch.Tensor) -> torch.Tensor:
        _, (hidden, _) = self.encoder(sequence)
        # hidden is (num_layers=1, batch, hidden_size)
        repeated = hidden[-1].unsqueeze(1).expand(-1, sequence.size(1), -1)
        decoded, _ = self.decoder(repeated)
        return self.output(decoded)


class SequenceDataset(Dataset):
    def __init__(self, data: np.ndarray, seq_length: int = 5):
        self.data = torch.FloatTensor(data)
        self.seq_length = seq_length
        # Note: In a real production system we would group by entity_id, 
        # but for this challenge's evaluation format we apply sliding window 
        # to capture temporal sequential changes globally.
        self.num_samples = len(self.data) - self.seq_length + 1

    def __len__(self):
        return max(0, self.num_samples)

    def __getitem__(self, idx):
        return self.data[idx : idx + self.seq_length]


class SequenceDetector:
    def __init__(self, seq_length: int = 5, epochs: int = 5, hidden_size: int = 32, batch_size: int = 64):
        self.seq_length = seq_length
        self.epochs = epochs
        self.hidden_size = hidden_size
        self.batch_size = batch_size
        self.model = None
        self.scaler = StandardScaler()
        self.feature_cols = [
            "hour", "is_weekend", "time_since_last_login", "geo_velocity_kmh",
            "new_device", "new_country", "failed_login", "bytes_transferred_log",
            "is_sensitive_resource", "resource_novelty"
        ]

    def _prepare_data(self, df: pd.DataFrame, fit_scaler: bool = False) -> np.ndarray:
        # Extract features
        X = df[self.feature_cols].copy()
        # Handle nans
        X = X.fillna(0)
        if fit_scaler:
            return self.scaler.fit_transform(X)
        return self.scaler.transform(X)

    def fit(self, events: pd.DataFrame) -> "SequenceDetector":
        X = self._prepare_data(events, fit_scaler=True)
        dataset = SequenceDataset(X, self.seq_length)
        dataloader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)
        
        self.model = LSTMAutoencoder(feature_count=X.shape[1], hidden_size=self.hidden_size)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.01)
        criterion = nn.MSELoss()
        
        self.model.train()
        for epoch in range(self.epochs):
            total_loss = 0
            for batch in dataloader:
                optimizer.zero_grad()
                reconstructed = self.model(batch)
                loss = criterion(reconstructed, batch)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
            # print(f"Epoch {epoch+1}/{self.epochs}, Loss: {total_loss/len(dataloader):.4f}")
        return self

    def score(self, events: pd.DataFrame) -> pd.DataFrame:
        X = self._prepare_data(events, fit_scaler=False)
        dataset = SequenceDataset(X, self.seq_length)
        dataloader = DataLoader(dataset, batch_size=self.batch_size, shuffle=False)
        
        self.model.eval()
        reconstruction_errors = []
        criterion = nn.MSELoss(reduction='none')
        
        with torch.no_grad():
            for batch in dataloader:
                reconstructed = self.model(batch)
                # MSE per sequence (average over seq_length and features)
                errors = criterion(reconstructed, batch).mean(dim=(1, 2)).numpy()
                reconstruction_errors.extend(errors)
                
        # Since we use a sliding window, the first few events (seq_length-1) don't have a full sequence prediction.
        # We will pad the beginning with the first available error so the length matches the dataframe.
        pad_length = len(events) - len(reconstruction_errors)
        if pad_length > 0:
            pad = [reconstruction_errors[0]] * pad_length if reconstruction_errors else [0] * pad_length
            reconstruction_errors = pad + reconstruction_errors
            
        # Normalize errors to 0-1 range for anomaly_score
        errors = np.array(reconstruction_errors)
        min_err = errors.min()
        max_err = errors.max()
        if max_err > min_err:
            normalized_scores = (errors - min_err) / (max_err - min_err)
        else:
            normalized_scores = np.zeros_like(errors)
            
        result = events.copy()
        result["anomaly_score"] = normalized_scores
        
        # We flag the top 4% as anomalies (similar to contamination factor in IsolationForest)
        threshold = np.percentile(normalized_scores, 96)
        result["is_flagged"] = (result["anomaly_score"] >= threshold).astype(int)
        return result

    def save(self, path: str):
        # We can just save the entire object with torch/joblib, 
        # or just let joblib handle it in the pipeline script.
        # But pipeline.py specifically calls self.detector.save(path)
        import joblib
        joblib.dump(self, path)

