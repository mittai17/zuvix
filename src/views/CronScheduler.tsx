/* src/views/CronScheduler.tsx — NL-powered recurring task scheduler */
import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Play, StopCircle, Sparkles } from 'lucide-react';
import { config } from '../config';

interface ScheduledTask {
  id: string;
  taskName: string;
  cronExpr: string;
  naturalLanguage: string;
  nextRun: string;
  lastRun: string | null;
  status: 'running' | 'stopped';
}

const PRESETS = [
  { label: 'Every 5 minutes', nl: 'every 5 minutes' },
  { label: 'Every 30 minutes', nl: 'every 30 minutes' },
  { label: 'Hourly', nl: 'hourly' },
  { label: 'Every 6 hours', nl: 'every 6 hours' },
  { label: 'Daily at 09:00', nl: 'daily at 09:00' },
  { label: 'Daily at midnight', nl: 'daily' },
  { label: 'Weekly on Monday', nl: 'weekly' },
];

export const CronScheduler: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSchedule, setNewSchedule] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('every 5 minutes');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/tasks`);
      if (res.ok) setTasks(await res.json());
    } catch { /* offline */ }
  };

  useEffect(() => { fetchTasks(); }, []);

  const createTask = async () => {
    const schedule = selectedPreset === '__custom__' ? newSchedule : selectedPreset;
    if (!newName.trim() || !schedule) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${config.API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName: newName, schedule }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      await fetchTasks();
      setNewName('');
      setShowNew(false);
    } catch { setError('Failed to create task (offline?)'); }
    setLoading(false);
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (task.status === 'running') {
      await fetch(`${config.API_BASE}/api/tasks/${id}/stop`, { method: 'POST' });
    }
    await fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`${config.API_BASE}/api/tasks/${id}`, { method: 'DELETE' });
    await fetchTasks();
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString();
  };

  return (
    <div className="responsive-padding" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 700, letterSpacing: '-0.5px' }}>Cron Scheduler</h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#f59e0b" /> Natural language recurring tasks — "every 5 minutes", "daily at 09:00"
          </p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="glass-btn" style={{ padding: '8px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', flexShrink: 0 }}>
          <Plus size={14} /> {showNew ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {showNew && (
        <div style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Schedule New Recurring Task</div>
          {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#888' }}>Task Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Check for updates" className="dynamic-input" style={{ padding: '10px 14px' }} />
            </div>
            <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#888' }}>Schedule (NL)</label>
              <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)} className="glass-input" style={{ padding: '10px 14px', cursor: 'pointer' }}>
                {PRESETS.map(p => <option key={p.nl} value={p.nl}>{p.label}</option>)}
                <option value="__custom__">Custom</option>
              </select>
            </div>
            {selectedPreset === '__custom__' && (
              <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: '#888' }}>Natural Language</label>
                <input type="text" value={newSchedule} onChange={e => setNewSchedule(e.target.value)} placeholder="every 10 minutes, daily at 14:30, hourly" className="dynamic-input" style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }} />
              </div>
            )}
            <button onClick={createTask} disabled={loading || !newName.trim()} className="glass-btn glass-btn-primary" style={{ padding: '10px 20px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981' }}>
              <Play size={14} /> Create
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.length === 0 && !showNew && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
            <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>No scheduled tasks. Create one — try "every 5 minutes" or "daily at 09:00".</p>
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--card-bg)', border: `1px solid ${task.status === 'running' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '10px', flexWrap: 'wrap', gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.status === 'running' ? '#10b981' : '#888', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{task.taskName}</div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#888', marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ color: '#f59e0b' }}>{task.naturalLanguage}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{task.cronExpr}</span>
                  <span>Next: {formatTime(task.nextRun)}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', background: task.status === 'running' ? 'rgba(16,185,129,0.1)' : 'rgba(136,136,136,0.1)', color: task.status === 'running' ? '#10b981' : '#888', fontWeight: 600 }}>
                {task.status.toUpperCase()}
              </span>
              <button onClick={() => toggleTask(task.id)} className="glass-btn" style={{ padding: '6px 10px' }}>
                {task.status === 'running' ? <StopCircle size={13} color="#f59e0b" /> : <Play size={13} color="#10b981" />}
              </button>
              <button onClick={() => deleteTask(task.id)} className="glass-btn" style={{ padding: '6px 10px', color: '#ef4444' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default CronScheduler;
