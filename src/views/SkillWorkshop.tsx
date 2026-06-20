/* src/views/SkillWorkshop.tsx */
import React, { useState, useEffect, useRef } from 'react';
import { Play, Save, Trash2, Terminal, Plus, X, FileCode, CheckCircle, AlertCircle } from 'lucide-react';
import { config } from '../config';

interface Skill {
  id: string;
  name: string;
  description: string;
  code: string;
  readme?: string;
  dependencies?: string[];
}

interface ExecLog {
  id: number;
  timestamp: number;
  status: 'success' | 'error';
  output: string;
  duration: number;
}

export const SkillWorkshop: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillMeta, setSkillMeta] = useState<Skill | null>(null);
  const [code, setCode] = useState('');
  const [execLogs, setExecLogs] = useState<ExecLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newId, setNewId] = useState('');
  const [argsText, setArgsText] = useState('');
  const runningRef = useRef(false);

  const fetchSkills = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/skills`);
      if (res.ok) {
        const list: Skill[] = await res.json();
        setSkills(list);
        if (!selectedSkill && list.length > 0) selectSkill(list[0].id);
      }
    } catch { /* offline */ }
  };

  useEffect(() => { fetchSkills(); }, []);

  const selectSkill = async (id: string) => {
    setSelectedSkill(id);
    setShowNewForm(false);
    try {
      const res = await fetch(`${config.API_BASE}/api/skills/${id}`);
      if (res.ok) { const skill: Skill = await res.json(); setSkillMeta(skill); setCode(skill.code); }
    } catch { /* offline */ }
  };

  const runSkill = async () => {
    if (runningRef.current || !selectedSkill) return;
    runningRef.current = true;
    setLoading(true);
    const start = Date.now();
    let args: any[] = [];
    try { args = argsText.trim() ? JSON.parse(`[${argsText}]`) : []; } catch { args = [argsText]; }
    try {
      const res = await fetch(`${config.API_BASE}/api/skills/${selectedSkill}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args })
      });
      const data = await res.json();
      const duration = Date.now() - start;
      const output = data.error ? data.error : (data.result ? (typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)) : JSON.stringify(data, null, 2));
      const status = res.ok && !data.error ? 'success' : 'error';
      setExecLogs(prev => [{ id: Date.now(), timestamp: start, status, output, duration }, ...prev]);
    } catch (e: any) {
      const duration = Date.now() - start;
      setExecLogs(prev => [{ id: Date.now(), timestamp: start, status: 'error', output: e.message, duration }, ...prev]);
    }
    setLoading(false);
    runningRef.current = false;
  };

  const saveSkill = async () => {
    if (!selectedSkill || !skillMeta) return;
    try {
      const res = await fetch(`${config.API_BASE}/api/skills/${selectedSkill}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...skillMeta, code })
      });
      if (res.ok) fetchSkills();
    } catch { /* offline */ }
  };

  const deleteSkill = async (id: string) => {
    try {
      const res = await fetch(`${config.API_BASE}/api/skills/${id}`, { method: 'DELETE' });
      if (res.ok) { fetchSkills(); setSelectedSkill(null); setSkillMeta(null); setCode(''); }
    } catch { /* offline */ }
  };

  const createSkill = async () => {
    if (!newId || !newName) return;
    const skill: Skill = { id: newId, name: newName, description: newDesc || 'New skill', code: 'export async function execute() {\n  return { success: true };\n}' };
    try {
      const res = await fetch(`${config.API_BASE}/api/skills/${newId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(skill)
      });
      if (res.ok) { fetchSkills(); selectSkill(newId); setShowNewForm(false); setNewId(''); setNewName(''); setNewDesc(''); }
    } catch { /* offline */ }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Skill Workshop</h1>
        <button onClick={() => setShowNewForm(!showNewForm)} className="glass-btn" style={{ padding: '8px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
          <Plus size={14} /> New Skill
        </button>
      </div>

      {/* New Skill Form */}
      {showNewForm && (
        <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Create New Skill</span>
            <button onClick={() => setShowNewForm(false)} className="glass-btn" style={{ padding: 4 }}><X size={14} /></button>
          </div>
          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input type="text" placeholder="Skill ID (e.g., my-tool)" value={newId} onChange={e => setNewId(e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px' }} />
            <input type="text" placeholder="Display Name" value={newName} onChange={e => setNewName(e.target.value)} className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px' }} />
          </div>
          <input type="text" placeholder="Short description" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px' }} />
          <button onClick={createSkill} disabled={!newId || !newName} className="glass-btn glass-btn-primary" style={{ alignSelf: 'flex-end', padding: '8px 16px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981' }}>
            <FileCode size={14} /> Create
          </button>
        </div>
      )}

      <div className="skill-workshop-layout" style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 'clamp(160px, 25vw, 260px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Installed Skills ({skills.length})</div>
          {skills.map(s => (
            <button key={s.id} onClick={() => selectSkill(s.id)}
              style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', background: selectedSkill === s.id ? 'rgba(59,130,246,0.1)' : 'transparent', border: `1px solid ${selectedSkill === s.id ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.04)'}`, borderRadius: '8px', cursor: 'pointer', color: selectedSkill === s.id ? '#fff' : '#888', transition: 'all 0.15s' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
              <div style={{ fontSize: '10px', color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
            </button>
          ))}
          {skills.length === 0 && <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', padding: 12 }}>No skills installed. Create one.</div>}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          {selectedSkill && skillMeta ? (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>{skillMeta.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{skillMeta.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" placeholder="args (e.g. 'hello', 42)" value={argsText} onChange={e => setArgsText(e.target.value)} className="dynamic-input" style={{ width: 140, fontSize: 11, padding: '7px 10px' }} />
                  <button onClick={runSkill} disabled={loading} className="glass-btn glass-btn-primary" style={{ padding: '7px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981' }}>
                    <Play size={13} /> {loading ? '...' : 'Run'}
                  </button>
                  <button onClick={saveSkill} className="glass-btn" style={{ padding: '7px 12px' }}>
                    <Save size={13} /> Save
                  </button>
                  <button onClick={() => deleteSkill(selectedSkill)} className="glass-btn" style={{ padding: '7px 10px', color: '#ef4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <textarea value={code} onChange={e => setCode(e.target.value)}
                  className="dynamic-input"
                  style={{ flex: 1, resize: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)', lineHeight: '1.6', padding: '16px', minHeight: '180px' }}
                  placeholder="// Write TypeScript skill code here..." />
              </div>

              {/* Execution Logs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '120px', maxHeight: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#666', fontWeight: 600 }}>
                  <Terminal size={13} /> Execution History ({execLogs.length})
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  {execLogs.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>Run the skill to see output here.</div>
                  )}
                  {execLogs.map(log => (
                    <div key={log.id} style={{ padding: '8px 10px', borderRadius: '6px', background: log.status === 'error' ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.04)', border: `1px solid ${log.status === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {log.status === 'success' ? <CheckCircle size={11} color="#10b981" /> : <AlertCircle size={11} color="#ef4444" />}
                        <span style={{ fontSize: 10, color: '#666', fontFamily: 'var(--font-mono)' }}>{formatTime(log.timestamp)}</span>
                        <span style={{ fontSize: 10, color: '#666' }}>· {log.duration}ms</span>
                      </div>
                      <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: log.status === 'error' ? '#ef4444' : '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{log.output}</pre>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              <div style={{ textAlign: 'center' }}>
                <FileCode size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>Select a skill from the sidebar or create a new one.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SkillWorkshop;
