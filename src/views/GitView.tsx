import { useState } from 'react';
import { config } from '../config';
import { GitBranch, Download, FileText, ArrowUp, GitPullRequest, List } from 'lucide-react';

const API = config.API_BASE;

export default function GitView() {
  const [repoPath, setRepoPath] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState('');

  async function handleClone() {
    if (!cloneUrl.trim()) return;
    setLoading('clone');
    try {
      const res = await fetch(`${API}/api/git/clone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cloneUrl, targetDir: repoPath || undefined }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (data.success) setRepoPath(data.data?.path || '');
    } catch {}
    setLoading('');
  }

  async function handleStatus() {
    if (!repoPath.trim()) return;
    setLoading('status');
    try {
      const res = await fetch(`${API}/api/git/status?path=${encodeURIComponent(repoPath)}`);
      const data = await res.json();
      setStatus(data.data);
      setResult(JSON.stringify(data, null, 2));
    } catch {}
    setLoading('');
  }

  async function handleLog() {
    if (!repoPath.trim()) return;
    setLoading('log');
    try {
      const res = await fetch(`${API}/api/git/log?path=${encodeURIComponent(repoPath)}&maxCount=15`);
      const data = await res.json();
      setLog(data.data || []);
      setResult(JSON.stringify(data, null, 2));
    } catch {}
    setLoading('');
  }

  async function handleCommit() {
    if (!repoPath.trim()) return;
    setLoading('commit');
    try {
      const res = await fetch(`${API}/api/git/commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, message: commitMsg || 'Auto-commit' }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      setCommitMsg('');
    } catch {}
    setLoading('');
  }

  async function handlePush() {
    if (!repoPath.trim()) return;
    setLoading('push');
    try {
      const res = await fetch(`${API}/api/git/push`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch {}
    setLoading('');
  }

  async function handleCreatePR() {
    if (!repoPath.trim() || !prTitle.trim()) return;
    setLoading('pr');
    try {
      const res = await fetch(`${API}/api/git/create-pr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, title: prTitle, body: prBody }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch {}
    setLoading('');
  }

  const tabs = [
    { id: 'status', label: 'Status', icon: List, action: handleStatus },
    { id: 'log', label: 'Log', icon: GitBranch, action: handleLog },
    { id: 'commit', label: 'Commit', icon: FileText, action: handleCommit },
    { id: 'push', label: 'Push', icon: ArrowUp, action: handlePush },
    { id: 'clone', label: 'Clone', icon: Download, action: handleClone },
    { id: 'pr', label: 'PR', icon: GitPullRequest, action: handleCreatePR },
  ];

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <GitBranch size={18} /> Git Integration
      </h2>

      {/* Repo path */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Repository</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={repoPath} onChange={e => setRepoPath(e.target.value)}
            placeholder="/path/to/repo" style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
              color: '#e2e8f0', fontSize: 13, outline: 'none',
            }} />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={t.action} disabled={loading === t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
                  border: loading === t.id ? '1px solid #3b82f6' : '1px solid var(--card-border)',
                  background: loading === t.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: loading === t.id ? '#3b82f6' : '#ccc', fontSize: 11, cursor: 'pointer',
                }}>
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Clone URL */}
        {loading === 'clone' && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input value={cloneUrl} onChange={e => setCloneUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git" style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
              }} />
          </div>
        )}

        {/* Commit message */}
        {loading === 'commit' && (
          <div style={{ marginTop: 8 }}>
            <input value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
              placeholder="Commit message..." style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
              }} />
          </div>
        )}

        {/* PR fields */}
        {loading === 'pr' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={prTitle} onChange={e => setPrTitle(e.target.value)}
              placeholder="PR title..." style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
              }} />
            <textarea value={prBody} onChange={e => setPrBody(e.target.value)}
              placeholder="PR body..." rows={2} style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
                color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
              }} />
          </div>
        )}
      </div>

      {/* Status display */}
      {status && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 10, padding: 12, marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Status · <span style={{ color: status.clean ? '#10b981' : '#f97316' }}>
              {status.branch} {status.clean ? '(clean)' : `(${status.files?.length || 0} files changed)`}
            </span>
          </div>
          {status.files?.map((f: any, i: number) => (
            <div key={i} style={{
              display: 'flex', gap: 6, padding: '3px 0', fontSize: 11, color: '#aaa',
              fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: f.status === 'M' ? '#f97316' : f.status === '?' ? '#3b82f6' : '#888', width: 20 }}>
                {f.status || '?'}
              </span>
              <span>{f.file}</span>
            </div>
          ))}
        </div>
      )}

      {/* Log display */}
      {log.length > 0 && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 10, padding: 12, marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Recent Commits</div>
          {log.map((c: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 11, color: '#aaa' }}>
              <span style={{ color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>{c.hash}</span>
              <span style={{ flex: 1 }}>{c.message}</span>
              <span style={{ color: '#555' }}>{c.author} · {c.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* Raw result */}
      {result && (
        <pre style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)',
          borderRadius: 10, padding: 12, fontSize: 11, color: '#aaa',
          maxHeight: 300, overflow: 'auto', fontFamily: 'var(--font-mono)',
        }}>{result}</pre>
      )}
    </div>
  );
}
