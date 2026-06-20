// src/views/SecurityAgent.tsx — Cross-platform OS agent dashboard
import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Monitor, Smartphone, Terminal, Globe, HardDrive, Cpu,
  RefreshCw, Play, Clock, ChevronDown, ChevronRight,
  CheckCircle, XCircle
} from 'lucide-react';
import { config } from '../config';

interface AgentDevice {
  id: string;
  platform: string;
  status: string;
  lastSeen: number;
  info?: any;
  results?: CommandResult[];
}

interface CommandResult {
  command: string;
  result: any;
  error: string | null;
  timestamp: number;
}

const COMMAND_TEMPLATES = [
  { label: 'System Info', command: 'system.info' },
  { label: 'File List', command: 'file.list', args: { path: '/' } },
  { label: 'Process List', command: 'process.list' },
  { label: 'Network Info', command: 'network.info' },
  { label: 'Env Vars', command: 'env.all' },
  { label: 'Screenshot', command: 'screenshot' },
  { label: 'Clipboard', command: 'clipboard.read' },
];

type Tab = 'info' | 'exec' | 'results';

export const SecurityAgent: React.FC = () => {
  const [devices, setDevices] = useState<AgentDevice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [cmdInput, setCmdInput] = useState('');
  const [cmdArgs, setCmdArgs] = useState('{}');
  const [cmdLoading, setCmdLoading] = useState(false);
  const [cmdOutput, setCmdOutput] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const resultsEndRef = useRef<HTMLDivElement>(null);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/agent/devices`);
      if (res.ok) setDevices(await res.json());
    } catch { /* offline */ }
  };

  const fetchInfo = async (deviceId: string) => {
    try {
      const res = await fetch(`${config.API_BASE}/api/agent/${deviceId}/info`);
      if (res.ok) {
        const data = await res.json();
        setDevices(prev => prev.map(d =>
          d.id === deviceId ? { ...d, info: data.info } : d
        ));
      }
    } catch { /* offline */ }
  };

  const fetchResults = async (deviceId: string) => {
    try {
      const res = await fetch(`${config.API_BASE}/api/agent/${deviceId}/results`);
      if (res.ok) {
        const results = await res.json();
        setDevices(prev => prev.map(d =>
          d.id === deviceId ? { ...d, results } : d
        ));
      }
    } catch { /* offline */ }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selected) {
      fetchInfo(selected);
      fetchResults(selected);
    }
  }, [selected]);

  const selectDevice = (id: string) => {
    setSelected(id === selected ? null : id);
    setCmdOutput('');
    if (id !== selected) {
      setTab('info');
      fetchInfo(id);
      fetchResults(id);
    }
  };

  const executeCommand = async (command: string, argsStr?: string) => {
    if (!selected) return;
    setCmdLoading(true);
    setCmdOutput('');
    try {
      const args = argsStr ? JSON.parse(argsStr) : {};
      const res = await fetch(`${config.API_BASE}/api/agent/${selected}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args }),
      });
      const data = await res.json();
      setCmdOutput(JSON.stringify(data, null, 2));
      // Refresh results
      setTimeout(() => fetchResults(selected), 500);
    } catch (e: any) {
      setCmdOutput(`Error: ${e.message}`);
    }
    setCmdLoading(false);
  };

  const handleCommandSubmit = () => {
    if (!cmdInput.trim()) return;
    executeCommand(cmdInput.trim(), cmdArgs);
  };

  const handleTemplate = (tmpl: typeof COMMAND_TEMPLATES[0]) => {
    setCmdInput(tmpl.command);
    setCmdArgs(tmpl.args ? JSON.stringify(tmpl.args, null, 2) : '{}');
  };

  const getPlatformIcon = (platform: string) => {
    if (platform.includes('android') || platform.includes('ios')) return <Smartphone size={14} />;
    return <Monitor size={14} />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#ef4444';
      case 'error': return '#f59e0b';
      default: return '#888';
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  };

  const selectedDevice = devices.find(d => d.id === selected);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={24} style={{ color: 'var(--primary)' }} /> Security Agent
          </h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
            Cross-platform OS agent. Connected devices: {devices.length}
          </p>
        </div>
        <button onClick={fetchDevices} className="glass-btn" style={{ padding: '8px 12px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, overflow: 'hidden' }}>
        {/* Device List */}
        <div style={{ width: '280px', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', paddingRight: '8px' }}>
          {devices.length === 0 && (
            <div style={{ padding: '24px', background: 'var(--card-bg)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', fontSize: '12px', color: '#666' }}>
              <Terminal size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>No agents connected.</p>
              <p style={{ marginTop: 8 }}>Run <code style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>./agents/security-agent/install.sh</code> on any device.</p>
            </div>
          )}
          {devices.map(d => (
            <button key={d.id} onClick={() => selectDevice(d.id)}
              style={{
                padding: '12px 14px', background: selected === d.id ? 'rgba(59,130,246,0.1)' : 'var(--card-bg)',
                border: `1px solid ${selected === d.id ? 'rgba(59,130,246,0.3)' : 'var(--card-border)'}`,
                borderRadius: '10px', cursor: 'pointer', textAlign: 'left', color: 'inherit',
                display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(d.status), flexShrink: 0 }} />
              {getPlatformIcon(d.platform)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.id}</div>
                <div style={{ fontSize: '10px', color: '#666' }}>{d.platform} · {formatTime(d.lastSeen)}</div>
              </div>
              <ChevronRight size={12} style={{ color: '#888', flexShrink: 0, transform: selected === d.id ? 'rotate(90deg)' : '' }} />
            </button>
          ))}
          <div style={{ padding: '8px', fontSize: '10px', color: '#444', textAlign: 'center' }}>
            Node.js fallback: <code style={{ fontSize: 10 }}>node agents/node-agent/agent.js</code>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedDevice && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg)', borderRadius: '10px', padding: '3px', border: '1px solid var(--card-border)' }}>
              {(['info', 'exec', 'results'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', background: tab === t ? 'rgba(59,130,246,0.15)' : 'transparent',
                    borderRadius: '7px', cursor: 'pointer', color: tab === t ? '#60a5fa' : '#888', fontSize: '12px', fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >{t}</button>
              ))}
            </div>

            {tab === 'info' && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedDevice.info ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        { label: 'Hostname', value: selectedDevice.info.hostname, icon: <Monitor size={12} /> },
                        { label: 'OS', value: `${selectedDevice.info.os} (${selectedDevice.info.os_version})`, icon: <Globe size={12} /> },
                        { label: 'Kernel', value: selectedDevice.info.kernel, icon: <Terminal size={12} /> },
                        { label: 'CPU', value: selectedDevice.info.cpu, icon: <Cpu size={12} /> },
                        { label: 'Cores', value: selectedDevice.info.cpu_cores, icon: <Cpu size={12} /> },
                        { label: 'Memory', value: `${(selectedDevice.info.memory_used / 1024 / 1024 / 1024).toFixed(1)}/${(selectedDevice.info.memory_total / 1024 / 1024 / 1024).toFixed(1)} GB (${selectedDevice.info.memory_percent?.toFixed(1)}%)`, icon: <HardDrive size={12} /> },
                        { label: 'Uptime', value: `${Math.floor(selectedDevice.info.uptime / 3600)}h ${Math.floor((selectedDevice.info.uptime % 3600) / 60)}m`, icon: <Clock size={12} /> },
                        { label: 'Username', value: selectedDevice.info.username, icon: <Shield size={12} /> },
                      ].map(({ label, value, icon }) => (
                        <div key={label} style={{ padding: '12px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {icon} {label}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{String(value)}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => fetchInfo(selected!)} className="glass-btn" style={{ alignSelf: 'center', padding: '8px 16px', fontSize: '12px' }}>
                      <RefreshCw size={12} /> Refresh Info
                    </button>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '13px' }}>
                    <RefreshCw size={16} className="connecting-line" /> Loading system info...
                  </div>
                )}
              </div>
            )}

            {tab === 'exec' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
                {/* Templates */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {COMMAND_TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => handleTemplate(t)}
                      className="glass-btn" style={{ padding: '5px 10px', fontSize: '10px' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
                  <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: '#888' }}>Command</label>
                    <input type="text" value={cmdInput} onChange={e => setCmdInput(e.target.value)}
                      placeholder="e.g., exec, file.list, process.list, system.info"
                      className="dynamic-input" style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}
                      onKeyDown={e => e.key === 'Enter' && handleCommandSubmit()} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: '#888' }}>Args (JSON)</label>
                    <input type="text" value={cmdArgs} onChange={e => setCmdArgs(e.target.value)}
                      placeholder='{"path": "/"}'
                      className="dynamic-input" style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
                  </div>
                  <button onClick={handleCommandSubmit} disabled={cmdLoading || !cmdInput.trim()}
                    className="glass-btn glass-btn-primary"
                    style={{ padding: '10px 20px', background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#60a5fa', height: 40 }}>
                    {cmdLoading ? <RefreshCw size={14} className="connecting-line" /> : <Play size={14} />}
                  </button>
                </div>
                {cmdOutput && (
                  <pre style={{
                    flex: 1, padding: '14px', background: '#0a0f1a', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '10px', overflow: 'auto', fontSize: '11px', lineHeight: 1.6, fontFamily: 'var(--font-mono)', color: '#94a3b8'
                  }}>{cmdOutput}</pre>
                )}
              </div>
            )}

            {tab === 'results' && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(selectedDevice.results?.length || 0) === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
                    No command results yet. Use the Exec tab to send commands.
                  </div>
                ) : (
                  [...(selectedDevice.results || [])].reverse().map((r, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {r.error ? <XCircle size={12} color="#ef4444" /> : <CheckCircle size={12} color="#10b981" />}
                        <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: r.error ? '#ef4444' : '#10b981' }}>{r.command}</span>
                        <span style={{ fontSize: '10px', color: '#888', marginLeft: 'auto' }}>{new Date(r.timestamp).toLocaleTimeString()}</span>
                        <button onClick={() => setExpanded(prev => ({ ...prev, [`${i}`]: !prev[`${i}`] }))}
                          className="glass-btn" style={{ padding: '2px 6px', fontSize: 10 }}>
                          {expanded[`${i}`] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>
                      </div>
                      {expanded[`${i}`] && (
                        <pre style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)', maxHeight: 200, overflow: 'auto', background: '#0a0f1a', padding: '8px', borderRadius: 6, lineHeight: 1.5 }}>
                          {r.error ? r.error : JSON.stringify(r.result, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
                <div ref={resultsEndRef} />
              </div>
            )}
          </div>
        )}

        {/* No selection */}
        {!selectedDevice && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#555' }}>
              <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <p style={{ fontSize: '14px' }}>Select a connected device to manage.</p>
              <p style={{ fontSize: '12px', marginTop: 8, color: '#444' }}>
                Install the agent on any device running Linux, macOS, Windows, or Android (Termux).
              </p>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  bash &lt;(curl -sL zuvix.dev/agent/install.sh)
                </code>
                <code style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  ZUVIX_SERVER=ws://YOUR_IP:3001 node agent.js
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SecurityAgent;
