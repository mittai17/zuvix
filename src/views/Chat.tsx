// src/views/Chat.tsx — Advanced chat with streaming, markdown, highlighting
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, AlertTriangle, Send, StopCircle, Terminal, Paperclip } from 'lucide-react';
import type { LogEntry } from '../store/agentStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { config } from '../config';

const API = config.API_BASE;

interface Workspace {
  id: string;
  name: string;
  sessionId: string;
}

function formatTime(ts?: string) {
  if (ts) return ts;
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// ── Markdown Renderer ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LANG_COLORS: Record<string, string> = {
  js: '#f7df1e', ts: '#3178c6', py: '#3572a5', rs: '#dea584',
  go: '#00add8', rb: '#cc342d', java: '#b07219', sh: '#89e051',
  json: '#5bc0de', html: '#e34f26', css: '#563d7c', sql: '#e38c00',
  yaml: '#6cb2d1', md: '#083fa1', rust: '#dea584', typescript: '#3178c6',
};

// Simple regex-based markdown → HTML converter
function mdToHtml(text: string): string {
  const escaped = escapeHtml(text);

  // Code blocks (```lang\n...```)
  let html = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? `lang-${lang}` : '';
    const color = LANG_COLORS[lang] || '#888';
    const header = lang ? `<span style="display:inline-block;background:${color}22;color:${color};padding:2px 10px;border-radius:4px 4px 0 0;font-size:10px;font-weight:600;font-family:var(--font-mono)">${lang}</span>` : '';
    return `</p><div style="margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">${header}<pre class="${langClass}" style="background:#0a0f1a;padding:14px;overflow-x:auto;font-size:12px;line-height:1.5;margin:0;color:#94a3b8;font-family:var(--font-mono)"><code>${code.trim()}</code></pre></div><p>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:var(--font-mono);color:#e2e8f0">$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f1f5f9">$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em style="color:#94a3b8">$1</em>');

  // Inline links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">$1</a>');

  // Unordered lists (- item)
  html = html.replace(/^- (.+)$/gm, '<li style="margin:2px 0;list-style:disc;margin-left:20px">$1</li>');

  // Headers (## heading)
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:700;margin:12px 0 4px;color:#e2e8f0">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:16px 0 4px;color:#e2e8f0">$1</h2>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:12px 0">');

  return html;
}

function renderMarkdown(text: string) {
  // If contains block elements, use dangerouslySetInnerHTML
  if (text.includes('```') || text.includes('##') || text.includes('**') || text.includes('* ') || text.includes('---')) {
    const html = mdToHtml(text);
    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.6 }} />;
  }

  // Inline only — use React elements
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'var(--font-mono)' }}>{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Chat Component ─────────────────────────────────────────────────────────────

export const Chat: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [streamBuffer, setStreamBuffer] = useState<string>('');
  const [hasConfig] = useState(() => !!localStorage.getItem('zuvix_model_config'));
  const [showHistory, setShowHistory] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      }
    } else if (msg.type === 'stream') {
      // Streaming token
      const token = msg.data?.token || msg.payload?.token || '';
      if (token) {
        setStreamBuffer(prev => {
          const next = prev + token;
          // Debounce flush to logs
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
      // Final result with full text
      const text = msg.data?.text || msg.payload?.text || msg.data?.result || msg.payload?.result || '';
      if (text) {
        setLogs(prev => {
          const last = prev[prev.length - 1];
          if (last && (last.type === 'stream' as any || last.type === 'info')) {
            return prev.map((l, i) => i === prev.length - 1 ? { ...l, message: text, type: l.type as any } : l);
          }
          return [...prev, { timestamp: formatTime(), agentName: 'Agent', message: text, type: 'info' }];
        });
        setStreamBuffer('');
      }
    } else if (msg.type === 'error') {
      const errMsg = msg.data?.error || msg.payload?.error || 'An error occurred';
      setLogs(prev => [...prev, { timestamp: formatTime(), agentName: 'System', message: `Error: ${errMsg}`, type: 'info' as any }]);
      setIsRunning(false);
    }
  }, []);

  const { connected, send } = useWebSocket({ onMessage });

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

  // Load workspaces
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

    setIsRunning(true);
    setLogs(prev => [...prev, { timestamp: formatTime(), agentName: 'User', message: text, type: 'user' }]);
    send({ type: 'execute_task', payload: { goal: text, modelConfig, workspaceId: activeWorkspaceId } });
    setCustomPrompt('');
  }, [customPrompt, connected, isRunning, send]);

  const handleReset = useCallback(() => {
    setLogs([]);
    setCustomPrompt('');
    setStreamBuffer('');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="responsive-header" style={{ padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent', zIndex: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Command Center</h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Interact directly with Zuvix OS Agents.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Workspace selector */}
          {workspaces.length > 0 && (
            <select
              value={activeWorkspaceId || ''}
              onChange={e => setActiveWorkspaceId(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--card-border)',
                background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: 11, outline: 'none',
                cursor: 'pointer', maxWidth: 150,
              }}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setShowHistory(v => !v)} className="glass-btn" style={{ padding: '6px 10px', fontSize: 11 }}>
            <Terminal size={13} /> {showHistory ? 'Hide' : 'Show'}
          </button>
          <button onClick={handleReset} className="glass-btn" style={{ padding: '6px 10px' }}>
            <RotateCcw size={13} /> Clear
          </button>
          <span style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '12px', fontWeight: 600, backgroundColor: connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: connected ? '#10b981' : '#ef4444', border: `1px solid ${connected ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}` }}>
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
        {showHistory && logs.map((log, idx) => {
          const isUser = log.type === 'user';
          let bgColor = 'rgba(255,255,255,0.05)';
          let borderColor = 'rgba(255,255,255,0.1)';
          let textColor = '#fff';

          if (isUser) {
            bgColor = 'var(--primary)';
            borderColor = 'transparent';
          } else if (log.type === 'thought') {
            bgColor = 'rgba(124,58,237,0.08)';
            borderColor = 'rgba(124,58,237,0.3)';
            textColor = '#d8b4fe';
          } else if ((log as any).type === 'stream') {
            bgColor = 'rgba(16,185,129,0.06)';
            borderColor = 'rgba(16,185,129,0.2)';
            textColor = '#e2e8f0';
          }

          const sameAsPrev = idx > 0 && logs[idx - 1]?.agentName === log.agentName && !isUser;

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '100%', zIndex: 1 }}>
              {!sameAsPrev && (
                <span style={{ fontSize: '10px', color: '#666', marginBottom: '4px', padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {log.agentName || 'Agent'} • {log.timestamp}
                </span>
              )}
              <div style={{
                backgroundColor: bgColor, border: `1px solid ${borderColor}`, padding: '12px 16px',
                borderRadius: '12px', borderBottomRightRadius: isUser ? '4px' : '12px',
                borderBottomLeftRadius: !isUser ? '4px' : '12px', maxWidth: '85%', fontSize: '14px',
                lineHeight: '1.6', color: textColor, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                backdropFilter: 'blur(12px)', boxShadow: isUser ? '0 4px 12px rgba(139,92,246,0.3)' : '0 4px 12px rgba(0,0,0,0.2)',
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

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.5) 70%, transparent)', display: 'flex', alignItems: 'flex-end', gap: '8px', zIndex: 10 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            placeholder={connected ? 'Initialize Zuvix workflow...' : 'Connecting to server...'}
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass-input"
            style={{ width: '100%', fontSize: '15px', minHeight: '52px', maxHeight: '120px', resize: 'none', paddingRight: '80px', paddingLeft: '44px', paddingTop: '14px', lineHeight: '1.4', borderRadius: '12px' }}
            disabled={isRunning || !connected}
          />
          <button onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', left: '10px', bottom: '10px', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'transparent', color: '#888', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Paperclip size={15} />
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileAttach} style={{ display: 'none' }} />
          {isRunning ? (
            <button onClick={handleCancel} style={{ position: 'absolute', right: '10px', bottom: '10px', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.3)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <StopCircle size={16} />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!connected || !customPrompt.trim()} style={{ position: 'absolute', right: '10px', bottom: '10px', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: customPrompt.trim() && connected ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: customPrompt.trim() && connected ? '#fff' : '#888', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: customPrompt.trim() && connected ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
