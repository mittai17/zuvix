/* src/views/TelemetryDashboard.tsx — Telemetry, logs & Cloudflare D1 Sync control */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { config } from '../config';
import { 
  History, Cpu, HardDrive, Wifi, Shield, Server, 
  Trash2, RefreshCw, Cloud, Database, CheckCircle, 
  AlertTriangle, ArrowUpRight, ArrowDownRight, Terminal, User
} from 'lucide-react';

interface SystemMetricRecord {
  id: number;
  username: string;
  cpu_usage: number;
  memory_usage: number;
  network_speed: number;
  active_apps: string; // JSON string of [{app, cpu, mem}]
  timestamp: string;
}

interface AgentHistoryRecord {
  id: number;
  username: string;
  agent_id: string;
  agent_name: string;
  goal: string;
  status: string;
  tool: string;
  chat_message: string;
  timestamp: string;
}

interface DeviceConnectionRecord {
  id: number;
  username: string;
  device_id: string;
  device_name: string;
  platform: string;
  status: 'online' | 'offline';
  timestamp: string;
}

interface NetworkMeshRecord {
  id: number;
  username: string;
  event_type: string;
  source: string;
  target: string;
  message: string;
  timestamp: string;
}

interface SyncStatus {
  cloudflareConfigured: boolean;
  databaseId: string;
  username: string;
  localDbFile: string;
  syncingEnabled: boolean;
}

export const TelemetryDashboard: React.FC = () => {
  const { user } = useAuth();
  const operatorName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Operator';

  const [metrics, setMetrics] = useState<SystemMetricRecord[]>([]);
  const [agents, setAgents] = useState<AgentHistoryRecord[]>([]);
  const [devices, setDevices] = useState<DeviceConnectionRecord[]>([]);
  const [meshEvents, setMeshEvents] = useState<NetworkMeshRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'agents' | 'devices' | 'mesh'>('metrics');

  const fetchTelemetryData = useCallback(async () => {
    setRefreshing(true);
    try {
      const headers = {
        'x-zuvix-user': operatorName,
        'Content-Type': 'application/json'
      };

      const [metricsRes, agentsRes, devicesRes, meshRes, syncRes] = await Promise.all([
        fetch(`${config.API_BASE}/api/telemetry/metrics?limit=60`, { headers }),
        fetch(`${config.API_BASE}/api/telemetry/agents?limit=50`, { headers }),
        fetch(`${config.API_BASE}/api/telemetry/devices?limit=50`, { headers }),
        fetch(`${config.API_BASE}/api/telemetry/mesh-events?limit=50`, { headers }),
        fetch(`${config.API_BASE}/api/telemetry/sync-status`, { headers })
      ]);

      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (devicesRes.ok) setDevices(await devicesRes.json());
      if (meshRes.ok) setMeshEvents(await meshRes.json());
      if (syncRes.ok) setSyncStatus(await syncRes.json());
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching telemetry data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [operatorName]);

  useEffect(() => {
    fetchTelemetryData();
    // Auto-refresh metrics every 8 seconds
    const interval = setInterval(fetchTelemetryData, 8000);
    return () => clearInterval(interval);
  }, [fetchTelemetryData]);

  const handleClearData = async () => {
    if (!window.confirm('Are you absolutely sure you want to clear all local telemetry history? This will reset local metric logs.')) {
      return;
    }
    try {
      const res = await fetch(`${config.API_BASE}/api/telemetry/clear`, {
        method: 'POST',
        headers: {
          'x-zuvix-user': operatorName,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        alert('All local metrics history has been cleared.');
        fetchTelemetryData();
      }
    } catch (err) {
      alert('Error clearing data.');
    }
  };

  const getLatestMetrics = (): SystemMetricRecord | null => {
    return metrics.length > 0 ? metrics[0] : null;
  };

  const latestSnap = getLatestMetrics();
  const currentCpu = latestSnap ? latestSnap.cpu_usage : 0;
  const currentMemory = latestSnap ? latestSnap.memory_usage : 0;
  const currentSpeed = latestSnap ? latestSnap.network_speed : 0;

  // Process list parsing
  const getRunningProcessesList = () => {
    if (!latestSnap) return [];
    try {
      return JSON.parse(latestSnap.active_apps);
    } catch {
      return [];
    }
  };

  const runningApps = getRunningProcessesList();

  // SVG Area Chart Component for System Metrics History
  const MetricsChart = () => {
    const height = 120;
    const width = 600;
    
    if (metrics.length < 2) {
      return (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}>
          Collecting performance history metrics...
        </div>
      );
    }

    // reverse for chronological order (left to right)
    const chartData = [...metrics].reverse();
    const maxItems = chartData.length;
    
    const cpuPoints = chartData.map((m, i) => `${(i / (maxItems - 1)) * width},${height - (m.cpu_usage / 100) * (height - 10)}`).join(' ');
    const memPoints = chartData.map((m, i) => `${(i / (maxItems - 1)) * width},${height - (m.memory_usage / 100) * (height - 10)}`).join(' ');
    
    const cpuArea = `${cpuPoints} ${width},${height} 0,${height}`;
    const memArea = `${memPoints} ${width},${height} 0,${height}`;

    return (
      <div style={{ width: '100%', overflowX: 'auto', marginTop: '16px' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ background: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '5px' }}>
          {/* Grids */}
          <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
          <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
          <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />

          {/* Memory Area */}
          <polygon points={memArea} fill="rgba(16,185,129,0.08)" />
          <polyline points={memPoints} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

          {/* CPU Area */}
          <polygon points={cpuArea} fill="rgba(255,107,129,0.08)" />
          <polyline points={cpuPoints} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text-sub)', fontWeight: 600 }}>
          <span>~{chartData.length * 10}s ago</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ color: 'var(--primary)' }}>● CPU Usage</span>
            <span style={{ color: '#10b981' }}>● Memory Usage</span>
          </div>
          <span>Now</span>
        </div>
      </div>
    );
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      {/* Background Glow effects */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(255,107,129,0.06) 0%, transparent 75%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '5%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 75%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="font-zuvix-title" style={{ fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <History size={26} color="var(--primary)" /> Telemetry & Cloud Logs
            </h1>
            <p style={{ color: 'var(--text-sub)', fontSize: '14px', marginTop: '4px' }}>
              System performance collection, active processes tracking, and secure Cloudflare D1 edge database sync.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchTelemetryData} disabled={refreshing} className="clay-btn" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing...' : 'Sync Now'}
            </button>
            <button onClick={handleClearData} className="clay-btn" style={{ padding: '8px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <Trash2 size={14} /> Clear Logs
            </button>
          </div>
        </div>

        {/* Sync & Operator Status Panel */}
        <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', padding: '24px' }}>
          {/* Operator Panel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff9a9e, #fecfef)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', border: '2px solid white', boxShadow: 'var(--card-shadow)' }}>
              <User size={20} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Linked Operator</div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {operatorName}
              </h3>
            </div>
          </div>

          {/* Cloudflare Sync Panel */}
          <div style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '24px' }} className="desktop-only-border">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} color={syncStatus?.cloudflareConfigured ? '#3b82f6' : 'var(--text-sub)'} />
                <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>Cloudflare D1 Edge</span>
              </div>
              <span style={{ 
                fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700,
                backgroundColor: syncStatus?.cloudflareConfigured ? 'rgba(59,130,246,0.15)' : 'rgba(255,107,129,0.15)',
                color: syncStatus?.cloudflareConfigured ? '#3b82f6' : 'var(--primary)'
              }}>
                {syncStatus?.cloudflareConfigured ? '● Synced to Edge' : '● Local Falling Back'}
              </span>
            </div>
            {syncStatus?.cloudflareConfigured ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-main)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Database size={12} /> <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{syncStatus.databaseId}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <CheckCircle size={10} /> Active telemetry auto-upload enabled
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', lineHeight: 1.4 }}>
                  No Cloudflare credentials found. Metrics are logged locally in SQLite database <strong>{syncStatus?.localDbFile || 'telemetry.db'}</strong>.
                </div>
                <div style={{ fontSize: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginTop: '2px' }}>
                  <AlertTriangle size={10} /> Edge sync standby — configure credentials to enable cloud logs
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Performance Snapshot */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* CPU card */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>CPU Load</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{currentCpu}%</h2>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,107,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={20} color="var(--primary)" />
            </div>
          </div>

          {/* Memory card */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>Memory Load</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0', color: '#10b981', fontFamily: 'var(--font-mono)' }}>{currentMemory}%</h2>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HardDrive size={20} color="#10b981" />
            </div>
          </div>

          {/* Network speed card */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>Mesh Speed</span>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0', color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>{currentSpeed} MB/s</h2>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={20} color="#3b82f6" />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', gap: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'metrics', label: 'System metrics', icon: Cpu },
            { id: 'agents', label: 'Agent history', icon: Shield },
            { id: 'devices', label: 'Connected Devices', icon: Server },
            { id: 'mesh', label: 'Mesh communication', icon: Wifi }
          ].map(t => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--primary)' : 'var(--text-sub)',
                fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s',
                fontSize: '14px', whiteSpace: 'nowrap'
              }}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="glass-card" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <RefreshCw size={24} className="animate-spin" color="var(--primary)" />
            <span style={{ fontSize: '13px', color: 'var(--text-sub)' }}>Connecting to local SQLite database...</span>
          </div>
        ) : (
          <div style={{ minHeight: '300px' }}>
            
            {/* 1. Metrics Tab */}
            {activeTab === 'metrics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={18} /> Performance History Chart
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-sub)' }}>Live load fluctuations of your local system synced to Cloudflare.</span>
                  <MetricsChart />
                </div>

                <div className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={18} /> Active System Processes
                  </h3>
                  {runningApps.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-sub)', textAlign: 'center', fontSize: '13px' }}>
                      No process history logged yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-sub)' }}>
                            <th style={{ padding: '12px' }}>Process Command</th>
                            <th style={{ padding: '12px', width: '100px' }}>CPU Usage</th>
                            <th style={{ padding: '12px', width: '100px' }}>Memory Usage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runningApps.map((app: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontWeight: 600 }}>{app.app}</td>
                              <td style={{ padding: '10px 12px', color: app.cpu > 10 ? 'var(--primary)' : 'var(--text-sub)', fontWeight: 700 }}>
                                {app.cpu}%
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-sub)' }}>{app.mem}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Agents Tab */}
            {activeTab === 'agents' && (
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} /> Cognitive Agent Execution & Chats
                </h3>
                {agents.length === 0 ? (
                  <div style={{ padding: '40px', color: 'var(--text-sub)', textAlign: 'center', fontSize: '13px' }}>
                    No agent operations logged. Dispatch tasks or chat with agents to populate this history.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {agents.map((item) => (
                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 700,
                              backgroundColor: item.agent_id === 'user' ? 'rgba(16,185,129,0.15)' : 'rgba(255,107,129,0.15)',
                              color: item.agent_id === 'user' ? '#10b981' : 'var(--primary)'
                            }}>
                              {item.agent_name} ({item.agent_id.slice(-4)})
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600 }}>
                              Status: <strong style={{ color: 'var(--text-main)' }}>{item.status}</strong>
                            </span>
                            {item.tool && (
                              <span style={{ fontSize: '11px', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Tool: {item.tool}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                            {formatDate(item.timestamp)} {formatTime(item.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-sub)' }}>
                          Goal: <strong style={{ color: 'var(--text-main)' }}>{item.goal}</strong>
                        </div>
                        {item.chat_message && (
                          <div style={{ 
                            fontSize: '13px', padding: '12px', background: 'rgba(255,255,255,0.03)', 
                            borderRadius: '8px', color: 'var(--text-main)', borderLeft: '3px solid var(--primary)',
                            fontFamily: item.status === 'chat' ? 'inherit' : 'var(--font-mono)',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {item.chat_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Devices Tab */}
            {activeTab === 'devices' && (
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={18} /> Mesh Devices Connection Log
                </h3>
                {devices.length === 0 ? (
                  <div style={{ padding: '40px', color: 'var(--text-sub)', textAlign: 'center', fontSize: '13px' }}>
                    No mesh devices connections logged.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {devices.map((item) => {
                      const isOnline = item.status === 'online';
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '32px', height: '32px', borderRadius: '50%',
                              backgroundColor: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Server size={14} color={isOnline ? '#10b981' : '#ef4444'} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                {item.device_name} ({item.platform})
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-sub)' }}>
                                Device ID: {item.device_id}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ 
                              fontSize: '11px', fontWeight: 700, marginRight: '16px',
                              color: isOnline ? '#10b981' : '#ef4444'
                            }}>
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                              {formatTime(item.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. Mesh Tab */}
            {activeTab === 'mesh' && (
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wifi size={18} /> Mesh Communication & Events Log
                </h3>
                {meshEvents.length === 0 ? (
                  <div style={{ padding: '40px', color: 'var(--text-sub)', textAlign: 'center', fontSize: '13px' }}>
                    No mesh websocket communication logs.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {meshEvents.map((item) => {
                      const isExec = item.event_type === 'execute_command';
                      return (
                        <div key={item.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--card-border)', alignItems: 'center' }}>
                          <div style={{ flexShrink: 0 }}>
                            {isExec ? (
                              <ArrowUpRight size={16} color="var(--primary)" />
                            ) : (
                              <ArrowDownRight size={16} color="#10b981" />
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600 }}>
                                {item.source} ➔ {item.target} ({item.event_type})
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-sub)' }}>
                                {formatTime(item.timestamp)}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                              {item.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default TelemetryDashboard;
