import { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Trash2, Globe, MessageCircle, Radio } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: number;
  lastActive: number;
  sessionId: string;
}

interface Route {
  channel: string;
  sourceId: string;
  workspaceId: string;
}

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [wsRes, rtRes] = await Promise.all([
        api('/workspaces'),
        api('/routes'),
      ]);
      setWorkspaces(wsRes);
      setRoutes(rtRes);
    } catch { setError('Failed to load workspaces'); }
  }

  async function createWorkspace() {
    if (!newName.trim()) return;
    try {
      await api('/workspaces', 'POST', { name: newName, systemPrompt: newPrompt || undefined });
      setNewName('');
      setNewPrompt('');
      await load();
    } catch { setError('Failed to create workspace'); }
  }

  async function deleteWorkspace(id: string) {
    try {
      await api(`/workspaces/${id}`, 'DELETE');
      await load();
    } catch { setError('Failed to delete workspace'); }
  }

  function getRoutesForWorkspace(wsId: string) {
    return routes.filter(r => r.workspaceId === wsId);
  }

  const channelIcon = (ch: string) => {
    switch (ch) {
      case 'telegram': return <MessageCircle size={12} />;
      case 'discord': return <Globe size={12} />;
      case 'web': return <Radio size={12} />;
      default: return null;
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe size={18} /> Multi-Agent Workspaces
      </h2>

      {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</p>}

      {/* Create */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>New Workspace</div>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Workspace name..."
          style={{
            width: '100%', padding: '8px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid var(--card-border)',
            background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none',
          }}
        />
        <textarea
          value={newPrompt}
          onChange={e => setNewPrompt(e.target.value)}
          placeholder="System prompt (optional)..."
          rows={2}
          style={{
            width: '100%', padding: '8px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid var(--card-border)',
            background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
          }}
        />
        <button onClick={createWorkspace} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
          border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={14} /> Create Workspace
        </button>
      </div>

      {/* Workspace list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {workspaces.map(ws => (
          <div key={ws.id} style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 12, padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{ws.name}</div>
                <div style={{ fontSize: 11, color: '#666' }}>
                  Created {new Date(ws.createdAt).toLocaleDateString()} · Last active {new Date(ws.lastActive).toLocaleDateString()}
                </div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Session: {ws.sessionId}</div>
              </div>
              <button onClick={() => deleteWorkspace(ws.id)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, cursor: 'pointer',
              }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
            {ws.systemPrompt && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6, padding: '6px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: 6 }}>
                <span style={{ color: '#666', fontWeight: 600 }}>Prompt: </span>{ws.systemPrompt}
              </div>
            )}
            {getRoutesForWorkspace(ws.id).length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {getRoutesForWorkspace(ws.id).map((r, i) => (
                  <span key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                    background: 'rgba(59,130,246,0.1)', borderRadius: 4, fontSize: 10, color: '#3b82f6',
                  }}>
                    {channelIcon(r.channel)} {r.channel}:{r.sourceId.substring(0, 16)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {workspaces.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>No workspaces yet. Create one to start routing messages.</div>
        )}
      </div>
    </div>
  );
}
