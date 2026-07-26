import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, Activity, Users, ChevronRight, X, Mail, LayoutDashboard, Bell, FileText, Settings, HelpCircle } from 'lucide-react';
import './App.css';

axios.defaults.baseURL = 'https://sentinel-anamoly-detection.onrender.com';

// Components
const StatCard = ({ title, value, valueColor = 'dark' }) => (
  <div className="card stat-card">
    <h3 className="stat-title">{title}</h3>
    <p className={`stat-value ${valueColor}`}>{value}</p>
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

function App() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0.5);
  const [showAll, setShowAll] = useState(false);
  const [attackFilter, setAttackFilter] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [entityHistory, setEntityHistory] = useState([]);

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
    fetchStats();
    fetchAlerts();
  }, [minScore, showAll, attackFilter]);

  const fetchDetail = async (id, entityId) => {
    setSelectedEventId(id);
    setEventDetail(null);
    setEntityHistory([]);
    try {
      const res = await axios.get(`/api/alerts/${id}`);
      setEventDetail(res.data);
      
      if (entityId) {
        const histRes = await axios.get(`/api/entities/${entityId}/history`);
        setEntityHistory(histRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityLabel = (score) => {
    if (score >= 0.8) return { label: 'Critical', class: 'badge-critical' };
    if (score >= 0.5) return { label: 'High', class: 'badge-high' };
    return { label: 'Medium', class: 'badge-medium' };
  };

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-item active">
          <LayoutDashboard size={20} />
          Overview
        </div>
        <div className="sidebar-item">
          <Bell size={20} />
          Alerts
        </div>
        <div className="sidebar-item">
          <ShieldAlert size={20} />
          Threats
        </div>
        <div className="sidebar-item">
          <FileText size={20} />
          Reports
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="sidebar-item">
          <Settings size={20} />
          Settings
        </div>
        <div className="sidebar-item">
          <HelpCircle size={20} />
          Support
        </div>
      </aside>

      <div className="main-wrapper">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <span className="header-title">AURORA <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>| SOC</span></span>
          </div>
          <div className="header-right">
            <span>{todayStr}</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span style={{ fontWeight: 500 }}>Developed by Adwaith Binoy</span>
            <a href="https://github.com/adwaith5354-hub/Sentinel-Anamoly-Detection" target="_blank" rel="noreferrer" title="GitHub">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
            </a>
            <a href="mailto:contact@adwaith.com" title="Email">
              <Mail size={20} />
            </a>
          </div>
        </header>

        <div className="content-area">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>AURORA SOC <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>| Security Overview</span></h2>
          
          {/* Stats Row */}
          <div className="stats-grid">
            <StatCard title="Critical Alerts (Flagged)" value={stats?.flagged_events || '-'} valueColor="critical" />
            <StatCard title="Active Threat Types" value={stats?.distinct_anomaly_types || '-'} valueColor="safe" />
            <StatCard title="Total Events Analyzed" value={stats?.total_events || '-'} />
            <StatCard title="Monitored Entities" value={stats?.distinct_entities || '-'} />
          </div>

          <div className="main-layout">
            {/* Filters */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px' }}>Alert Filters</h3>
              <label className="form-label">Minimum Anomaly Score ({minScore})</label>
              <input 
                type="range" 
                className="form-control" 
                min="0" max="1" step="0.05" 
                value={minScore} 
                onChange={(e) => setMinScore(parseFloat(e.target.value))}
                style={{ padding: 0, marginBottom: '16px' }}
              />
              
              <label className="form-label">Filter by Attack Type</label>
              <select 
                className="form-control" 
                value={attackFilter} 
                onChange={(e) => setAttackFilter(e.target.value)}
                style={{ marginBottom: '16px' }}
              >
                <option value="">All Types</option>
                <option value="brute_force">Brute Force</option>
                <option value="impossible_travel">Impossible Travel</option>
                <option value="credential_stuffing">Credential Stuffing</option>
                <option value="lateral_movement">Lateral Movement</option>
                <option value="data_exfiltration">Data Exfiltration</option>
                <option value="privilege_escalation">Privilege Escalation</option>
                <option value="insider_drift">Insider Drift</option>
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                />
                Show all events (unflagged included)
              </label>

              <button className="btn" style={{ width: '100%' }} onClick={fetchAlerts}>
                Apply Filters
              </button>
            </div>

            {/* Table & Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Recent Security Incidents</h3>
                </div>
                
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {loading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading alerts...</div>
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
                              onClick={() => fetchDetail(alert.event_id, alert.entity_id)}
                            >
                              <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>SOC-{alert.event_id.substring(0,6)}</td>
                              <td>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td><span className={`badge ${severity.class}`}>{severity.label}</span></td>
                              <td>{alert.entity_id}</td>
                              <td style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Investigate</td>
                            </tr>
                          );
                        })}
                        {alerts.length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              No alerts found for the current filters.
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
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Incident Details: SOC-{selectedEventId.substring(0,6)}</h3>
                    <button className="btn-outline" onClick={() => setSelectedEventId(null)} style={{ padding: '4px', borderRadius: '4px', border: 'none' }}><X size={20} /></button>
                  </div>
                  
                  {eventDetail ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div>
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Classification</h4>
                        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-critical)', margin: '4px 0' }}>{eventDetail.predicted_anomaly_type}</p>
                        {eventDetail.classification_confidence && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Confidence: {(eventDetail.classification_confidence * 100).toFixed(1)}%</div>
                        )}
                        
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Risk Score</h4>
                        <div style={{ maxWidth: '200px', margin: '8px 0 16px 0' }}><ProgressBar score={eventDetail.anomaly_score} /></div>
                        
                        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Explanation</h4>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                          {eventDetail.explanation_factors && eventDetail.explanation_factors.map((factor, i) => (
                            <li key={i} style={{ marginBottom: '4px' }}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="terminal-block">
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Raw Event Payload</h4>
                          <div><span className="terminal-key">"ip_address"</span>: <span className="terminal-string">"{eventDetail.source_ip}"</span>,</div>
                          <div><span className="terminal-key">"country"</span>: <span className="terminal-string">"{eventDetail.country}"</span>,</div>
                          <div><span className="terminal-key">"device_fp"</span>: <span className="terminal-string">"{eventDetail.device_fingerprint}"</span>,</div>
                          {eventDetail.auth_method && <div><span className="terminal-key">"auth_method"</span>: <span className="terminal-string">"{eventDetail.auth_method}"</span>,</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>Loading details...</div>
                  )}
                </div>
              )}
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
