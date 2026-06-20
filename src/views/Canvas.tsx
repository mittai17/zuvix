import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Code, Send, RefreshCw, Monitor, Maximize2, Minimize2, Wifi, WifiOff, Terminal, Trash2 } from 'lucide-react';
import { config } from '../config';

interface CanvasAction {
  action: 'present' | 'navigate' | 'eval' | 'hide' | 'snapshot';
  content?: string;
  url?: string;
  script?: string;
}

const DEMO_HTML = `<!DOCTYPE html>
<html>
<head><style>
body{background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:1rem}
h1{font-size:2rem;font-weight:700;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
p{color:#64748b;max-width:400px;text-align:center;line-height:1.6}
</style></head>
<body>
<h1>Canvas Streaming Active</h1>
<p>Agents can push live HTML to this surface in real-time via WebSocket. Try the Present button below.</p>
</body>
</html>`;

export const Canvas: React.FC = () => {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CanvasAction[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [streamHtml, setStreamHtml] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufRef = useRef('');

  // Connect to canvas WebSocket
  useEffect(() => {
    const canvasUrl = config.WS_URL.replace('/ws', '/ws/canvas');
    const ws = new WebSocket(canvasUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'canvas_state') {
          const p = msg.payload;
          if (p.html) setStreamHtml(p.html);
          if (p.activeUrl) setActiveUrl(p.activeUrl);
          else setActiveUrl(null);
        } else if (msg.type === 'canvas_stream') {
          const p = msg.payload;
          streamBufRef.current += p.html || '';
          setStreamHtml(streamBufRef.current);
          setStreaming(true);
          // Reset streaming flag after a pause
          clearTimeout((window as any).__streamTimeout);
          (window as any).__streamTimeout = setTimeout(() => {
            setStreaming(false);
            streamBufRef.current = '';
          }, 500);
        }
      } catch { }
    };

    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => ws.close();

    return () => {
      ws.close();
      clearTimeout((window as any).__streamTimeout);
    };
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/canvas`);
      if (res.ok) {
        const data = await res.json();
        if (data.html) setStreamHtml(data.html);
        if (data.activeUrl) setActiveUrl(data.activeUrl);
      }
    } catch { }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const sendAction = async (action: CanvasAction) => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE}/api/canvas/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action)
      });
      if (res.ok) {
        setHistory(prev => [action, ...prev]);
        if (action.action === 'present') {
          setActiveUrl(null);
          setStreamHtml(action.content || null);
        }
      }
    } catch { }
    setLoading(false);
  };

  const handlePresent = () => {
    if (!codeInput.trim()) return;
    sendAction({ action: 'present', content: codeInput });
  };

  const handleEval = () => {
    if (!codeInput.trim()) return;
    sendAction({ action: 'eval', script: codeInput });
    // Execute in iframe
    try {
      if (iframeRef.current?.contentWindow) {
        (iframeRef.current.contentWindow as any).eval(codeInput);
      }
    } catch { }
  };

  const resetCanvas = () => {
    sendAction({ action: 'present', content: DEMO_HTML });
    setCodeInput('');
    streamBufRef.current = '';
    setStreamHtml(DEMO_HTML);
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const canvasUrl = activeUrl
    ? activeUrl
    : streamHtml
      ? `data:text/html;charset=utf-8,${encodeURIComponent(streamHtml)}`
      : `${config.API_BASE}/__zuvix__/canvas/index.html`;

  // Handle full-screen
  useEffect(() => {
    const el = document.getElementById('canvas-container');
    if (!el) return;
    if (fullscreen) {
      el.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, [fullscreen]);

  return (
    <div id="canvas-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Monitor size={24} style={{ color: 'var(--primary)' }} /> Canvas
          </h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            Agent-rendered visual surface with real-time streaming
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: wsConnected ? '#10b981' : '#ef4444' }}>
              {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
              {wsConnected ? `${streaming ? 'Streaming...' : 'Connected'}` : 'Disconnected'}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {streaming && <span style={{ fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(245,158,11,0.1)', borderRadius: 6 }}>
            <Terminal size={10} /> Live stream
          </span>}
          <button onClick={() => setVisible(!visible)} className="glass-btn" style={{ padding: '8px 12px' }}>
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            {visible ? 'Hide' : 'Show'}
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} className="glass-btn" style={{ padding: '8px 12px' }}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={resetCanvas} className="glass-btn" style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888' }}>
            <Monitor size={14} />
            <span>Canvas Preview</span>
            {activeUrl && <span style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)', fontSize: 11 }}>({activeUrl})</span>}
            {!activeUrl && streamHtml && <span style={{ color: '#10b981', fontSize: 11 }}>(inline HTML · {streamHtml.length.toLocaleString()} bytes)</span>}
          </div>
          <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#0f172a', position: 'relative' }}>
            {visible ? (
              <iframe
                ref={iframeRef}
                src={canvasUrl}
                style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a' }}
                title="Zuvix Canvas"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                Canvas hidden
              </div>
            )}
            {streaming && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(245,158,11,0.9)', borderRadius: 20, fontSize: 10, color: '#000', fontWeight: 600 }}>
                <Terminal size={10} /> Streaming...
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 'clamp(200px, 35vw, 340px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '160px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888', fontWeight: 600 }}>
              <Code size={14} /> Agent Canvas Editor
              {streaming && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#f59e0b' }}>receiving stream...</span>}
            </div>
            <textarea
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              className="dynamic-input"
              style={{ flex: 1, resize: 'none', fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: 1.5, padding: '12px', minHeight: '120px' }}
              placeholder="<h1>Hello from the agent!</h1>"
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handlePresent} disabled={loading || !codeInput.trim()} className="glass-btn glass-btn-primary" style={{ flex: 1, padding: '8px', background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#60a5fa', justifyContent: 'center' }}>
                <Send size={13} /> Present
              </button>
              <button onClick={handleEval} disabled={!codeInput.trim()} className="glass-btn" style={{ flex: 1, padding: '8px', justifyContent: 'center' }}>
                <Code size={13} /> Eval JS
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px', minHeight: '150px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>Action History ({history.length})</div>
              {history.length > 0 && (
                <button onClick={handleClearHistory} className="glass-btn" style={{ padding: '4px 6px' }}><Trash2 size={10} /></button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {history.length === 0 && <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No actions yet. Agents push HTML here in real-time.</div>}
              {history.map((action, i) => (
                <div key={i} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '6px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{action.action}</span>
                  <span style={{ color: '#888', marginLeft: 6 }}>
                    {action.action === 'present' ? `${(action.content || '').substring(0, 60)}...` :
                     action.action === 'navigate' ? action.url :
                     action.action === 'eval' ? (action.script || '').substring(0, 60) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Canvas;
