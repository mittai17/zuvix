/* src/views/MemorySync.tsx */
import React, { useState, useEffect } from 'react';
import { Database, Brain, Cloud, Plus, Trash2, RefreshCw, Plug, PlugZap, Server } from 'lucide-react';
import { config } from '../config';

export interface CloudDependency {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
  cloudUrl: string;
}

interface McpServer {
  id: string;
  connected: boolean;
}

export const MemorySync: React.FC = () => {
  const [dependencies, setDependencies] = useState<CloudDependency[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [mcpName, setMcpName] = useState<string>('');
  const [mcpCommand, setMcpCommand] = useState<string>('');
  const [mcpArgs, setMcpArgs] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  const fetchDependencies = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/dependencies`);
      if (res.ok) setDependencies(await res.json());
    } catch { /* offline */ }
  };

  const fetchMcpServers = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/mcp/servers`);
      if (res.ok) setMcpServers(await res.json());
    } catch { /* offline */ }
  };

  useEffect(() => {
    fetchDependencies();
    fetchMcpServers();
  }, []);

  const handleAddMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpName || !mcpCommand) return;
    setConnecting(true);
    try {
      const args = mcpArgs ? mcpArgs.split(' ').filter(Boolean) : [];
      const res = await fetch(`${config.API_BASE}/api/mcp/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mcpName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), command: mcpCommand, args })
      });
      if (res.ok) {
        fetchMcpServers();
        setMcpName(''); setMcpCommand(''); setMcpArgs('');
      }
    } catch { /* offline */ }
    setConnecting(false);
  };

  const handleDisconnectMcp = async (id: string) => {
    try {
      await fetch(`${config.API_BASE}/api/mcp/disconnect/${id}`, { method: 'POST' });
      setMcpServers(prev => prev.filter(s => s.id !== id));
    } catch { /* offline */ }
  };

  const handleAddDependency = async () => {
    const dep: CloudDependency = {
      id: `dep-${Date.now()}`,
      name: 'New Dependency',
      type: 'mcp',
      status: 'active',
      cloudUrl: ''
    };
    try {
      await fetch(`${config.API_BASE}/api/dependencies/${dep.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dep)
      });
      setDependencies(prev => [...prev, dep]);
    } catch { /* offline */ }
  };

  const handleDeleteDependency = async (id: string) => {
    try {
      await fetch(`${config.API_BASE}/api/dependencies/${id}`, { method: 'DELETE' });
      setDependencies(prev => prev.filter(d => d.id !== id));
    } catch { /* offline */ }
  };

  const handleToggleStatus = async (id: string) => {
    const dep = dependencies.find(d => d.id === id);
    if (!dep) return;
    const updated: CloudDependency = { ...dep, status: dep.status === 'active' ? 'inactive' : 'active' };
    try {
      await fetch(`${config.API_BASE}/api/dependencies/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated)
      });
      setDependencies(prev => prev.map(d => d.id === id ? updated : d));
    } catch { /* offline */ }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Memory & Dependencies</h1>
        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
          Zuvix relies on persistent files on disk for core identity and a cloud registry for tools.
        </p>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Core Soul Identity</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.6' }}>
              Zuvix's identity is defined in <code>server/SOUL.md</code> — the system prompt guiding operations, tool usage, and core directives.
            </p>
            <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#888' }}>
              ~/.zuvix/SOUL.md
            </div>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="var(--secondary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Permanent Memory Store</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.6' }}>
              Zuvix writes findings, preferences, and cross-session knowledge to <code>MEMORY.md</code>, enabling learning about the user over time.
            </p>
            <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#888' }}>
              ~/.zuvix/MEMORY.md
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* MCP Servers Card */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="#f59e0b" />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>MCP Server Manager</h3>
              </div>
              <button onClick={fetchMcpServers} className="glass-btn" style={{ padding: '6px' }}>
                <RefreshCw size={14} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#888' }}>
              Connect Model Context Protocol servers via Stdio to extend Zuvix with external tools.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mcpServers.length === 0 && (
                <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                  No MCP servers connected.
                </div>
              )}
              {mcpServers.map(srv => (
                <div key={srv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <PlugZap size={16} color="#10b981" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{srv.id}</div>
                      <div style={{ fontSize: '10px', color: '#10b981' }}>Connected</div>
                    </div>
                  </div>
                  <button onClick={() => handleDisconnectMcp(srv.id)} className="glass-btn" style={{ padding: '6px 10px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Trash2 size={12} /> Disconnect
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddMcp} style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plug size={14} /> Connect MCP Server
              </h4>
              <input type="text" placeholder="Server ID (e.g., postgres-db)" value={mcpName} onChange={e => setMcpName(e.target.value)} className="dynamic-input" style={{ fontSize: '11px', padding: '8px 12px' }} />
              <input type="text" placeholder="Command (e.g., npx)" value={mcpCommand} onChange={e => setMcpCommand(e.target.value)} className="dynamic-input" style={{ fontSize: '11px', padding: '8px 12px' }} />
              <input type="text" placeholder="Arguments (optional, space-separated)" value={mcpArgs} onChange={e => setMcpArgs(e.target.value)} className="dynamic-input" style={{ fontSize: '11px', padding: '8px 12px' }} />
              <button type="submit" disabled={connecting} className="glass-btn glass-btn-primary" style={{ padding: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', justifyContent: 'center' }}>
                <Plus size={14} /> {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>

          {/* Cloud Dependencies Card */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Cloud Dependency Registry</h3>
              </div>
              <button onClick={fetchDependencies} className="glass-btn" style={{ padding: '6px' }}>
                <RefreshCw size={14} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#888' }}>
              Registered dependencies are injected into the agent's tool context natively.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dependencies.length === 0 && (
                <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                  No dependencies registered.
                </div>
              )}
              {dependencies.map(dep => (
                <div key={dep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{dep.name}</span>
                      <span style={{ fontSize: '9px', backgroundColor: dep.type === 'mcp' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.05)', color: dep.type === 'mcp' ? 'var(--primary)' : 'var(--text-muted)', padding: '1px 4px', borderRadius: '4px' }}>{dep.type.toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#888', fontFamily: 'var(--font-mono)' }}>{dep.cloudUrl}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => handleToggleStatus(dep.id)} style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: dep.status === 'active' ? '#10b981' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: '3px', left: dep.status === 'active' ? '18px' : '4px', transition: 'all 0.2s' }} />
                    </button>
                    <button onClick={() => handleDeleteDependency(dep.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleAddDependency} style={{ width: '100%', fontSize: '12px', padding: '8px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={12} /> Add Dependency
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default MemorySync;
