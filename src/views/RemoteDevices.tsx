/* src/views/RemoteDevices.tsx */
import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Smartphone, Terminal, Wifi, WifiOff, RefreshCw, Send, ChevronDown, ChevronUp, Clock, Cpu } from 'lucide-react';
import { config } from '../config';

export interface MeshDevice {
  id: string;
  platform: string;
  status: string;
  lastSeen: number;
}

interface CommandLog {
  id: number;
  deviceId: string;
  command: string;
  status: 'sending' | 'success' | 'error';
  message: string;
  timestamp: number;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  android: <Smartphone size={20} color="var(--primary)" />,
  ios: <Smartphone size={20} color="var(--primary)" />,
  linux: <Terminal size={20} color="var(--secondary)" />,
  windows: <Monitor size={20} color="var(--success)" />,
  macos: <Monitor size={20} color="#fff" />,
};

function getPlatformIcon(platform: string) {
  const p = platform.toLowerCase();
  for (const [key, icon] of Object.entries(PLATFORM_ICONS)) {
    if (p.includes(key)) return icon;
  }
  return <Monitor size={20} color="var(--success)" />;
}

export const RemoteDevices: React.FC = () => {
  const [devices, setDevices] = useState<MeshDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [commandInputs, setCommandInputs] = useState<Record<string, string>>({});
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE}/api/mesh/devices`);
      if (res.ok) setDevices(await res.json());
    } catch { /* server offline */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 3000);

    // Connect to Mesh WebSocket for live updates
    const connectMeshWs = () => {
      const ws = new WebSocket(config.WS_MESH_URL);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'register_device' || msg.type === 'heartbeat') {
            fetchDevices();
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onclose = () => setTimeout(connectMeshWs, 5000);
      wsRef.current = ws;
    };
    connectMeshWs();

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commandLogs]);

  const executeCommand = async (deviceId: string) => {
    const command = commandInputs[deviceId]?.trim();
    if (!command || executing[deviceId]) return;

    const logId = Date.now();
    setCommandLogs(prev => [...prev, {
      id: logId, deviceId, command, status: 'sending', message: 'Sending...', timestamp: Date.now()
    }]);

    setExecuting(prev => ({ ...prev, [deviceId]: true }));
    setCommandInputs(prev => ({ ...prev, [deviceId]: '' }));

    try {
      const res = await fetch(`${config.API_BASE}/api/mesh/execute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, command, args: {} })
      });
      const data = await res.json();
      setCommandLogs(prev => prev.map(log =>
        log.id === logId ? { ...log, status: res.ok ? 'success' : 'error', message: data.message || data.error || 'Done' } : log
      ));
    } catch (e: any) {
      setCommandLogs(prev => prev.map(log =>
        log.id === logId ? { ...log, status: 'error', message: e.message } : log
      ));
    }
    setExecuting(prev => ({ ...prev, [deviceId]: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, deviceId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand(deviceId);
    }
  };

  const deviceLogs = (deviceId: string) => commandLogs.filter(l => l.deviceId === deviceId);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Universal Mesh Controller</h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
            Zuvix OS can remotely control external devices (Android, iOS, Windows, Linux) connected to the Websocket Mesh.
          </p>
        </div>
        <button onClick={fetchDevices} disabled={loading} className="glass-btn" style={{ padding: '8px 12px' }}>
          <RefreshCw size={14} className={loading ? 'connecting-line' : ''} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {devices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', gridColumn: '1 / -1', color: '#666' }}>
            <WifiOff size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>No external devices connected.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Run a Zuvix Client app on a device and connect to {config.WS_MESH_URL}</p>
          </div>
        )}

        {devices.map(device => {
          const isExpanded = selectedDevice === device.id;
          const logs = deviceLogs(device.id);

          return (
            <div key={device.id} style={{
              padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'hidden',
              background: 'var(--card-bg)', border: isExpanded ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--card-border)', borderRadius: 'var(--border-radius-md)',
              cursor: 'pointer', transition: 'border 0.2s'
            }} onClick={() => setSelectedDevice(isExpanded ? null : device.id)}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: device.status === 'online' ? '#10b981' : '#ef4444' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {getPlatformIcon(device.platform)}
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{device.id}</h3>
                    <span style={{ fontSize: '12px', color: '#888', textTransform: 'capitalize' }}>{device.platform}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: device.status === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                    {device.status === 'online' ? <Wifi size={12} color="#10b981" /> : <WifiOff size={12} color="#ef4444" />}
                    <span style={{ fontSize: '11px', color: device.status === 'online' ? '#10b981' : '#ef4444', fontWeight: 600 }}>{device.status.toUpperCase()}</span>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#666', fontFamily: 'var(--font-mono)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Last: {new Date(device.lastSeen).toLocaleTimeString()}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={11} /> {logs.length} commands</span>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                  {/* Command Input */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={commandInputs[device.id] || ''}
                      onChange={e => setCommandInputs(prev => ({ ...prev, [device.id]: e.target.value }))}
                      onKeyDown={e => handleKeyDown(e, device.id)}
                      placeholder={`Send command to ${device.id}...`}
                      className="dynamic-input"
                      style={{ flex: 1, fontSize: '12px', padding: '10px 14px' }}
                    />
                    <button
                      onClick={() => executeCommand(device.id)}
                      disabled={!commandInputs[device.id]?.trim() || executing[device.id]}
                      className="glass-btn glass-btn-primary"
                      style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#60a5fa' }}
                    >
                      <Send size={14} />
                    </button>
                  </div>

                  {/* Command Log */}
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {logs.length === 0 && (
                      <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                        No commands sent yet. Type above and press Enter.
                      </div>
                    )}
                    {logs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '4px 6px', borderRadius: '4px', backgroundColor: log.status === 'sending' ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                        <span style={{ color: '#666', width: '70px', flexShrink: 0 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span style={{ color: log.status === 'error' ? '#ef4444' : log.status === 'success' ? '#10b981' : '#fbbf24', fontWeight: 600, width: '50px', flexShrink: 0 }}>
                          {log.status === 'sending' ? '→' : log.status === 'success' ? 'OK' : 'ERR'}
                        </span>
                        <span style={{ color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.command}</span>
                        <span style={{ color: '#888', flexShrink: 0 }}>{log.message}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default RemoteDevices;
