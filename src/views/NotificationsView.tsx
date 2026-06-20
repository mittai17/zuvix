import { useState, useEffect } from 'react';
import { config } from '../config';
import { Bell, CheckCheck, Send, Mail, Globe } from 'lucide-react';

const API = config.API_BASE;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  createdAt: number;
  read: boolean;
  delivered: boolean;
}

export default function NotificationsView() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [sendTitle, setSendTitle] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendType, setSendType] = useState<'desktop' | 'email' | 'webhook'>('desktop');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [listRes, unreadRes] = await Promise.all([
        fetch(`${API}/api/notifications`),
        fetch(`${API}/api/notifications/unread-count`),
      ]);
      setNotifs(await listRes.json());
      const { count } = await unreadRes.json();
      setUnread(count);
    } catch {}
  }

  async function sendNotification() {
    if (!sendTitle.trim() || !sendMessage.trim()) return;
    try {
      await fetch(`${API}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: sendType, title: sendTitle, message: sendMessage }),
      });
      setSendTitle('');
      setSendMessage('');
      load();
    } catch {}
  }

  async function markAllRead() {
    await fetch(`${API}/api/notifications/read-all`, { method: 'POST' });
    load();
  }

  function getPriorityColor(p: string) {
    switch (p) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'normal': return '#3b82f6';
      default: return '#888';
    }
  }

  function getTypeIcon(t: string) {
    switch (t) {
      case 'email': return <Mail size={12} />;
      case 'webhook': return <Globe size={12} />;
      default: return <Bell size={12} />;
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bell size={18} /> Notifications {unread > 0 && <span style={{ fontSize: 11, color: '#3b82f6' }}>({unread} unread)</span>}
      </h2>

      {/* Send */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Send Notification</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['desktop', 'email', 'webhook'] as const).map(t => (
            <button key={t} onClick={() => setSendType(t)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11,
              border: `1px solid ${sendType === t ? '#3b82f6' : 'var(--card-border)'}`,
              background: sendType === t ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: sendType === t ? '#3b82f6' : '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {getTypeIcon(t)} {t}
            </button>
          ))}
        </div>
        <input value={sendTitle} onChange={e => setSendTitle(e.target.value)}
          placeholder="Title..." style={{
            width: '100%', padding: '8px 12px', marginBottom: 6, borderRadius: 8,
            border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
            color: '#e2e8f0', fontSize: 13, outline: 'none',
          }} />
        <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)}
          placeholder="Message..." rows={2} style={{
            width: '100%', padding: '8px 12px', marginBottom: 8, borderRadius: 8,
            border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)',
            color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
          }} />
        <button onClick={sendNotification} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
          border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Send size={14} /> Send
        </button>
      </div>

      {/* History */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>History ({notifs.length})</div>
        <button onClick={markAllRead} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
          border: 'none', background: 'transparent', color: '#3b82f6', fontSize: 11, cursor: 'pointer',
        }}>
          <CheckCheck size={12} /> Mark all read
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notifs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>No notifications yet.</div>
        )}
        {notifs.map(n => (
          <div key={n.id} style={{
            display: 'flex', gap: 10, padding: '10px 14px',
            background: n.read ? 'var(--card-bg)' : 'rgba(59,130,246,0.05)',
            border: `1px solid ${n.read ? 'var(--card-border)' : 'rgba(59,130,246,0.2)'}`,
            borderRadius: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: getPriorityColor(n.priority), marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div style={{ fontSize: 10, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {getTypeIcon(n.type)} {new Date(n.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{n.message}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
                {n.priority} · {n.delivered ? 'Delivered' : 'Pending'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
