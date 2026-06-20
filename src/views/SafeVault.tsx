/* src/views/SafeVault.tsx */
import React, { useState, useEffect } from 'react';
import { Lock, Key, ShieldCheck, Trash2, Plus, AlertCircle, Copy } from 'lucide-react';
import { config } from '../config';

export const SafeVault: React.FC = () => {
  const [keys, setKeys] = useState<string[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/vault/keys`);
      if (res.ok) setKeys(await res.json());
    } catch { /* offline */ }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleSave = async () => {
    if (!newKeyName || !newKeyValue) { setError('Both Key Name and Secret Value are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE}/api/vault/keys`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: newKeyName, secretValue: newKeyValue })
      });
      if (res.ok) { setNewKeyName(''); setNewKeyValue(''); fetchKeys(); }
      else { const err = await res.json(); setError(err.error || 'Failed to save secret.'); }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleDelete = async (keyName: string) => {
    try {
      const res = await fetch(`${config.API_BASE}/api/vault/keys/${keyName}`, { method: 'DELETE' });
      if (res.ok) fetchKeys();
    } catch { /* offline */ }
  };

  const handleCopy = async (name: string) => {
    setCopied(name);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '20%', left: '5%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <ShieldCheck size={28} color="#10b981" />
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>Safe First Vault</h1>
        </div>
        <p style={{ color: '#888', marginBottom: '32px', paddingLeft: '40px' }}>
          Credentials are encrypted with AES-256-GCM. The frontend never sees decrypted values — they're injected at runtime.
        </p>

        <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', border: '1px solid rgba(16,185,129,0.2)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#10b981" /> Add New Secure Credential
          </h2>
          {error && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '16px', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Key Name</label>
              <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. OPENAI_API_KEY" className="glass-input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Secret Value</label>
              <input type="password" value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} placeholder="sk-..." className="glass-input" />
            </div>
            <button onClick={handleSave} disabled={loading} className="glass-btn glass-btn-primary" style={{ padding: '10px 24px', background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981' }}>
              <Plus size={18} /> {loading ? 'Encrypting...' : 'Secure & Save'}
            </button>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="#e2e8f0" /> Encrypted Credentials
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {keys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                <ShieldCheck size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>The vault is empty. Add your API keys above.</p>
              </div>
            ) : (
              keys.map(key => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={20} color="#10b981" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '15px' }}>{key}</div>
                      <div style={{ color: '#10b981', fontSize: '13px', marginTop: '4px', letterSpacing: '2px' }}>••••••••••••••••••••••••••••</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleCopy(key)} className="glass-btn" style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }} title="Copy key name">
                      {copied === key ? <span style={{ color: '#10b981', fontSize: 11 }}>Copied!</span> : <Copy size={14} />}
                    </button>
                    <button onClick={() => handleDelete(key)} className="glass-btn" style={{ padding: '8px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafeVault;
