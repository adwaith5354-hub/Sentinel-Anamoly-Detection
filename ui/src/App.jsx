import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, Activity, Users, ChevronRight, X } from 'lucide-react';
import './App.css';

// Components
const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="glass-card animate-fade-in">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h3>
        <p style={{ fontSize: '2rem', fontWeight: '700', marginTop: '4px', color: 'var(--text-primary)' }}>
          {value}
        </p>
      </div>
      <div className={colorClass} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
        <Icon size={24} />
      </div>
    </div>
  </div>
);

const ProgressBar = ({ score }) => {
  let colorClass = 'progress-success';
  if (score >= 0.8) colorClass = 'progress-danger';
  else if (score >= 0.5) colorClass = 'progress-warning';
  
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
        params: { min_score: minScore, show_all: showAll }
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
  }, [minScore, showAll]);

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

  return (
    <div className="app-container">
      <header className="header animate-fade-in">
        <ShieldAlert size={32} color="var(--accent-primary)" />
        <h1>Sentinel Anomaly Detection</h1>
      </header>

      {/* Stats Row */}
      <div className="stats-grid">
        <StatCard title="Total Events" value={stats?.total_events || '-'} icon={Activity} colorClass="text-accent" />
        <StatCard title="Flagged Events" value={stats?.flagged_events || '-'} icon={ShieldAlert} colorClass="text-danger" />
        <StatCard title="Anomaly Types" value={stats?.distinct_anomaly_types || '-'} icon={Shield} colorClass="text-warning" />
        <StatCard title="Distinct Entities" value={stats?.distinct_entities || '-'} icon={Users} colorClass="text-accent" />
      </div>

      <div className="main-content">
        {/* Sidebar Filters */}
        <aside className="glass-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3>Filters</h3>
          <div className="input-group" style={{ marginTop: '16px' }}>
            <label className="input-label">Minimum Anomaly Score ({minScore})</label>
            <input 
              type="range" 
              className="form-control" 
              min="0" max="1" step="0.05" 
              value={minScore} 
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              style={{ padding: 0 }}
            />
          </div>
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input 
                type="checkbox" 
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              Show all events (unflagged included)
            </label>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={fetchAlerts}>
            Refresh Data
          </button>
        </aside>

        {/* Main Data Table Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          
          <div className="glass-card animate-fade-in" style={{ animationDelay: '0.2s', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0 }}>Alert Queue <span className="badge badge-danger" style={{ marginLeft: '8px' }}>{alerts.length}</span></h3>
            </div>
            
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading alerts...</div>
              ) : (
                <table>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th>Time</th>
                      <th>Entity ID</th>
                      <th>Resource</th>
                      <th>Type</th>
                      <th>Score</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr 
                        key={alert.event_id} 
                        className={`${selectedEventId === alert.event_id ? 'selected' : ''} ${alert.is_flagged && alert.anomaly_score > 0.8 ? 'high-risk pulse-alert' : ''}`}
                        style={{ cursor: 'pointer' }} 
                        onClick={() => fetchDetail(alert.event_id, alert.entity_id)}
                      >
                        <td className="mono">{new Date(alert.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="mono" style={{ color: 'var(--accent-primary)' }}>{alert.entity_id}</td>
                        <td>{alert.resource}</td>
                        <td>
                          <span className={`badge ${alert.is_flagged ? 'badge-danger' : 'badge-success'}`}>
                            {alert.predicted_anomaly_type || 'normal'}
                          </span>
                        </td>
                        <td style={{ width: '150px' }}><ProgressBar score={alert.anomaly_score} /></td>
                        <td style={{ textAlign: 'right' }}><ChevronRight size={16} color="var(--text-secondary)" /></td>
                      </tr>
                    ))}
                    {alerts.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
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
            <div className="glass-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <h3>Alert Details</h3>
                <button className="btn" onClick={() => setSelectedEventId(null)} style={{ padding: '4px' }}><X size={20} /></button>
              </div>
              
              {eventDetail ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Classification</h4>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>{eventDetail.predicted_anomaly_type}</p>
                    
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginTop: '16px' }}>Risk Score</h4>
                    <div style={{ maxWidth: '200px', margin: '8px 0 16px 0' }}><ProgressBar score={eventDetail.anomaly_score} /></div>
                    
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Explanation</h4>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-primary)' }}>
                      {eventDetail.explanation_factors && eventDetail.explanation_factors.map((factor, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div className="terminal-block">
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', fontFamily: 'Outfit, sans-serif', marginBottom: '8px', letterSpacing: '0.05em' }}>Raw Event Payload</h4>
                      <div><span className="terminal-key">"event_id"</span>: <span className="terminal-string">"{eventDetail.event_id}"</span>,</div>
                      <div><span className="terminal-key">"entity_id"</span>: <span className="terminal-string">"{eventDetail.entity_id}"</span>,</div>
                      {eventDetail.entity_type && <div><span className="terminal-key">"entity_type"</span>: <span className="terminal-string">"{eventDetail.entity_type}"</span>,</div>}
                      <div><span className="terminal-key">"ip_address"</span>: <span className="terminal-string">"{eventDetail.source_ip}"</span>,</div>
                      <div><span className="terminal-key">"country"</span>: <span className="terminal-string">"{eventDetail.country}"</span>,</div>
                      <div><span className="terminal-key">"device_fp"</span>: <span className="terminal-string">"{eventDetail.device_fingerprint}"</span>,</div>
                      {eventDetail.auth_method && <div><span className="terminal-key">"auth_method"</span>: <span className="terminal-string">"{eventDetail.auth_method}"</span>,</div>}
                      {eventDetail.session_duration && <div><span className="terminal-key">"session_duration"</span>: <span className="terminal-number">{eventDetail.session_duration}</span>,</div>}
                      {eventDetail.command_sequence && <div><span className="terminal-key">"command_sequence"</span>: <span className="terminal-string">{JSON.stringify(eventDetail.command_sequence)}</span>,</div>}
                      <div><span className="terminal-key">"time_since_last"</span>: <span className="terminal-number">{eventDetail.time_since_last_login?.toFixed(2)}</span>,</div>
                      <div><span className="terminal-key">"geo_velocity"</span>: <span className="terminal-number">{eventDetail.geo_velocity?.toFixed(2)}</span></div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius-md)' }}>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.05em' }}>Entity History ({entityHistory.length})</h4>
                      <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '8px' }}>
                        {entityHistory.map(evt => (
                          <div key={evt.event_id} className={`timeline-item ${evt.is_flagged ? 'anomalous' : ''}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                {new Date(evt.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`badge ${evt.is_flagged ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                                {evt.outcome}
                              </span>
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{evt.resource}</span> via {evt.device_id} ({evt.country})
                            </div>
                          </div>
                        ))}
                        {entityHistory.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No history available.</div>}
                      </div>
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
  );
}

export default App;
