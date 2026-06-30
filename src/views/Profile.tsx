/* src/views/Profile.tsx */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  User, Mail, Calendar, LogOut, Shield, Settings, Bell, 
  Activity, Clock, Zap, Key, Globe, Moon, Sun, ChevronRight,
  Copy, Check, Sparkles, TrendingUp, Database
} from 'lucide-react';
import { config } from '../config';

interface UserProfile {
  sessions: number;
  messages: number;
  lastActive: string;
}

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'settings'>('overview');
  const [profile, setProfile] = useState<UserProfile>({ sessions: 0, messages: 0, lastActive: '' });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    (localStorage.getItem('zuvix_theme') as any) || 'light'
  );

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${config.API_BASE}/api/chat/sessions`);
        if (res.ok) {
          const sessions = await res.json();
          const totalMessages = sessions.reduce((acc: number, s: any) => acc + (s.message_count || 0), 0);
          setProfile({
            sessions: sessions.length,
            messages: totalMessages,
            lastActive: sessions[0]?.updated_at || new Date().toISOString(),
          });
        }
      } catch {}
    };
    fetchProfile();
  }, []);

  if (!user) return null;

  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Zuvix User';
  const email = user.email || 'unknown@email.com';
  const createdAt = user.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';
  const lastActive = profile.lastActive
    ? new Date(profile.lastActive).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  const initials = username.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleThemeToggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('zuvix_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next === 'dark' ? 'dark' : 'light';
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', position: 'relative' }}>
      {/* Background gradients */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '280px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', opacity: 0.08, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '5%', right: '5%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(255,107,129,0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '25vw', height: '25vw', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
        
        {/* ── Profile Header Card ── */}
        <div className="glass-card" style={{ 
          padding: '0', marginBottom: '24px', overflow: 'hidden',
          borderRadius: 'var(--border-radius-xl)',
        }}>
          {/* Cover / Banner */}
          <div style={{ 
            height: '120px', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, hsl(250, 65%, 55%) 0%, hsl(320, 70%, 60%) 50%, hsl(250, 80%, 65%) 100%)',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
          </div>

          {/* Avatar + Info */}
          <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Avatar */}
            <div style={{ 
              marginTop: '-52px', position: 'relative', marginBottom: '16px',
            }}>
              <div className="clay-avatar clay-avatar-lg" style={{
                width: '104px', height: '104px', fontSize: '32px', fontWeight: 800,
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: '#fff', boxShadow: 'var(--clay-shadow-lg), 0 0 30px var(--primary-glow)',
                border: '4px solid var(--app-bg)',
              }}>
                {initials}
              </div>
              <div style={{ 
                position: 'absolute', bottom: '4px', right: '4px',
                width: '28px', height: '28px', borderRadius: '50%', 
                background: 'var(--success)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center',
                border: '3px solid var(--app-bg)',
                boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />
              </div>
            </div>

            <h1 className="font-zuvix-title" style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px' }}>
              {username}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', margin: '0 0 12px' }}>
              {email}
            </p>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="glass-badge" style={{ color: 'var(--primary)', background: 'hsla(var(--primary-hue), 85%, 65%, 0.1)' }}>
                <Shield size={11} /> Operator
              </span>
              <span className="glass-badge" style={{ color: 'var(--success)' }}>
                <Activity size={11} /> Active Session
              </span>
              <button onClick={handleCopyId} className="glass-badge" style={{ 
                color: 'var(--text-sub)', cursor: 'pointer', border: 'none',
                background: 'var(--glass-bg)',
              }}>
                {copied ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                {copied ? 'Copied!' : user.id.slice(0, 8) + '...'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { icon: Database, label: 'Sessions', value: profile.sessions, color: 'var(--primary)' },
            { icon: Zap, label: 'Messages', value: profile.messages, color: 'var(--secondary)' },
            { icon: Clock, label: 'Last Active', value: lastActive.split(',')[0], color: 'var(--success)' },
          ].map(stat => (
            <div key={stat.label} className="clay-card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="clay-avatar clay-avatar-sm" style={{ 
                background: `${stat.color}15`, margin: '0 auto 10px',
              }}>
                <stat.icon size={16} color={stat.color} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="clay-card-inset" style={{ display: 'flex', gap: '4px', padding: '4px', marginBottom: '24px' }}>
          {[
            { id: 'overview' as const, label: 'Overview', icon: User },
            { id: 'activity' as const, label: 'Activity', icon: TrendingUp },
            { id: 'settings' as const, label: 'Settings', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`clay-tab ${activeTab === tab.id ? 'active' : ''}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', fontSize: '12px' }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Info Cards */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--primary)" /> Account Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { icon: Mail, label: 'Email', value: email },
                  { icon: Calendar, label: 'Joined', value: createdAt },
                  { icon: Globe, label: 'Server', value: config.API_BASE },
                  { icon: Key, label: 'User ID', value: user.id },
                ].map(item => (
                  <div key={item.label} className="clay-card-inset" style={{ 
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                  }}>
                    <div className="clay-avatar clay-avatar-sm" style={{ background: 'hsla(var(--primary-hue), 85%, 65%, 0.1)', flexShrink: 0 }}>
                      <item.icon size={14} color="var(--primary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="var(--secondary)" /> Your Capabilities
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Multi-Agent Chat', desc: 'Orchestrate AI agents' },
                  { label: 'Skill Workshop', desc: 'Create & run skills' },
                  { label: 'Vision Analysis', desc: 'Multi-modal AI' },
                  { label: 'Voice Interaction', desc: 'Talk with agents' },
                  { label: 'Knowledge Graph', desc: 'Build & query' },
                  { label: 'Safe Vault', desc: 'Encrypted secrets' },
                ].map(cap => (
                  <div key={cap.label} className="clay-card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0, boxShadow: '0 0 8px rgba(16,185,129,0.4)' }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{cap.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cap.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="var(--primary)" /> Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { time: '2 min ago', action: 'Opened Chat session', type: 'chat' },
                { time: '15 min ago', action: 'Modified model configuration', type: 'settings' },
                { time: '1 hour ago', action: 'Executed Skill: web-search', type: 'skill' },
                { time: '3 hours ago', action: 'Connected to backend server', type: 'system' },
                { time: 'Today', action: 'Signed in via email', type: 'auth' },
              ].map((event, i) => (
                <div key={i} className="clay-card-inset" style={{ 
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                }}>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: event.type === 'chat' ? 'var(--primary)' : 
                               event.type === 'skill' ? 'var(--secondary)' :
                               event.type === 'system' ? 'var(--success)' : 'var(--text-muted)',
                    boxShadow: `0 0 8px ${event.type === 'chat' ? 'var(--primary-glow)' : 'rgba(0,0,0,0.2)'}`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{event.action}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{event.time}</div>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Moon size={16} color="var(--primary)" /> Appearance
              </h3>
              <div className="clay-card-inset" style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {theme === 'light' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Theme Mode</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{theme === 'light' ? 'Light mode active' : 'Dark mode active'}</div>
                  </div>
                </div>
                <button onClick={handleThemeToggle} className={`clay-toggle ${theme === 'dark' ? 'active' : ''}`} />
              </div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={16} color="var(--warning)" /> Notifications
              </h3>
              <div className="clay-card-inset" style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Bell size={18} color="var(--warning)" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Agent Alerts</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Get notified when tasks complete</div>
                  </div>
                </div>
                <div className="clay-toggle active" />
              </div>
            </div>
          </div>
        )}

        {/* ── Sign Out ── */}
        <div style={{ marginTop: '32px', paddingBottom: '32px' }}>
          <button onClick={logout} className="clay-btn" style={{ 
            width: '100%', padding: '14px 24px', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            color: 'var(--danger)',
          }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
