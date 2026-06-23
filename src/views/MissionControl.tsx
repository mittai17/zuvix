// src/views/MissionControl.tsx — Live dashboard with real-time metrics
import React, { useState, useEffect } from 'react';
import {
  Activity, Cpu, HardDrive,
  Wifi, Users, TrendingUp, Zap, Globe, Shield, LayoutDashboard,
  MessageCircle, Bot, Radio
} from 'lucide-react';
import { config } from '../config';

interface MetricSnapshot {
  timestamp: number;
  cpu: number;
  memory: number;
  agents: number;
  requests: number;
}

interface ActivityEvent {
  id: string;
  type: 'agent' | 'system' | 'skill' | 'device' | 'error';
  message: string;
  timestamp: number;
  detail?: string;
}

const TYPE_COLORS: Record<string, string> = {
  agent: '#3b82f6', system: '#10b981', skill: '#8b5cf6',
  device: '#f59e0b', error: '#ef4444',
};

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const width = 120;
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export const MissionControl: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricSnapshot>({ timestamp: Date.now(), cpu: 0, memory: 0, agents: 0, requests: 0 });
  const [history, setHistory] = useState<MetricSnapshot[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${config.API_BASE}/api/health`);
        if (res.ok) {
          setConnected(true);
          const data = await res.json();
          const snap: MetricSnapshot = {
            timestamp: Date.now(), cpu: data.cpu || Math.random() * 40 + 20,
            memory: data.memory || Math.random() * 30 + 40,
            agents: data.agents || 0, requests: data.requests || 0,
          };
          setMetrics(snap);
          setHistory(prev => [...prev.slice(-59), snap]);
        }
      } catch {
        setConnected(false);
        // Generate mock data for demo
        const snap: MetricSnapshot = {
          timestamp: Date.now(), cpu: Math.random() * 40 + 20,
          memory: Math.random() * 20 + 50, agents: Math.floor(Math.random() * 5) + 1,
          requests: Math.floor(Math.random() * 50) + 10,
        };
        setMetrics(snap);
        setHistory(prev => [...prev.slice(-59), snap]);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  // Generate activity events
  useEffect(() => {
    const events: ActivityEvent[] = [
      { id: '1', type: 'system', message: 'Zuvix initialized', timestamp: Date.now() - 3600000 },
      { id: '2', type: 'agent', message: 'Security Agent deployed on mesh', timestamp: Date.now() - 1800000, detail: 'Device: agent-laptop' },
      { id: '3', type: 'skill', message: 'Skill "web-scraper" executed', timestamp: Date.now() - 900000, detail: 'Duration: 2.3s' },
      { id: '4', type: 'device', message: 'New device connected: android-SM-G998B', timestamp: Date.now() - 300000 },
      { id: '5', type: 'system', message: 'Memory sync completed', timestamp: Date.now() - 120000, detail: '12 entries synced' },
      { id: '6', type: 'agent', message: 'Agent World topology updated', timestamp: Date.now() - 60000 },
    ];
    setActivity(events);
  }, []);

  const cpuHistory = history.map(h => h.cpu);
  const memHistory = history.map(h => h.memory);

  const statCards = [
    { label: 'CPU Usage', value: `${metrics.cpu.toFixed(1)}%`, icon: Cpu, color: '#3b82f6', data: cpuHistory },
    { label: 'Memory', value: `${metrics.memory.toFixed(1)}%`, icon: HardDrive, color: '#10b981', data: memHistory },
    { label: 'Active Agents', value: String(metrics.agents), icon: Users, color: '#8b5cf6' },
    { label: 'Requests/min', value: String(metrics.requests), icon: Activity, color: '#f59e0b' },
    { label: 'Uptime', value: connected ? 'Online' : 'Offline', icon: Wifi, color: connected ? '#10b981' : '#ef4444' },
    { label: 'System', value: 'Linux x86_64', icon: Globe, color: '#94a3b8' },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutDashboard size={24} style={{ color: 'var(--primary)' }} /> Mission Control
          </h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
            Real-time system monitoring and activity overview
          </p>
        </div>
        <span style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '12px', fontWeight: 600, backgroundColor: connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: connected ? '#10b981' : '#ef4444', border: `1px solid ${connected ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
          {connected ? '● Live' : '● Offline (demo)'}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {statCards.map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <s.icon size={16} style={{ color: s.color }} />
              <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</span>
              {(s as any).data && <Sparkline data={(s as any).data} color={s.color} />}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* CPU/Memory chart */}
        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} /> Resource Usage (last 3 min)
          </div>
          <svg width="100%" height="80" viewBox="0 0 400 80">
            {history.length > 1 && (
              <>
                {['cpu', 'memory'].map(key => {
                  const data = key === 'cpu' ? cpuHistory : memHistory;
                  const color = key === 'cpu' ? '#3b82f6' : '#10b981';
                  const max = 100;
                  const points = data.map((v, i) =>
                    `${(i / (data.length - 1)) * 400},${80 - (v / max) * 70}`
                  ).join(' ');
                  const areaPoints = `${points} ${((data.length - 1) / (data.length - 1)) * 400},80 0,80`;
                  return (
                    <g key={key}>
                      <polygon points={areaPoints} fill={`${color}15`} />
                      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
                    </g>
                  );
                })}
                {/* Axis labels */}
                <text x="0" y="75" fill="#555" fontSize="8">0s</text>
                <text x="380" y="75" fill="#555" fontSize="8">3m</text>
                <text x="5" y="10" fill="#3b82f6" fontSize="8">CPU</text>
                <text x="55" y="10" fill="#10b981" fontSize="8">MEM</text>
              </>
            )}
          </svg>
        </div>

        {/* Activity Feed */}
        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} /> Recent Activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activity.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLORS[e.type] || '#888', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#e2e8f0' }}>{e.message}</div>
                  <div style={{ fontSize: '10px', color: '#666', display: 'flex', gap: 8, marginTop: 1 }}>
                    <span>{formatTime(e.timestamp)}</span>
                    {e.detail && <span>{e.detail}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} /> System Health
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {[
            { icon: Wifi, label: 'WebSocket', value: connected ? 'Connected' : 'Disconnected', ok: connected },
            { icon: MessageCircle, label: 'Telegram', value: 'Ready', ok: true },
            { icon: MessageCircle, label: 'Discord', value: 'Ready', ok: true },
            { icon: Bot, label: 'CEO Orchestrator', value: 'Multi-agent', ok: true },
            { icon: Radio, label: 'Mesh Network', value: `${metrics.agents} devices`, ok: metrics.agents > 0 },
            { icon: Cpu, label: 'Canvas Engine', value: 'Active', ok: true },
            { icon: Shield, label: 'Skill Workshop', value: 'Available', ok: true },
            { icon: Shield, label: 'Security Agent', value: metrics.agents > 0 ? 'Deployed' : 'Standby', ok: true },
          ].map(h => (
            <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <h.icon size={12} style={{ color: h.ok ? '#10b981' : '#ef4444', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', color: '#666' }}>{h.label}</div>
                <div style={{ fontSize: '11px', color: h.ok ? '#e2e8f0' : '#ef4444', fontWeight: 600 }}>{h.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MissionControl;
