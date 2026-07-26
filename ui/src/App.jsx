import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, Activity, Users, X, Mail, LayoutDashboard, Bell, FileText, Settings, Database, ActivityIcon, Server, Download, Lock, TrendingUp } from 'lucide-react';
import './App.css';

axios.defaults.baseURL = 'https://sentinel-anamoly-detection.onrender.com';

// Custom GitHub Icon Component
const GithubIcon = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
);

// Components
const StatCard = ({ title, value, valueColor = 'dark', subtitle }) => (
  <div className="card stat-card">
    <h3 className="stat-title">{title}</h3>
    <p className={`stat-value ${valueColor}`}>{value}</p>
    {subtitle && <p style={{ fontSize: '0.75rem', color: 'var(--color-safe)', marginTop: '8px' }}>↑ {subtitle}</p>}
  </div>
);

const ProgressBar = ({ score }) => {
  let colorClass = 'progress-safe';
  if (score >= 0.8) colorClass = 'progress-critical';
  else if (score >= 0.5) colorClass = 'progress-high';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="progress-bg" style={{ flex: 1 }}>
        <div className={`progress-fill ${colorClass}`} style={{ width: `${score * 100}%` }}></div>
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{score.toFixed(3)}</span>
    </div>
  );
};

const getSeverityLabel = (score) => {
  if (score >= 0.8) return { label: 'Critical', class: 'badge-critical' };
  if (score >= 0.5) return { label: 'High', class: 'badge-high' };
  return { label: 'Medium', class: 'badge-medium' };
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Alert Filters
  const [minScore, setMinScore] = useState(0.5);
  const [showAll, setShowAll] = useState(false);
  const [attackFilter, setAttackFilter] = useState('');
  
  // Drilldown states
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  
  // Entity Tracking states
  const [searchEntityId, setSearchEntityId] = useState('');
  const [entityHistory, setEntityHistory] = useState([]);
  const [entityLoading, setEntityLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/alerts', {
        params: { min_score: minScore, show_all: showAll, attack_types: attackFilter }
      });
      setAlerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      if (activeTab === 'Alerts') {
        fetchAlerts();
      }
    }
  }, [minScore, showAll, attackFilter, activeTab, isAuthenticated]);

  const fetchDetail = async (id) => {
    setSelectedEventId(id);
    setEventDetail(null);
    try {
      const res = await axios.get(`/api/alerts/${id}`);
      setEventDetail(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEntityHistory = async (e) => {
    e.preventDefault();
    if (!searchEntityId) return;
    setEntityLoading(true);
    setEntityHistory([]);
    try {
      const res = await axios.get(`/api/entities/${searchEntityId}/history`);
      setEntityHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setEntityLoading(false);
    }
  };

  const exportToCSV = () => {
    if (alerts.length === 0) return;
    const headers = ['Event ID', 'Timestamp', 'Entity ID', 'Anomaly Type', 'Risk Score'];
    const csvRows = alerts.map(a => 
      `${a.event_id},${a.timestamp},${a.entity_id},${a.predicted_anomaly_type || 'Unknown'},${a.anomaly_score}`
    );
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_alerts_${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div className="card" style={{ padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <Shield size={48} style={{ color: 'var(--accent-secondary)', margin: '0 auto 16px' }} />
          <h2 style={{ marginBottom: '8px' }}>SENTINEL SOC</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Enterprise Authentication</p>
          <button className="btn" style={{ width: '100%' }} onClick={() => setIsAuthenticated(true)}>
            <Lock size={16} /> Login as Analyst (Demo)
          </button>
        </div>
      </div>
    );
  }

  // Page Renderers
  const renderOverview = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>System Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-safe)', fontWeight: 500, background: '#f1fcf8', padding: '8px 16px', borderRadius: '24px', border: '1px solid #a7f3d0' }}>
          <ActivityIcon size={18} />
          Machine Learning Engine Active
        </div>
      </div>
      
      <div className="stats-grid">
        <StatCard title="Critical Alerts (Flagged)" value={stats?.flagged_events || '-'} valueColor="critical" />
        <StatCard title="Active Threat Types" value={stats?.distinct_anomaly_types || '-'} valueColor="safe" />
        <StatCard title="Total Events Analyzed" value={stats?.total_events || '-'} />
        <StatCard title="Monitored Entities" value={stats?.distinct_entities || '-'} />
      </div>

      <div className="card" style={{ marginTop: '24px', padding: '32px', textAlign: 'center' }}>
        <Shield size={64} style={{ color: 'var(--accent-secondary)', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Sentinel ML is Protecting Your Network</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          The Sentinel Anomaly Detection engine is continuously ingesting logs, analyzing behavioral drift, and flagging potential threats in real-time. Use the sidebar to drill down into specific alerts or track suspicious entities.
        </p>
      </div>
    </>
  );

  const renderAlertQueue = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Active Alert Queue</h2>
        <button className="btn btn-outline" onClick={exportToCSV}>
          <Download size={16} /> Export to CSV
        </button>
      </div>
      
      <div className="main-layout">
        {/* Filters */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Filter Rules</h3>
          
          <label className="form-label">Minimum Risk Score ({minScore})</label>
          <input 
            type="range" 
            className="form-control" 
            min="0" max="1" step="0.05" 
            value={minScore} 
            onChange={(e) => setMinScore(parseFloat(e.target.value))}
            style={{ padding: 0, marginBottom: '16px' }}
          />
          
          <label className="form-label">Specific Attack Type</label>
          <select 
            className="form-control" 
            value={attackFilter} 
            onChange={(e) => setAttackFilter(e.target.value)}
            style={{ marginBottom: '16px' }}
          >
            <option value="">All Anomalies</option>
            <option value="brute_force">Brute Force</option>
            <option value="impossible_travel">Impossible Travel</option>
            <option value="credential_stuffing">Credential Stuffing</option>
            <option value="lateral_movement">Lateral Movement</option>
            <option value="data_exfiltration">Data Exfiltration</option>
            <option value="privilege_escalation">Privilege Escalation</option>
            <option value="insider_drift">Insider Drift</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '24px' }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Include Normal Traffic (Unflagged)
          </label>

          <button className="btn" style={{ width: '100%' }} onClick={fetchAlerts}>
            Refresh Queue
          </button>
        </div>

        {/* Table & Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Scanning for alerts...</div>
              ) : (
                <table>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                    <tr>
                      <th>ID</th>
                      <th>Timestamp</th>
                      <th>Severity</th>
                      <th>Entity ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => {
                      const severity = getSeverityLabel(alert.anomaly_score);
                      return (
                        <tr 
                          key={alert.event_id} 
                          className={selectedEventId === alert.event_id ? 'selected' : ''}
                          style={{ cursor: 'pointer' }} 
                          onClick={() => fetchDetail(alert.event_id)}
                        >
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>EVT-{alert.event_id.substring(0,6)}</td>
                          <td>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td><span className={`badge ${severity.class}`}>{severity.label}</span></td>
                          <td><span style={{ fontWeight: 500 }}>{alert.entity_id}</span></td>
                          <td style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>Investigate</td>
                        </tr>
                      );
                    })}
                    {alerts.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                          No threats detected with current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Detail View */}
          {selectedEventId && (
            <div className="card" style={{ borderLeft: '4px solid var(--color-critical)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Incident Forensics: EVT-{selectedEventId.substring(0,6)}</h3>
                <button className="btn-outline" onClick={() => setSelectedEventId(null)} style={{ padding: '4px', borderRadius: '4px', border: 'none' }}><X size={20} /></button>
              </div>
              
              {eventDetail ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>AI Classification</h4>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-critical)', margin: '4px 0' }}>{eventDetail.predicted_anomaly_type}</p>
                    {eventDetail.classification_confidence && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Confidence Level: {(eventDetail.classification_confidence * 100).toFixed(1)}%</div>
                    )}
                    
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Risk Score</h4>
                    <div style={{ maxWidth: '200px', margin: '8px 0 16px 0' }}><ProgressBar score={eventDetail.anomaly_score} /></div>
                    
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Explainability Factors</h4>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      {eventDetail.explanation_factors && eventDetail.explanation_factors.map((factor, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="terminal-block">
                      <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Raw Telemetry Payload</h4>
                      <div><span className="terminal-key">"ip_address"</span>: <span className="terminal-string">"{eventDetail.source_ip}"</span>,</div>
                      <div><span className="terminal-key">"country"</span>: <span className="terminal-string">"{eventDetail.country}"</span>,</div>
                      <div><span className="terminal-key">"device_fp"</span>: <span className="terminal-string">"{eventDetail.device_fingerprint}"</span>,</div>
                      {eventDetail.auth_method && <div><span className="terminal-key">"auth_method"</span>: <span className="terminal-string">"{eventDetail.auth_method}"</span>,</div>}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Extracting forensics...</div>
              )}
            </div>
          )}
          
        </div>
      </div>
    </>
  );

  const renderEntityTracking = () => (
    <>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Entity Behavior Tracking</h2>
      
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <form onSubmit={fetchEntityHistory} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Search Entity ID (e.g., user_0010)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Enter User ID or IP Address..."
              value={searchEntityId}
              onChange={(e) => setSearchEntityId(e.target.value)}
            />
          </div>
          <button type="submit" className="btn" disabled={!searchEntityId || entityLoading}>
            Analyze History
          </button>
        </form>
      </div>

      {entityLoading && <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>Loading entity data...</div>}
      
      {!entityLoading && entityHistory.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '24px' }}>Historical Timeline for {searchEntityId}</h3>
          <div>
            {entityHistory.map((item, index) => (
              <div key={index} className={`timeline-item ${item.is_anomaly ? 'anomalous' : ''}`}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {new Date(item.timestamp).toLocaleString()}
                </div>
                <div style={{ fontWeight: 500, margin: '4px 0' }}>
                  {item.action || 'Unknown Event'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  IP: {item.source_ip} &bull; Score: {item.anomaly_score?.toFixed(3) || '0.000'}
                  {item.is_anomaly && <span style={{ color: 'var(--color-critical)', marginLeft: '8px', fontWeight: 600 }}>FLAGGED</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!entityLoading && entityHistory.length === 0 && searchEntityId && (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          No historical data found for this entity.
        </div>
      )}
    </>
  );

  const renderModelMetrics = () => (
    <>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Model Performance & Analytics</h2>
      
      <div className="stats-grid">
        <StatCard title="Incident Recall@K" value="0.800" subtitle="48/60 campaigns" />
        <StatCard title="Incident Precision@K" value="0.095" subtitle="ceiling 0.119 — budget-bound" />
        <StatCard title="PR-AUC" value="0.637" subtitle="32x random (0.0199)" />
        <StatCard title="Precision@1%" value="0.883" valueColor="safe" subtitle="ceiling 1.000" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Signal Weights</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Analyst priors divided by unsupervised reliability term. Never learned from labels.
          </p>
          <table style={{ border: '1px solid var(--border-color)', borderRadius: '8px', width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Signal</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '8px' }}>fingerprint_mismatch</td><td style={{ padding: '8px' }}>0.7550</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '8px' }}>country_novelty</td><td style={{ padding: '8px' }}>0.7000</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '8px' }}>fail_rate_entity</td><td style={{ padding: '8px' }}>0.5620</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '8px' }}>geo_velocity</td><td style={{ padding: '8px' }}>0.5030</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '8px' }}>auth_method_novelty</td><td style={{ padding: '8px' }}>0.5000</td></tr>
              <tr><td style={{ padding: '8px' }}>burst_ratio</td><td style={{ padding: '8px' }}>0.4800</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Cold-Start Analysis</h3>
          <ul style={{ lineHeight: '1.8', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            <li><strong>Cold-start events:</strong> 4,375 (3.3% of stream)</li>
            <li><strong>Share of top-1% budget:</strong> 12.5%</li>
            <li><strong>Precision, cold alerts:</strong> <span style={{ color: 'var(--color-critical)', fontWeight: 600 }}>95.8%</span></li>
            <li><strong>Precision, warm alerts:</strong> 87.3%</li>
          </ul>
          <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Cold-start entities take 12.5% of the budget while being 3.3% of traffic. That over-representation is earned: those alerts are 95.8% malicious.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Anomaly-Type Confusion Matrix</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Predicted vs actual over detected alerts. Exact-match accuracy 0.542. Attribution is rule-based over named evidence.
        </p>
        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Actual</th>
                <th>brute_force</th>
                <th>credential_stuffing</th>
                <th>device_spoofing</th>
                <th>impossible_travel</th>
                <th>lateral_movement</th>
                <th>low_and_slow</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px', textAlign: 'left' }}>brute_force</td><td>1</td><td>1</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px', textAlign: 'left' }}>credential_stuffing</td><td>0</td><td>16</td><td>1</td><td>0</td><td>0</td><td>0</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px', textAlign: 'left' }}>device_spoofing</td><td>0</td><td>0</td><td>8</td><td>0</td><td>2</td><td>0</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px', textAlign: 'left' }}>impossible_travel</td><td>0</td><td>0</td><td>0</td><td>7</td><td>1</td><td>0</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px', textAlign: 'left' }}>insider_drift</td><td>0</td><td>1</td><td>0</td><td>1</td><td>9</td><td>1</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px', textAlign: 'left' }}>lateral_movement</td><td>0</td><td>0</td><td>0</td><td>0</td><td>12</td><td>1</td></tr>
              <tr><td style={{ padding: '12px', textAlign: 'left' }}>low_and_slow</td><td>0</td><td>0</td><td>1</td><td>0</td><td>25</td><td>8</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>False Positives by Engineered Benign Behaviour</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Confounders are injected at 4x the attack rate specifically to trip each detector layer. This is evidence that 'unusual' does not always mean 'malicious'.
        </p>
        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Confounder</th>
                <th style={{ textAlign: 'right' }}>False Positives</th>
                <th style={{ textAlign: 'right' }}>Total Events</th>
                <th style={{ textAlign: 'right' }}>FP Rate</th>
                <th style={{ textAlign: 'right' }}>Share of Alert Budget</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>(none - ordinary benign)</td><td style={{ textAlign: 'right' }}>106</td><td style={{ textAlign: 'right' }}>124872</td><td style={{ textAlign: 'right' }}>0.0008</td><td style={{ textAlign: 'right' }}>0.0803</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>ci_automation_burst</td><td style={{ textAlign: 'right' }}>19</td><td style={{ textAlign: 'right' }}>1293</td><td style={{ textAlign: 'right' }}>0.0147</td><td style={{ textAlign: 'right' }}>0.0144</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>cert_retry_loop</td><td style={{ textAlign: 'right' }}>13</td><td style={{ textAlign: 'right' }}>480</td><td style={{ textAlign: 'right' }}>0.0271</td><td style={{ textAlign: 'right' }}>0.0098</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>shared_jump_host</td><td style={{ textAlign: 'right' }}>11</td><td style={{ textAlign: 'right' }}>921</td><td style={{ textAlign: 'right' }}>0.0119</td><td style={{ textAlign: 'right' }}>0.0083</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>maintenance_window</td><td style={{ textAlign: 'right' }}>2</td><td style={{ textAlign: 'right' }}>436</td><td style={{ textAlign: 'right' }}>0.0046</td><td style={{ textAlign: 'right' }}>0.0015</td></tr>
              <tr><td style={{ padding: '12px' }}>os_patch</td><td style={{ textAlign: 'right' }}>2</td><td style={{ textAlign: 'right' }}>665</td><td style={{ textAlign: 'right' }}>0.0030</td><td style={{ textAlign: 'right' }}>0.0015</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderRobustness = () => (
    <>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>Model Robustness & Drift Analysis</h2>
      
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Concept Drift and Baseline Poisoning</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          The adaptation/rigidity trade-off is demonstrated and large. The poisoning claim is not met, and is reported as a negative result.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <StatCard title="Frozen baseline" value="23.7" subtitle="false alerts on ONE legit entity" valueColor="critical" />
          <StatCard title="Adaptive updating" value="0.5" subtitle="same entity, 47x fewer" valueColor="safe" />
          <StatCard title="Poisoning resistance" value="not shown" subtitle="0.765 vs 0.751, p=0.05" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Held-out Seeds</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Run once under a frozen config.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <StatCard title="Incident recall" value="0.824" subtitle="holdout mean" />
          <StatCard title="PR-AUC" value="0.611" subtitle="holdout mean" />
          <StatCard title="R-Precision" value="0.569" subtitle="holdout mean" />
        </div>
        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>eval</th>
                <th style={{ textAlign: 'right' }}>prevalence</th>
                <th style={{ textAlign: 'right' }}>incident_recall</th>
                <th style={{ textAlign: 'right' }}>precision_at_1pct</th>
                <th style={{ textAlign: 'right' }}>r_precision</th>
                <th style={{ textAlign: 'right' }}>pr_auc</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>seed101_delta05</td><td style={{ textAlign: 'right' }}>0.019</td><td style={{ textAlign: 'right' }}>0.706</td><td style={{ textAlign: 'right' }}>0.853</td><td style={{ textAlign: 'right' }}>0.553</td><td style={{ textAlign: 'right' }}>0.613</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>seed102_delta05</td><td style={{ textAlign: 'right' }}>0.018</td><td style={{ textAlign: 'right' }}>0.750</td><td style={{ textAlign: 'right' }}>0.867</td><td style={{ textAlign: 'right' }}>0.506</td><td style={{ textAlign: 'right' }}>0.567</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>seed103_delta05</td><td style={{ textAlign: 'right' }}>0.007</td><td style={{ textAlign: 'right' }}>0.800</td><td style={{ textAlign: 'right' }}>0.470</td><td style={{ textAlign: 'right' }}>0.589</td><td style={{ textAlign: 'right' }}>0.610</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>seed104_delta05</td><td style={{ textAlign: 'right' }}>0.009</td><td style={{ textAlign: 'right' }}>0.944</td><td style={{ textAlign: 'right' }}>0.599</td><td style={{ textAlign: 'right' }}>0.624</td><td style={{ textAlign: 'right' }}>0.648</td></tr>
              <tr><td style={{ padding: '12px' }}>seed105_delta05</td><td style={{ textAlign: 'right' }}>0.006</td><td style={{ textAlign: 'right' }}>0.920</td><td style={{ textAlign: 'right' }}>0.418</td><td style={{ textAlign: 'right' }}>0.572</td><td style={{ textAlign: 'right' }}>0.619</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Layer Ablation — does each layer earn its keep?</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Δ Precision@1% vs the full model across four eval seeds. L0 and L3 are load-bearing; L1 and L2 straddle zero.
        </p>
        <div className="table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>config</th>
                <th style={{ textAlign: 'right' }}>seed101_delta05</th>
                <th style={{ textAlign: 'right' }}>seed102_delta05</th>
                <th style={{ textAlign: 'right' }}>seed103_delta05</th>
                <th style={{ textAlign: 'right' }}>seed3_delta05</th>
                <th style={{ textAlign: 'right' }}>mean</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>full (all layers)</td><td style={{ textAlign: 'right' }}>+0.000</td><td style={{ textAlign: 'right' }}>+0.000</td><td style={{ textAlign: 'right' }}>+0.000</td><td style={{ textAlign: 'right' }}>+0.000</td><td style={{ textAlign: 'right' }}>+0.000</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>without L0 deterministic rules</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.539</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.421</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.208</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.391</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.389</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>without L1 per-entity baseline</td><td style={{ textAlign: 'right', color: 'var(--color-safe)' }}>+0.013</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.020</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.033</td><td style={{ textAlign: 'right', color: 'var(--color-safe)' }}>+0.025</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.004</td></tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}><td style={{ padding: '12px' }}>without L2 sequence</td><td style={{ textAlign: 'right', color: 'var(--color-safe)' }}>+0.008</td><td style={{ textAlign: 'right', color: 'var(--color-safe)' }}>+0.016</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.016</td><td style={{ textAlign: 'right', color: 'var(--color-safe)' }}>+0.024</td><td style={{ textAlign: 'right', color: 'var(--color-safe)' }}>+0.008</td></tr>
              <tr><td style={{ padding: '12px' }}>without L3 graph / long window</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.229</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.235</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.008</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.130</td><td style={{ textAlign: 'right', color: 'var(--color-critical)' }}>-0.150</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderApiConfig = () => (
    <>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '24px' }}>API & Integrations</h2>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Server size={24} style={{ color: 'var(--accent-secondary)' }} />
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Render Cloud Backend</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          The machine learning inference engine is securely hosted on Render, serving a high-performance FastAPI endpoint.
        </p>
        
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Active Endpoints</h4>
        <div className="terminal-block" style={{ marginBottom: '24px' }}>
          <div><span style={{ color: 'var(--color-safe)' }}>GET</span> /api/stats <span style={{ color: 'var(--text-muted)' }}>- System overview</span></div>
          <div><span style={{ color: 'var(--color-safe)' }}>GET</span> /api/alerts <span style={{ color: 'var(--text-muted)' }}>- Query anomaly queue</span></div>
          <div><span style={{ color: 'var(--color-safe)' }}>GET</span> /api/alerts/&#123;id&#125; <span style={{ color: 'var(--text-muted)' }}>- Fetch incident forensics</span></div>
          <div><span style={{ color: 'var(--color-safe)' }}>GET</span> /api/entities/&#123;id&#125;/history <span style={{ color: 'var(--text-muted)' }}>- Retrieve user timeline</span></div>
        </div>

        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>System Logs</h4>
        <div className="terminal-block" style={{ marginBottom: '24px' }}>
          <div>[INFO] Model isolation_forest_v2 loaded into memory.</div>
          <div>[INFO] Ingesting telemetry stream from Kafka broker.</div>
          <div>[WARN] High volume of anomalous packets dropped from 45.33.21.12.</div>
          <div>[INFO] Generating daily evaluation report...</div>
        </div>
        
        <a href={`${axios.defaults.baseURL}/docs`} target="_blank" rel="noreferrer" className="btn btn-outline">
          View Swagger Documentation
        </a>
      </div>
    </>
  );

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className={`sidebar-item ${activeTab === 'Overview' ? 'active' : ''}`} onClick={() => setActiveTab('Overview')}>
          <LayoutDashboard size={20} />
          Overview
        </div>
        <div className={`sidebar-item ${activeTab === 'Alerts' ? 'active' : ''}`} onClick={() => setActiveTab('Alerts')}>
          <ShieldAlert size={20} />
          Alert Queue
        </div>
        <div className={`sidebar-item ${activeTab === 'Entity' ? 'active' : ''}`} onClick={() => setActiveTab('Entity')}>
          <Users size={20} />
          Entity Tracking
        </div>
        <div className={`sidebar-item ${activeTab === 'Metrics' ? 'active' : ''}`} onClick={() => setActiveTab('Metrics')}>
          <Activity size={20} />
          Model Metrics
        </div>
        <div className={`sidebar-item ${activeTab === 'Robustness' ? 'active' : ''}`} onClick={() => setActiveTab('Robustness')}>
          <TrendingUp size={20} />
          Robustness
        </div>
        <div className={`sidebar-item ${activeTab === 'API' ? 'active' : ''}`} onClick={() => setActiveTab('API')}>
          <Database size={20} />
          API Config
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="sidebar-item" onClick={() => setIsAuthenticated(false)}>
          <Lock size={20} />
          Logout
        </div>
      </aside>

      <div className="main-wrapper">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <span className="header-title">SENTINEL <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>| Anomaly Detection</span></span>
          </div>
          <div className="header-right">
            <span>{todayStr}</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span style={{ fontWeight: 500 }}>Developed by Adwaith Binoy</span>
            <a href="https://github.com/adwaith5354-hub/Sentinel-Anamoly-Detection" target="_blank" rel="noreferrer" title="GitHub">
              <GithubIcon size={20} />
            </a>
            <a href="mailto:contact@adwaith.com" title="Email">
              <Mail size={20} />
            </a>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="content-area">
          {activeTab === 'Overview' && renderOverview()}
          {activeTab === 'Alerts' && renderAlertQueue()}
          {activeTab === 'Entity' && renderEntityTracking()}
          {activeTab === 'Metrics' && renderModelMetrics()}
          {activeTab === 'Robustness' && renderRobustness()}
          {activeTab === 'API' && renderApiConfig()}
        </div>
      </div>
    </div>
  );
}

export default App;
