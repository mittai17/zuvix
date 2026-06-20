import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, CheckCircle2, XCircle, BarChart3, Clock, Activity, Shield, AlertTriangle } from 'lucide-react';
import { config } from '../config';

interface ApiKeyData {
  id: string; name: string; prefix: string; scopes: string[];
  rateLimit: number; createdAt: number; lastUsed: number | null;
  revoked: boolean; usage: number;
}

interface UsageData {
  requests: number; errors: number;
  timeline: { hour: string; count: number }[];
}

export const ApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState('read,write');
  const [newRateLimit, setNewRateLimit] = useState(100);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewUsage, setViewUsage] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/keys`);
      if (res.ok) setKeys(await res.json());
    } catch {}
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleGenerate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`${config.API_BASE}/api/keys/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          scopes: newScopes.split(',').map(s => s.trim()),
          rateLimit: newRateLimit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastGenerated(data.key);
        setNewName('');
        fetchKeys();
      }
    } catch {}
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await fetch(`${config.API_BASE}/api/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch {}
  };

  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleViewUsage = async (id: string) => {
    if (viewUsage === id) { setViewUsage(null); setUsageData(null); return; }
    setViewUsage(id);
    try {
      const res = await fetch(`${config.API_BASE}/api/keys/${id}/usage?hours=24`);
      if (res.ok) setUsageData(await res.json());
    } catch {}
  };

  const maxUsage = usageData ? Math.max(...usageData.timeline.map(t => t.count), 1) : 1;

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.5px' }}>
              <Key size={24} style={{ color: 'var(--primary)' }} /> API Keys
            </h1>
            <p style={{ color: '#888', fontSize: '14px', marginTop: 2 }}>
              Manage API keys for programmatic access to Zuvix. Keys are shown once at creation.
            </p>
          </div>
          <button onClick={() => setShowNew(!showNew)} className="glass-btn glass-btn-primary" style={{ padding: '10px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> New Key
          </button>
        </div>

        {/* Generate Panel */}
        {showNew && (
          <div style={{ padding: 20, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Generate New API Key</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Key Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Production CI, Dev Bot..." className="dynamic-input"
                  style={{ padding: '8px 12px', width: '100%', maxWidth: 400, fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Scopes (comma-separated)</label>
                  <input type="text" value={newScopes} onChange={e => setNewScopes(e.target.value)}
                    placeholder="read,write,admin" className="dynamic-input"
                    style={{ padding: '8px 12px', width: 200, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Rate Limit (req/min)</label>
                  <input type="number" value={newRateLimit} onChange={e => setNewRateLimit(parseInt(e.target.value) || 100)}
                    className="dynamic-input" style={{ padding: '8px 12px', width: 100, fontSize: 12 }} />
                </div>
                <button onClick={handleGenerate} disabled={!newName.trim()} className="glass-btn glass-btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                  <Key size={12} /> Generate
                </button>
              </div>
            </div>

            {/* Show generated key */}
            {lastGenerated && (
              <div style={{ marginTop: 16, padding: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>Key Generated — Copy it now, it won't be shown again</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                  <code style={{ flex: 1, color: '#e2e8f0', wordBreak: 'break-all' }}>{lastGenerated}</code>
                  <button onClick={() => handleCopy(lastGenerated)} className="glass-btn" style={{ padding: '6px 8px', flexShrink: 0 }}>
                    {copied ? <CheckCircle2 size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                </div>
                {copied && <div style={{ fontSize: 10, color: '#10b981', marginTop: 4 }}>✓ Copied to clipboard</div>}
              </div>
            )}
          </div>
        )}

        {/* Key List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 12, fontStyle: 'italic' }}>
              No API keys yet. Create one to get started.
            </div>
          ) : keys.map(k => (
            <div key={k.id} style={{ padding: '14px 16px', background: 'var(--card-bg)', border: `1px solid ${k.revoked ? 'rgba(239,68,68,0.15)' : 'var(--card-border)'}`, borderRadius: 10, opacity: k.revoked ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={14} style={{ color: k.revoked ? '#ef4444' : '#10b981' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{k.name}</span>
                  <code style={{ fontSize: 10, color: '#888', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                    {k.prefix}...
                  </code>
                  {k.revoked && (
                    <span style={{ fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <XCircle size={10} /> Revoked
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleViewUsage(k.id)} className="glass-btn" style={{ padding: '6px 8px', fontSize: 10 }}>
                    <BarChart3 size={11} /> {viewUsage === k.id ? 'Hide' : 'Usage'}
                  </button>
                  {!k.revoked && (
                    <button onClick={() => handleRevoke(k.id)} className="glass-btn" style={{ padding: '6px 8px', color: '#ef4444' }}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#888' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={9} /> Created {new Date(k.createdAt).toLocaleDateString()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Activity size={9} /> {k.usage} requests
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Shield size={9} /> {k.scopes.join(', ')}
                </span>
                <span>Rate: {k.rateLimit}/min</span>
                {k.lastUsed && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} /> Last used {new Date(k.lastUsed).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Usage Chart */}
              {viewUsage === k.id && usageData && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
                    <span>Requests (24h): <strong style={{ color: '#3b82f6' }}>{usageData.requests}</strong></span>
                    <span>Errors: <strong style={{ color: usageData.errors > 0 ? '#ef4444' : '#10b981' }}>{usageData.errors}</strong></span>
                    {usageData.requests > 0 && (
                      <span>Error Rate: <strong style={{ color: usageData.errors / usageData.requests > 0.05 ? '#ef4444' : '#10b981' }}>
                        {Math.round((usageData.errors / usageData.requests) * 100)}%
                      </strong></span>
                    )}
                  </div>
                  <svg width="100%" height="50" viewBox={`0 0 ${usageData.timeline.length * 20} 50`}>
                    {usageData.timeline.map((t, i) => {
                      const h = (t.count / maxUsage) * 40;
                      return (
                        <g key={t.hour}>
                          <rect x={i * 20 + 2} y={50 - h} width={16} height={h}
                            fill={t.count > 0 ? '#3b82f6' : 'rgba(255,255,255,0.04)'}
                            rx={2} opacity={t.count > 0 ? 0.6 + (t.count / maxUsage) * 0.4 : 0.3} />
                        </g>
                      );
                    })}
                  </svg>
                  <div style={{ fontSize: 9, color: '#555', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{usageData.timeline[0]?.hour.slice(5) || ''}</span>
                    <span>{usageData.timeline[usageData.timeline.length - 1]?.hour.slice(5) || ''}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, fontSize: 11, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'start' }}>
          <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            API keys are stored as SHA-256 hashes. The full key is only shown once at creation.
            Validate keys via <code style={{ fontSize: 10, color: '#60a5fa' }}>POST /api/keys/validate</code> with <code style={{ fontSize: 10, color: '#60a5fa' }}>{"{ \"key\": \"...\" }"}</code>.
          </div>
        </div>
      </div>
    </div>
  );
};
export default ApiKeys;
