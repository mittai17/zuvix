import { useState, useEffect } from 'react';
import { config } from '../config';
import { Terminal, Play, List, Clock, CheckCircle, XCircle, Loader, ChevronDown, ChevronRight } from 'lucide-react';

const API = config.API_BASE;

interface Plan {
  id: string;
  originalGoal: string;
  status: 'running' | 'completed' | 'failed';
  tasks: Task[];
  createdAt: number;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  dependencies: string[];
  result?: string;
  error?: string;
}

export default function CEOView() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    try {
      const res = await fetch(`${API}/api/ceo/plans`);
      const data = await res.json();
      setPlans(data);
    } catch { setError('Failed to load plans'); }
  }

  async function orchestrate() {
    if (!goal.trim()) return;
    setRunning(true);
    setLogs([]);
    setError('');
    try {
      const res = await fetch(`${API}/api/ceo/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const data = await res.json();
      setLogs(data.logs || []);
      await loadPlans();
      if (data.plan) setExpandedPlan(data.plan.id);
      setGoal('');
    } catch (err: any) {
      setError(err.message);
    }
    setRunning(false);
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleTimeString();
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle size={14} color="#10b981" />;
      case 'failed': return <XCircle size={14} color="#ef4444" />;
      case 'running': return <Loader size={14} color="#3b82f6" className="spin" />;
      default: return <Clock size={14} color="#666" />;
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Terminal size={18} /> CEO Orchestrator
      </h2>

      {/* Goal Input */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="Describe a goal for the CEO to decompose and execute...&#10;&#10;e.g. 'Build a Telegram bot that replies to /price with crypto prices'"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
            background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
            marginBottom: 12,
          }}
        />
        <button onClick={orchestrate} disabled={running || !goal.trim()} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
          border: 'none', background: running ? '#555' : '#3b82f6', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
        }}>
          {running ? <Loader size={16} className="spin" /> : <Play size={16} />}
          {running ? 'Orchestrating...' : 'Orchestrate'}
        </button>
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)',
          borderRadius: 12, padding: 12, marginBottom: 16, maxHeight: 200, overflow: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: '#888' }}>Execution Log</div>
          {logs.map((log, i) => (
            <div key={i} style={{ fontSize: 11, color: '#aaa', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>
              {log}
            </div>
          ))}
        </div>
      )}

      {/* Plan list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4 }}>
          <List size={14} /> Plans ({plans.length})
        </div>

        {plans.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
            No plans yet. Enter a goal above to start.
          </div>
        )}

        {plans.map(plan => (
          <div key={plan.id} style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div
              onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              {getStatusIcon(plan.status)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{plan.originalGoal.substring(0, 60)}</div>
                <div style={{ fontSize: 10, color: '#666' }}>
                  {plan.tasks.length} tasks · {formatDate(plan.createdAt)} · {plan.status}
                </div>
              </div>
              {expandedPlan === plan.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>

            {expandedPlan === plan.id && (
              <div style={{ borderTop: '1px solid var(--card-border)', padding: 12 }}>
                {/* DAG visualization */}
                {plan.tasks.map(task => {
                  const deps = task.dependencies
                    .map(d => plan.tasks.find(t => t.id === d))
                    .filter(Boolean)
                    .map(t => t!.name);
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                      background: 'rgba(0,0,0,0.15)', borderRadius: 8, marginBottom: 6,
                    }}>
                      {getStatusIcon(task.status)}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{task.name}</div>
                        <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{task.description}</div>
                        {deps.length > 0 && (
                          <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 2 }}>
                            Depends on: {deps.join(', ')}
                          </div>
                        )}
                        {task.error && (
                          <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Error: {task.error}</div>
                        )}
                        {task.result && (
                          <div style={{
                            fontSize: 10, color: '#10b981', marginTop: 4, padding: '4px 8px',
                            background: 'rgba(16,185,129,0.08)', borderRadius: 4, maxHeight: 60, overflow: 'hidden',
                          }}>
                            {task.result.substring(0, 200)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
