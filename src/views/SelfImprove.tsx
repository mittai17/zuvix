import React, { useState, useEffect } from 'react';
import { Brain, ThumbsUp, ThumbsDown, TrendingUp, BarChart3, RotateCcw, Zap, Layers, GitBranch, Search, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { config } from '../config';

interface Pattern { id: string; trigger: string; action: string; args: any; successRate: number; uses: number; lastUsed: number; created: number; }
interface Record { id: string; agentId: string; action: string; args: any; result: any; success: boolean; feedback?: 'up' | 'down'; timestamp: number; context: string; }
interface Stats { totalActions: number; successRate: number; totalPatterns: number; activePatterns: number; successes: number; failures: number; feedbackUp: number; feedbackDown: number; }

export const SelfImprove: React.FC = () => {
  const [records, setRecords] = useState<Record[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'records' | 'patterns'>('records');
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    try {
      const [rRes, pRes, sRes] = await Promise.all([
        fetch(`${config.API_BASE}/api/self-improve/records?limit=100`),
        fetch(`${config.API_BASE}/api/self-improve/patterns`),
        fetch(`${config.API_BASE}/api/self-improve/stats`),
      ]);
      if (rRes.ok) setRecords(await rRes.json());
      if (pRes.ok) setPatterns(await pRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch { }
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 3000); return () => clearInterval(i); }, []);

  const handleFeedback = async (recordId: string, feedback: 'up' | 'down') => {
    await fetch(`${config.API_BASE}/api/self-improve/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, feedback }),
    });
    fetchAll();
  };

  const handleReset = async () => {
    if (!confirm('Reset all self-improvement data?')) return;
    await fetch(`${config.API_BASE}/api/self-improve/reset`, { method: 'POST' });
    fetchAll();
  };

  const filteredRecords = records.filter(r =>
    !search || r.action.toLowerCase().includes(search.toLowerCase()) ||
    r.agentId.toLowerCase().includes(search.toLowerCase()) ||
    r.context.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPatterns = patterns.filter(p =>
    !search || p.action.toLowerCase().includes(search.toLowerCase()) ||
    p.trigger.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.5px' }}>
              <Brain size={24} style={{ color: 'var(--primary)' }} /> Self-Improving Model
            </h1>
            <p style={{ color: '#888', fontSize: '14px', marginTop: 2 }}>
              The agent learns from every action. Successful patterns are extracted and injected into future tasks.
            </p>
          </div>
          <button onClick={handleReset} className="glass-btn" style={{ padding: '8px 12px', fontSize: 11 }}><RotateCcw size={12} /> Reset</button>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { icon: Activity, label: 'Total Actions', value: stats.totalActions, color: '#3b82f6' },
              { icon: TrendingUp, label: 'Success Rate', value: `${stats.successRate}%`, color: stats.successRate > 70 ? '#10b981' : '#f59e0b' },
              { icon: Layers, label: 'Patterns', value: stats.activePatterns, color: '#8b5cf6' },
              { icon: Zap, label: 'Active', value: stats.activePatterns, color: '#f59e0b' },
              { icon: CheckCircle2, label: 'Successes', value: stats.successes, color: '#10b981' },
              { icon: AlertCircle, label: 'Failures', value: stats.failures, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <s.icon size={14} style={{ color: s.color, opacity: 0.7 }} />
                <div>
                  <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab + Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 2 }}>
            <button onClick={() => setTab('records')} className={`glass-btn ${tab === 'records' ? 'glass-btn-primary' : ''}`}
              style={{ padding: '6px 14px', fontSize: 11, justifyContent: 'center' }}>
              <BarChart3 size={12} /> Records ({records.length})
            </button>
            <button onClick={() => setTab('patterns')} className={`glass-btn ${tab === 'patterns' ? 'glass-btn-primary' : ''}`}
              style={{ padding: '6px 14px', fontSize: 11, justifyContent: 'center' }}>
              <GitBranch size={12} /> Patterns ({patterns.length})
            </button>
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
            <Search size={11} style={{ position: 'absolute', left: 8, top: 7, color: '#666' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search actions, agents..." className="glass-input"
              style={{ padding: '5px 8px 5px 24px', fontSize: 11, width: '100%' }} />
          </div>
        </div>

        {/* Records Tab */}
        {tab === 'records' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredRecords.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 12, fontStyle: 'italic' }}>
                {search ? 'No matching records' : 'No agent actions recorded yet. Run a task to see records here.'}
              </div>
            ) : filteredRecords.map(r => (
              <div key={r.id} style={{ padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.success ? '#10b981' : '#ef4444' }} />
                    <code style={{ color: '#3b82f6', fontWeight: 600 }}>{r.action}</code>
                    <span style={{ color: '#666' }}>by</span>
                    <span style={{ color: '#8b5cf6' }}>{r.agentId}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#555', fontSize: 9 }}>{new Date(r.timestamp).toLocaleTimeString()}</span>
                    {r.feedback ? (
                      r.feedback === 'up' ? <ThumbsUp size={11} color="#10b981" /> : <ThumbsDown size={11} color="#ef4444" />
                    ) : (
                      <>
                        <button onClick={() => handleFeedback(r.id, 'up')} className="glass-btn" style={{ padding: '2px 4px' }}><ThumbsUp size={10} /></button>
                        <button onClick={() => handleFeedback(r.id, 'down')} className="glass-btn" style={{ padding: '2px 4px' }}><ThumbsDown size={10} /></button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.5, marginBottom: 2 }}>
                  Args: {JSON.stringify(r.args).substring(0, 80)}
                </div>
                <div style={{ color: r.success ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  {r.success ? '✓ Success' : '✗ Failed'}
                  {r.result?.error ? `: ${r.result.error}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Patterns Tab */}
        {tab === 'patterns' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {filteredPatterns.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#666', fontSize: 12, fontStyle: 'italic', gridColumn: '1 / -1' }}>
                {search ? 'No matching patterns' : 'No patterns learned yet. Successful actions with feedback will appear here.'}
              </div>
            ) : filteredPatterns.map(p => (
              <div key={p.id} style={{ padding: '14px', background: 'var(--card-bg)', border: `1px solid ${p.successRate > 0.8 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <code style={{ color: '#3b82f6', fontWeight: 600, fontSize: 11 }}>{p.action}</code>
                  <span style={{ fontSize: 10, color: p.successRate > 0.8 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    {Math.round(p.successRate * 100)}% success
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', lineHeight: 1.5, marginBottom: 6 }}>
                  <div style={{ color: '#888', fontSize: 9, marginBottom: 2 }}>TRIGGER</div>
                  {p.trigger.substring(0, 100)}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ color: '#888', fontSize: 9, marginBottom: 2 }}>ARGS</div>
                  {JSON.stringify(p.args).substring(0, 80)}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 9, color: '#555', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 6 }}>
                  <span>Used {p.uses}x</span>
                  <span>Created {new Date(p.created).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default SelfImprove;
