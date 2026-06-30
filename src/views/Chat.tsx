// src/views/Chat.tsx — Advanced chat with streaming, markdown, persistent sessions
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw, AlertTriangle, Send, StopCircle, Terminal, Paperclip,
  Trash2, Plus, MessageSquare, History, Mic, Headphones
} from 'lucide-react';
import type { LogEntry } from '../store/agentStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { config } from '../config';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';

const API = config.API_BASE;

interface Workspace {
  id: string; name: string; sessionId: string;
}

interface ChatSession {
  id: string; name: string; created_at: string; updated_at: string; message_count: number;
}

function formatTime(ts?: string) {
  if (ts) return ts;
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/* ── Markdown Renderer ────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LANG_COLORS: Record<string, string> = {
  js: '#f7df1e', ts: '#3178c6', py: '#3572a5', rs: '#dea584',
  go: '#00add8', rb: '#cc342d', java: '#b07219', sh: '#89e051',
  json: '#5bc0de', html: '#e34f26', css: '#563d7c', sql: '#e38c00',
  yaml: '#6cb2d1', md: '#083fa1', rust: '#dea584', typescript: '#3178c6',
};

function mdToHtml(text: string): string {
  const escaped = escapeHtml(text);
  let html = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? `lang-${lang}` : '';
    const color = LANG_COLORS[lang] || '#888';
    const header = lang ? `<span style="display:inline-block;background:${color}22;color:${color};padding:2px 10px;border-radius:4px 4px 0 0;font-size:10px;font-weight:600;font-family:var(--font-mono)">${lang}</span>` : '';
    return `</p><div style="margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid var(--card-border)">${header}<pre class="${langClass}" style="background:var(--card-bg);padding:14px;overflow-x:auto;font-size:12px;line-height:1.5;margin:0;color:var(--text-main);font-family:var(--font-mono)"><code>${code.trim()}</code></pre></div><p>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--card-bg);border:1px solid var(--card-border);padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:var(--font-mono);color:var(--text-main)">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-main);font-weight:700">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em style="color:var(--text-sub)">$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li style="margin:2px 0;list-style:disc;margin-left:20px;color:var(--text-main)">$1</li>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:700;margin:12px 0 4px;color:var(--text-main)">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:16px 0 4px;color:var(--text-main)">$1</h2>');
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--card-border);margin:12px 0">');
  return html;
}

function renderMarkdown(text: string) {
  if (text.includes('```') || text.includes('##') || text.includes('**') || text.includes('* ') || text.includes('---')) {
    const html = mdToHtml(text);
    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.6 }} />;
  }
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

/* ── Chat Component ───────────────────────────────────────────────────────────── */

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const operatorName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Operator';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [streamBuffer, setStreamBuffer] = useState<string>('');
  const [hasConfig] = useState(() => !!localStorage.getItem('zuvix_model_config'));
  const [showHistory, setShowHistory] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  /* Session state */
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState<string>('');


  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTextRef = useRef<string>('');
   

  /* Stable ref so onMessage never triggers WS reconnect */
  const activeSessionRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionRef.current = activeSessionId;
  }, [activeSessionId]);

  /* Save a message to the active session via REST */
  const saveMessage = useCallback(async (role: 'user' | 'agent' | 'system', content: string) => {
    const sid = activeSessionRef.current;
    if (!sid) return;
    try {
      await fetch(`${API}/api/chat/sessions/${sid}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-zuvix-user': operatorName
        },
        body: JSON.stringify({ role, content }),
      });
      // Log to memories table in Supabase
      await supabase.from('memories').insert([{ session_id: sid, role, content }]);
    } catch {}
  }, [operatorName]);



  /* Fetch sessions */
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/chat/sessions`);
      if (res.ok) {
        const list: ChatSession[] = await res.json();
        setSessions(list);
        return list;
      }
    } catch {}
    return [];
  }, []);

  /* Create default session */
  const createSession = useCallback(async (name?: string) => {
    try {
      const res = await fetch(`${API}/api/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || `Chat ${new Date().toLocaleDateString()}` }),
      });
      if (res.ok) {
        const session: ChatSession = await res.json();
        setSessions(prev => [session, ...prev]);
        setActiveSessionId(session.id);
        setLogs([]);
        return session;
      }
    } catch {}
    return null;
  }, []);

  /* Load messages for a session */
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API}/api/chat/sessions/${sessionId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs: LogEntry[] = (data.messages || []).map((m: any) => ({
          timestamp: formatTime(m.created_at),
          agentName: m.role === 'user' ? 'User' : m.role === 'agent' ? 'Agent' : 'System',
          message: m.content,
          type: m.role === 'user' ? 'user' as any : 'info' as any,
        }));
        setLogs(msgs);
        setActiveSessionId(sessionId);
      }
    } catch {}
  }, []);

  /* Init: fetch sessions, create default if empty */
  useEffect(() => {
    fetchSessions().then(list => {
      if (list.length === 0) {
        createSession();
      } else {
        setActiveSessionId(list[0].id);
        loadSession(list[0].id);
      }
    });
  }, [fetchSessions, createSession, loadSession]);

  useEffect(() => {
    const handleNewSession = () => createSession();
    window.addEventListener('zuvix-new-session', handleNewSession);
    return () => window.removeEventListener('zuvix-new-session', handleNewSession);
  }, [createSession]);

  /* WebSocket message handler */
  const onMessage = useCallback((msg: any) => {
    if (msg.type === 'log') {
      const logData = msg.data || msg.payload;
      setLogs(prev => {
        const entry: LogEntry = logData.message
          ? { timestamp: formatTime(), agentName: 'Agent', message: logData.message, type: 'info' }
          : logData;
        return [...prev, entry];
      });
    } else if (msg.type === 'status') {
      setIsRunning(msg.payload.status === 'running');
      if (msg.payload.status !== 'running') {
        setStreamBuffer('');
        // Save accumulated agent text on completion
        if (currentTextRef.current.trim()) {
          saveMessage('agent', currentTextRef.current);
          currentTextRef.current = '';
        }
      }
    } else if (msg.type === 'stream') {
      const token = msg.data?.token || msg.payload?.token || '';
      if (token) {
        currentTextRef.current += token;
        setStreamBuffer(prev => {
          const next = prev + token;
          if (streamTimeout.current) clearTimeout(streamTimeout.current);
          streamTimeout.current = setTimeout(() => {
            setLogs(prev => {
              const last = prev[prev.length - 1];
              if (last && last.type === 'stream') {
                return prev.map((l, i) => i === prev.length - 1 ? { ...l, message: l.message + token } : l);
              }
              return [...prev, { timestamp: formatTime(), agentName: 'Agent', message: next, type: 'stream' as any }];
            });
            setStreamBuffer('');
          }, 100);
          return next;
        });
      }
    } else if (msg.type === 'result') {
      const text = msg.data?.text || msg.payload?.text || msg.data?.result || msg.payload?.result || '';
      if (text) {
        currentTextRef.current = text;
        setLogs(prev => {
          const last = prev[prev.length - 1];
          if (last && (last.type === 'stream' as any || last.type === 'info')) {
            return prev.map((l, i) => i === prev.length - 1 ? { ...l, message: text, type: l.type as any } : l);
          }
          return [...prev, { timestamp: formatTime(), agentName: 'Agent', message: text, type: 'info' }];
        });
        setStreamBuffer('');
        // Save result to session
        if (text.trim()) {
          saveMessage('agent', text);
          currentTextRef.current = '';
        }
      }
    } else if (msg.type === 'trigger-voice') {
      window.dispatchEvent(new CustomEvent('zuvix-trigger-voice'));
    } else if (msg.type === 'error') {
      const errMsg = msg.data?.error || msg.payload?.error || 'An error occurred';
      setLogs(prev => [...prev, { timestamp: formatTime(), agentName: 'System', message: `Error: ${errMsg}`, type: 'info' as any }]);
      setIsRunning(false);
      saveMessage('system', `Error: ${errMsg}`);
    }
  }, [saveMessage]);

  /* Stable onMessage — never depends on state that changes with sessions */
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const stableOnMessage = useCallback((msg: any) => {
    onMessageRef.current(msg);
  }, []);

  const { connected, send } = useWebSocket({ onMessage: stableOnMessage });

  useEffect(() => {
    if (connected) {
      setLogs(prev => {
        if (prev.length && prev[prev.length - 1]?.agentName === 'System') return prev;
        return [...prev, { timestamp: formatTime(), agentName: 'System', message: 'Connected to Zuvix Backend.', type: 'info' }];
      });
    }
  }, [connected]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [logs, streamBuffer]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/workspaces`);
        const list = await res.json();
        setWorkspaces(list);
        if (list.length > 0 && !activeWorkspaceId) setActiveWorkspaceId(list[0].id);
      } catch {}
    })();
  }, []);

  const handleSend = useCallback(() => {
    const text = customPrompt.trim();
    if (!text || !connected || isRunning) return;

    const savedConfigStr = localStorage.getItem('zuvix_model_config');
    let modelConfig = {};
    if (savedConfigStr) try { modelConfig = JSON.parse(savedConfigStr); } catch {}

    const doSend = (sessionId: string) => {
      setIsRunning(true);
      setLogs(prev => [...prev, { timestamp: formatTime(), agentName: 'User', message: text, type: 'user' }]);
      fetch(`${API}/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-zuvix-user': operatorName
        },
        body: JSON.stringify({ role: 'user', content: text }),
      }).catch(() => {});
      // Log user message to memories table in Supabase
      supabase.from('memories').insert([{ session_id: sessionId, role: 'user', content: text }]).then(() => {});
      
      send({ type: 'execute_task', payload: { goal: text, modelConfig, workspaceId: activeWorkspaceId, sessionId } });
      setCustomPrompt('');
    };

    if (activeSessionId) {
      doSend(activeSessionId);
    } else {
      createSession().then(session => { if (session) doSend(session.id); });
      setCustomPrompt('');
    }
  }, [customPrompt, connected, isRunning, send, activeSessionId, activeWorkspaceId, createSession]);

  const handleReset = useCallback(() => {
    setLogs([]);
    setCustomPrompt('');
    setStreamBuffer('');
    currentTextRef.current = '';
  }, []);

  const handleCancel = useCallback(() => {
    send({ type: 'cancel_task', payload: {} });
    setIsRunning(false);
    setLogs(prev => [...prev, { timestamp: formatTime(), agentName: 'System', message: 'Task cancelled by user.', type: 'info' }]);
  }, [send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lang = file.name.split('.').pop() || '';
    setCustomPrompt(prev => prev + `\n\`\`\`${lang}\n${text.slice(0, 4000)}\n\`\`\`\n`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* Delete a session */
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await fetch(`${API}/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          loadSession(remaining[0].id);
        } else {
          createSession();
        }
      }
    } catch {}
  };

  const handleRenameSession = async (sessionId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`${API}/api/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name: newName.trim() } : s));
      }
    } catch {}
    setEditingSessionId(null);
  };

   

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .session-item:hover .session-delete-btn { display: block !important; }
        .session-item:hover .session-title-text { max-width: calc(100% - 24px) !important; }
      `}</style>

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Gradients */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Header */}
        <div className="responsive-header glass-panel" style={{ padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Command Center</h1>
              <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Interact directly with Zuvix Agents.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => createSession()} className="glass-btn" style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Plus size={14} /> New Chat
            </button>
            <button onClick={handleReset} className="glass-btn" style={{ padding: '6px 10px', cursor: 'pointer' }}>
              <RotateCcw size={13} /> Clear
            </button>
            <span className={`glass-status ${connected ? 'glass-status-online' : 'glass-status-offline'}`}>
              {connected ? '● Online' : '● Offline'}
            </span>
          </div>
        </div>

        {!hasConfig && (
          <div style={{ margin: '0 24px 12px', padding: '14px 16px', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: '#fcd34d', fontSize: '13px' }}>
            <AlertTriangle size={18} />
            <span>No Model API Key configured. Visit Settings to set one up.</span>
          </div>
        )}

        <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px' }}>
          {logs.map((log, idx) => {
            const isUser = log.type === 'user';
            let bgColor = 'var(--card-bg)';
            let borderColor = 'var(--card-border)';
            let textColor = 'var(--text-main)';

            if (isUser) {
              bgColor = 'var(--primary)';
              borderColor = 'transparent';
              textColor = '#fff';
            } else if (log.type === 'thought') {
              bgColor = 'var(--thought-bg)';
              borderColor = 'var(--thought-border)';
              textColor = 'var(--thought-text)';
            } else if ((log as any).type === 'stream') {
              bgColor = 'rgba(16,185,129,0.06)';
              borderColor = 'rgba(16,185,129,0.2)';
              textColor = 'var(--text-main)';
            }

            const sameAsPrev = idx > 0 && logs[idx - 1]?.agentName === log.agentName && !isUser;

            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '100%', zIndex: 1 }}>
                {!sameAsPrev && (
                  <span style={{ fontSize: '10px', color: '#666', marginBottom: '4px', padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {log.agentName || 'Agent'} • {log.timestamp}
                  </span>
                )}
                <div className={isUser ? 'clay-bubble clay-bubble-user' : log.type === 'thought' ? 'clay-bubble clay-bubble-thought' : 'clay-bubble clay-bubble-agent'} style={{
                  padding: '12px 16px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px', maxWidth: '85%', fontSize: '14px',
                  lineHeight: '1.6', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                  backgroundColor: isUser ? 'var(--primary)' : log.type === 'thought' ? 'var(--thought-bg)' : 'var(--clay-bg)',
                  color: isUser ? '#fff' : log.type === 'thought' ? 'var(--thought-text)' : 'var(--text-main)',
                  border: log.type === 'thought' ? '1px solid var(--thought-border)' : 'none',
                  boxShadow: isUser ? '0 4px 12px rgba(255,107,129,0.25)' : 'var(--clay-shadow)',
                }}>
                  {renderMarkdown(log.message)}
                </div>
              </div>
            );
          })}

          {isRunning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', color: '#888', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulsing-node" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
                Zuvix is thinking...
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'var(--chat-fade-bg)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 10 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '24px' }}>
            
            <button onClick={() => fileInputRef.current?.click()} className="glass-btn" style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={20} />
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileAttach} style={{ display: 'none' }} />
            
            <textarea
              ref={inputRef}
              placeholder={connected ? 'Ask Zuvix or type a command...' : 'Connecting to server...'}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '15px', minHeight: '24px', maxHeight: '150px', resize: 'none', padding: '10px 0', outline: 'none', lineHeight: '1.4' }}
              disabled={isRunning || !connected}
              rows={1}
            />
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isRunning ? (
                <button onClick={handleCancel} className="clay-btn clay-btn-danger" style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StopCircle size={18} />
                </button>
              ) : customPrompt.trim() ? (
                <button onClick={handleSend} disabled={!connected} className="clay-btn clay-btn-primary" style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={16} />
                </button>
              ) : (
                <>
                  <button title="Voice Input" className="glass-btn" style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mic size={20} />
                  </button>
                  <button title="Live Chat (LiveKit)" className="glass-btn glass-btn-primary" style={{ width: '38px', height: '38px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => {
                     window.dispatchEvent(new CustomEvent('zuvix-open-talk'));
                     window.dispatchEvent(new CustomEvent('zuvix-wake'));
                  }}>
                    <Headphones size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
