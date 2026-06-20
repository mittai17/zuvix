import React, { useState, useEffect, useRef, useCallback } from 'react';
import NodeGraph from '../components/NodeGraph';
import type { AgentNode, Connection, LogEntry } from '../store/agentStore';
import { INITIAL_AGENTS, INITIAL_CONNECTIONS } from '../store/agentStore';
import {
  Cpu, Network, Clock, Wifi, WifiOff, MessageSquare, Zap,
  TrendingUp, HardDrive, Radio, ArrowRight, X,
  BarChart3, Layers, GitBranch
} from 'lucide-react';
import { config } from '../config';

interface AgentMetric {
  agentId: string; agentName: string; cpu: number; memory: number;
  taskCount: number; status: string; currentTool: string;
  lastActive: number; uptime: number;
  history: { cpu: number; memory: number; t: number }[];
}

interface MeshEvent {
  id: string; source: string; message: string; targets: string[]; timestamp: number;
}

function MiniSparkline({ data, color, height = 24, width = 60 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (!data || data.length < 2) return <span style={{ color: '#555', fontSize: 9 }}>—</span>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const area = `${points} ${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={area} fill={`${color}15`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusBadge({ status, pulse = false }: { status: string; pulse?: boolean }) {
  const colors: Record<string, string> = {
    busy: '#ef4444', thinking: '#f59e0b', idle: '#10b981', error: '#ef4444', success: '#10b981',
  };
  const labels: Record<string, string> = {
    busy: 'Active', thinking: 'Thinking', idle: 'Idle', error: 'Error', success: 'Done',
  };
  const c = colors[status] || '#888';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: c }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, boxShadow: pulse ? `0 0 6px ${c}` : 'none', animation: pulse ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
      {labels[status] || status}
    </span>
  );
}

export const AgentOS: React.FC = () => {
  const [agents, setAgents] = useState<AgentNode[]>(INITIAL_AGENTS);
  const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<AgentMetric[]>([]);
  const [meshEvents, setMeshEvents] = useState<MeshEvent[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [uptime, setUptime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'metrics' | 'mesh' | 'logs'>('metrics');
  const [showDetails, setShowDetails] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const meshEndRef = useRef<HTMLDivElement>(null);
  const retriesRef = useRef(0);
  const meshCountRef = useRef(0);
  const [globalStats, setGlobalStats] = useState({ totalAgents: 0, activeTasks: 0, meshPerMin: 0, avgResponse: 0 });

  useEffect(() => {
    const id = setInterval(() => setUptime(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll mesh feed
  useEffect(() => { meshEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [meshEvents]);

  // Compute global stats from metrics
  useEffect(() => {
    const active = metrics.filter(m => m.status === 'busy' || m.status === 'thinking').length;
    setGlobalStats(prev => ({
      ...prev,
      totalAgents: metrics.length,
      activeTasks: active,
    }));
  }, [metrics]);

  // Track mesh messages per min
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalStats(prev => ({ ...prev, meshPerMin: Math.round(meshCountRef.current / 2) }));
      meshCountRef.current = 0;
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const connectWs = useCallback(() => {
    const ws = new WebSocket(config.WS_URL);

    ws.onopen = () => {
      setWsConnected(true);
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log') {
          const logData = msg.data || msg.payload;
          const logEntry: LogEntry = logData.message
            ? { timestamp: new Date().toLocaleTimeString(), agentName: 'Agent Kernel', message: logData.message, type: 'info' }
            : logData;
          setLogs(prev => [...prev, logEntry]);
        } else if (msg.type === 'status') {
          setIsRunning(msg.payload.status === 'running');
        } else if (msg.type === 'agent_update') {
          const { agentId, status, currentTool } = msg.payload;
          setAgents(prev => {
            if (!prev.find(a => a.id === agentId)) {
              return [...prev, {
                id: agentId, name: agentId.replace('SubAgent-', 'Worker '),
                role: agentId === 'Kernel' ? 'Core' : 'Worker', status, currentTool,
                x: 100 + Math.random() * 300, y: 100 + Math.random() * 200,
                avatar: agentId === 'Kernel' ? 'K' : 'W'
              }];
            }
            return prev.map(a => a.id === agentId ? { ...a, status, currentTool } : a);
          });
        } else if (msg.type === 'topology_spawn') {
          const { parentId, childId } = msg.payload;
          setConnections(prev => {
            if (prev.find(c => c.from === parentId && c.to === childId)) return prev;
            return [...prev, { id: `${parentId}-${childId}`, from: parentId, to: childId, active: true }];
          });
        } else if (msg.type === 'metrics_update') {
          setMetrics(msg.payload || []);
        } else if (msg.type === 'mesh_event') {
          const evt = msg.payload as MeshEvent;
          setMeshEvents(prev => [...prev.slice(-50), evt]);
          meshCountRef.current++;
          // Trigger pulse on the source agent's edge
          setTimeout(() => {}, 0); // mesh pulse placeholder
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      setIsRunning(false);
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
      retriesRef.current++;
      setTimeout(connectWs, delay);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWs();
    return () => wsRef.current?.close();
  }, [connectWs]);

  // REST fallback polling for metrics (only when WS offline)
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${config.API_BASE}/api/agent-metrics`);
        if (res.ok) setMetrics(await res.json());
      } catch {}
    };
    const interval = setInterval(() => {
      if (!wsConnected) fetchMetrics();
    }, 3000);
    return () => clearInterval(interval);
  }, [wsConnected]);

  const handleAgentClick = useCallback((agent: AgentNode) => {
    setSelectedAgent(agent === selectedAgent ? null : agent);
    if (agent !== selectedAgent) setShowDetails(true);
  }, [selectedAgent]);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const selectedMetric = metrics.find(m => m.agentId === selectedAgent?.id);

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Network size={24} style={{ color: 'var(--primary)' }} /> Agent World
            </h1>
            <p style={{ color: '#888', fontSize: '14px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {formatUptime(uptime)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {wsConnected ? <Wifi size={11} color="#10b981" /> : <WifiOff size={11} color="#ef4444" />}
                <span style={{ color: wsConnected ? '#10b981' : '#ef4444' }}>{wsConnected ? 'Online' : 'Offline'}</span>
              </span>
              {isRunning && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}><Radio size={11} /> Task Active</span>}
            </p>
          </div>
        </div>

        {/* Global Stats Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { icon: Cpu, label: 'Agents', value: globalStats.totalAgents || metrics.length, color: '#3b82f6' },
            { icon: Zap, label: 'Active Tasks', value: globalStats.activeTasks, color: '#f59e0b' },
            { icon: MessageSquare, label: 'Mesh/Min', value: globalStats.meshPerMin, color: '#8b5cf6' },
            { icon: TrendingUp, label: 'Avg Response', value: `${globalStats.avgResponse || '—'}ms`, color: '#10b981' },
            { icon: HardDrive, label: 'Total Tasks', value: metrics.reduce((s, m) => s + m.taskCount, 0), color: '#ec4899' },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <s.icon size={16} style={{ color: s.color, opacity: 0.7 }} />
              <div>
                <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid: Topology + Right Panel */}
        <div className="agent-world-grid" style={{ display: 'grid', gridTemplateColumns: showDetails ? '1fr 320px' : '1fr 280px', gap: 16, flex: 1, minHeight: 0 }}>

          {/* Left: Topology */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
                <NodeGraph agents={agents} connections={connections} onAgentClick={handleAgentClick} selectedAgentId={selectedAgent?.id ?? null} />
                {/* Overlay metric badges per agent */}
                {metrics.map(m => {
                  const agent = agents.find(a => a.id === m.agentId);
                  if (!agent) return null;
                  return (
                    <div key={`badge-${m.agentId}`}
                      style={{ position: 'absolute', left: `${agent.x}px`, top: `${agent.y - 48}px`, transform: 'translateX(-50%)', display: 'flex', gap: 2, pointerEvents: 'none', opacity: wsConnected ? 0.9 : 0 }}>
                      <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', fontSize: 9, color: '#60a5fa', fontWeight: 600 }}>CPU {Math.round(m.cpu)}%</span>
                      <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 9, color: '#34d399', fontWeight: 600 }}>MEM {Math.round(m.memory)}%</span>
                    </div>
                  );
                })}
              </div>
              {!wsConnected && (
                <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <WifiOff size={10} /> Offline — showing demo topology
                </div>
              )}
            </div>
          </div>

          {/* Right: Metrics / Mesh / Logs tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 3 }}>
              {[
                { id: 'metrics' as const, icon: BarChart3, label: 'Metrics' },
                { id: 'mesh' as const, icon: Radio, label: `Mesh${meshEvents.length > 0 ? ` (${meshEvents.length})` : ''}` },
                { id: 'logs' as const, icon: Layers, label: `Logs${logs.length > 0 ? ` (${logs.length})` : ''}` },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`glass-btn ${activeTab === t.id ? 'glass-btn-primary' : ''}`}
                  style={{ flex: 1, padding: '6px 8px', fontSize: 10, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <t.icon size={11} /> {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Metrics Tab */}
              {activeTab === 'metrics' && (
                metrics.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>Waiting for agent metrics...</div>
                ) : (
                  metrics.map(m => {
                    const cpuColor = m.cpu > 70 ? '#ef4444' : m.cpu > 40 ? '#f59e0b' : '#3b82f6';
                    const memColor = m.memory > 70 ? '#ef4444' : m.memory > 40 ? '#f59e0b' : '#10b981';
                    return (
                      <div key={m.agentId}
                        onClick={() => {
                          const ag = agents.find(a => a.id === m.agentId);
                          if (ag) handleAgentClick(ag);
                        }}
                        style={{ padding: '8px 10px', borderRadius: 8, background: selectedAgent?.id === m.agentId ? 'rgba(59,130,246,0.08)' : 'rgba(0,0,0,0.15)', border: `1px solid ${selectedAgent?.id === m.agentId ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)'}`, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{m.agentName}</span>
                          <StatusBadge status={m.status} pulse={m.status === 'busy'} />
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 10, color: '#888' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Cpu size={9} style={{ color: cpuColor }} /> CPU {Math.round(m.cpu)}%
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <HardDrive size={9} style={{ color: memColor }} /> MEM {Math.round(m.memory)}%
                          </span>
                          <span style={{ color: '#555' }}>Tasks: {m.taskCount}</span>
                        </div>
                        {m.history.length > 1 && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                            <MiniSparkline data={m.history.map(h => h.cpu)} color={cpuColor} width={48} height={16} />
                            <MiniSparkline data={m.history.map(h => h.memory)} color={memColor} width={48} height={16} />
                          </div>
                        )}
                        {m.currentTool && <div style={{ marginTop: 4, fontSize: 9, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>⚡ {m.currentTool}</div>}
                      </div>
                    );
                  })
                )
              )}

              {/* Mesh Tab */}
              {activeTab === 'mesh' && (
                meshEvents.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>No mesh events yet. Agent communication appears here.</div>
                ) : (
                  meshEvents.slice(-30).reverse().map(e => (
                    <div key={e.id} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 10, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{e.source}</span>
                        {e.targets.length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#555' }}>
                            <ArrowRight size={9} /> {e.targets.join(', ')}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 8 }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: '#94a3b8' }}>{e.message}</div>
                    </div>
                  ))
                )
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && (
                logs.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>No logs yet.</div>
                ) : (
                  logs.slice(-50).reverse().map((log, i) => (
                    <div key={i} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.1)', lineHeight: 1.6, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: '#555' }}>[{log.timestamp}]</span>{' '}
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>{log.agentName}</span>{' '}
                      <span style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : '#94a3b8', wordBreak: 'break-word' }}>{log.message}</span>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Legend */}
            <div style={{ padding: '8px 12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, display: 'flex', gap: 10, fontSize: 9, color: '#666', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Idle</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> Thinking</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> Active</span>
              <span style={{ marginLeft: 'auto' }}>⚡ CPU / MEM badges on nodes</span>
            </div>
          </div>
        </div>

        {/* Agent Detail Drawer (bottom) */}
        {showDetails && selectedAgent && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{selectedAgent.avatar}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedAgent.name}</div>
                  <div style={{ fontSize: 10, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusBadge status={selectedAgent.status} pulse={selectedAgent.status === 'busy'} />
                    <span>ID: <code style={{ fontSize: 9 }}>{selectedAgent.id}</code></span>
                    <span>Role: {selectedAgent.role}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetails(false)} className="glass-btn" style={{ padding: '6px' }}><X size={12} /></button>
            </div>

            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {/* CPU/Memory metrics */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BarChart3 size={12} /> Resource Usage
                </div>
                {selectedMetric ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 2 }}>
                        <span>CPU</span><span style={{ color: selectedMetric.cpu > 70 ? '#ef4444' : '#60a5fa' }}>{Math.round(selectedMetric.cpu)}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${selectedMetric.cpu}%`, height: '100%', background: selectedMetric.cpu > 70 ? '#ef4444' : '#3b82f6', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                      <MiniSparkline data={selectedMetric.history.map(h => h.cpu)} color="#3b82f6" width={180} height={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 2 }}>
                        <span>Memory</span><span style={{ color: selectedMetric.memory > 70 ? '#ef4444' : '#34d399' }}>{Math.round(selectedMetric.memory)}%</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${selectedMetric.memory}%`, height: '100%', background: selectedMetric.memory > 70 ? '#ef4444' : '#10b981', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                      <MiniSparkline data={selectedMetric.history.map(h => h.memory)} color="#10b981" width={180} height={24} />
                    </div>
                    <div style={{ fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)' }}>
                      Tasks: {selectedMetric.taskCount} · Uptime: {formatUptime(selectedMetric.uptime)} · Samples: {selectedMetric.history.length}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>No metric data available</div>
                )}
              </div>

              {/* Recent Mesh Messages */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Radio size={12} /> Mesh Messages
                </div>
                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {meshEvents.filter(e => e.source === selectedAgent.id || e.targets.includes(selectedAgent.id)).length === 0 ? (
                    <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>No mesh messages for this agent</div>
                  ) : (
                    meshEvents.filter(e => e.source === selectedAgent.id || e.targets.includes(selectedAgent.id)).slice(-10).reverse().map(e => (
                      <div key={e.id} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.1)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: e.source === selectedAgent.id ? '#8b5cf6' : '#f59e0b' }}>{e.source === selectedAgent.id ? '→' : '←'}</span>{' '}
                        <span style={{ color: '#94a3b8' }}>{e.message.substring(0, 60)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Task History */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GitBranch size={12} /> Connections
                </div>
                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {connections.filter(c => c.from === selectedAgent.id || c.to === selectedAgent.id).length === 0 ? (
                    <div style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>No connections</div>
                  ) : (
                    connections.filter(c => c.from === selectedAgent.id || c.to === selectedAgent.id).map(c => {
                      const target = agents.find(a => a.id === (c.from === selectedAgent.id ? c.to : c.from));
                      return (
                        <div key={c.id || `${c.from}-${c.to}-${Math.random()}`} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.1)', fontSize: 9, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#555' }}>{c.from === selectedAgent.id ? c.from : target?.name || c.from}</span>
                          <span style={{ color: '#f59e0b' }}>{'<->'}</span>
                          <span style={{ color: '#555' }}>{c.to === selectedAgent.id ? c.to : target?.name || c.to}</span>
                          <span style={{ marginLeft: 'auto', color: c.active ? '#10b981' : '#555', fontSize: 8 }}>{c.active ? 'active' : 'inactive'}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default AgentOS;
