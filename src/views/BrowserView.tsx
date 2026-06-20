import { useState, useRef } from 'react';
import { api } from '../api';
import { Globe, Play, Square, Camera, FileText, Navigation, MousePointer, Type, Code, ArrowDown } from 'lucide-react';

interface BrowserStatus {
  running: boolean;
  url: string;
  pageOpen: boolean;
}

interface BrowserResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
  url?: string;
  title?: string;
}

const ACTIONS = [
  { id: 'navigate', label: 'Navigate', icon: Navigation },
  { id: 'click', label: 'Click', icon: MousePointer },
  { id: 'type', label: 'Type', icon: Type },
  { id: 'extract', label: 'Extract Text', icon: FileText },
  { id: 'screenshot', label: 'Screenshot', icon: Camera },
  { id: 'snapshot', label: 'Accessibility Tree', icon: Code },
  { id: 'scroll', label: 'Scroll', icon: ArrowDown },
  { id: 'evaluate', label: 'Run JS', icon: Code },
] as const;

export default function BrowserView() {
  const [status, setStatus] = useState<BrowserStatus>({ running: false, url: 'about:blank', pageOpen: false });
  const [action, setAction] = useState('navigate');
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<BrowserResult | null>(null);
  const [loading, setLoading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  async function launch() {
    setLoading(true);
    try {
      const res = await api('/browser/launch', 'POST', { headless: true });
      setStatus(res.status);
    } catch { setResult({ success: false, error: 'Failed to launch browser' }); }
    setLoading(false);
  }

  async function close() {
    setLoading(true);
    try {
      await api('/browser/close', 'POST');
      setStatus({ running: false, url: 'about:blank', pageOpen: false });
      setResult(null);
    } catch {}
    setLoading(false);
  }

  async function execute() {
    setLoading(true);
    setResult(null);
    try {
      const body: any = { action };
      if (selector) body.target = selector;
      if (value) body.value = value;
      if (action === 'navigate') body.value = value || 'https://example.com';
      if (action === 'scroll') body.value = value || '500';
      if (action === 'type') body.target = selector;
      if (action === 'click') body.target = selector;
      const res = await api('/browser/execute', 'POST', body);
      setResult(res);
      if (res.url) setStatus(s => ({ ...s, url: res.url }));
    } catch { setResult({ success: false, error: 'Execution failed' }); }
    setLoading(false);
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe size={18} /> Browser Automation
      </h2>

      {/* Controls */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: status.running ? '#10b981' : '#666', flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: status.running ? '#10b981' : '#888' }}>
            {status.running ? 'Browser Running' : 'Browser Idle'}
          </span>
          <span style={{ fontSize: 11, color: '#555' }}>· {status.url}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {!status.running ? (
            <button onClick={launch} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <Play size={14} /> Launch
            </button>
          ) : (
            <button onClick={close} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <Square size={14} /> Close
            </button>
          )}
        </div>

        {status.running && (
          <>
            {/* Action selector */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {ACTIONS.map(a => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAction(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6,
                      border: action === a.id ? '1px solid #3b82f6' : '1px solid var(--card-border)',
                      background: action === a.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: action === a.id ? '#3b82f6' : '#888', fontSize: 11, cursor: 'pointer',
                    }}>
                    <Icon size={12} /> {a.label}
                  </button>
                );
              })}
            </div>

            {/* Input fields */}
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              {['navigate', 'type', 'click', 'scroll', 'evaluate'].includes(action) && (
                <input
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={
                    action === 'navigate' ? 'https://example.com' :
                    action === 'type' ? 'Text to type...' :
                    action === 'scroll' ? 'Pixels to scroll (500)' :
                    action === 'evaluate' ? 'JavaScript expression...' :
                    'Value...'
                  }
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
                    background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none',
                  }}
                />
              )}
              {['click', 'type', 'extract'].includes(action) && (
                <input
                  value={selector}
                  onChange={e => setSelector(e.target.value)}
                  placeholder="CSS selector..."
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
                    background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none',
                  }}
                />
              )}
              <button onClick={execute} disabled={loading} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
                border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start',
              }}>
                <Play size={14} /> Execute
              </button>
            </div>
          </>
        )}
      </div>

      {/* Results */}
      {loading && <div style={{ textAlign: 'center', padding: 24, color: '#666' }}>Running...</div>}
      {result && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Result ({result.success ? 'Success' : 'Error'})
            {result.url && <span style={{ color: '#555', fontWeight: 400 }}> · {result.url}</span>}
            {result.title && <span style={{ color: '#555', fontWeight: 400 }}> · {result.title}</span>}
          </div>

          {result.error && <p style={{ color: '#ef4444', fontSize: 12 }}>{result.error}</p>}

          {result.screenshot && (
            <div style={{ marginTop: 8 }}>
              <img
                ref={imgRef}
                src={`data:image/png;base64,${result.screenshot}`}
                alt="Browser screenshot"
                style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--card-border)' }}
              />
            </div>
          )}

          {result.data && typeof result.data === 'string' && (
            <pre style={{
              marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              fontSize: 11, color: '#ccc', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {result.data}
            </pre>
          )}

          {result.data && typeof result.data === 'object' && (
            <pre style={{
              marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              fontSize: 11, color: '#ccc', maxHeight: 400, overflow: 'auto',
            }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
