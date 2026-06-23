import { useState, useEffect } from 'react';
import AgentOS from './views/AgentOS';
import Chat from './views/Chat';
import Settings from './views/Settings';
import MemorySync from './views/MemorySync';
import SkillWorkshop from './views/SkillWorkshop';
import RemoteDevices from './views/RemoteDevices';
import MissionControl from './views/MissionControl';
import SafeVault from './views/SafeVault';
import Canvas from './views/Canvas';
import Marketplace from './views/Marketplace';
import WebSearchView from './views/WebSearch';
import CronScheduler from './views/CronScheduler';
import SecurityAgent from './views/SecurityAgent';
import KnowledgeGraphView from './views/KnowledgeGraph';
import TalkMode from './views/TalkMode';
import SelfImprove from './views/SelfImprove';
import ApiKeys from './views/ApiKeys';
import BrowserView from './views/BrowserView';
import Workspaces from './views/Workspaces';
import CEOView from './views/CEOView';
import VisionView from './views/VisionView';
import NotificationsView from './views/NotificationsView';
import GitView from './views/GitView';
import Profile from './views/Profile';
import TelemetryDashboard from './views/TelemetryDashboard';
import FloatingOrb from './components/FloatingOrb';
import { VoiceProvider } from './hooks/useVoice';
import { WakeWordProvider, useWakeWord } from './hooks/useWakeWord';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './views/Login';
import { Cpu, Settings as SettingsIcon, MessageSquare, Terminal, Globe, Menu, LayoutDashboard, Monitor, Wrench, Headphones, GitBranch, History, User, PanelLeftClose, PanelLeft, type LucideIcon } from 'lucide-react';
import { config } from './config';

type ViewId = 'chat' | 'agent-os' | 'mission-control' | 'remote-devices' | 'settings' | 'memory' | 'skills' | 'vault' | 'canvas' | 'marketplace' | 'websearch' | 'cron' | 'security-agent' | 'knowledge-graph' | 'talk' | 'self-improve' | 'api-keys' | 'agents-hub' | 'devices-hub' | 'tools-hub' | 'admin-hub' | 'browser' | 'workspaces' | 'ceo' | 'vision' | 'notifications' | 'git' | 'profile' | 'telemetry';

interface SubView { id: ViewId; label: string; icon: LucideIcon; desc: string; }

const CATEGORIES: { id: ViewId; label: string; icon: LucideIcon; direct?: ViewId; subs: SubView[] }[] = [
  { id: 'mission-control', label: 'Dashboard', icon: LayoutDashboard, subs: [] },
  { id: 'chat', label: 'Chat', icon: MessageSquare, direct: 'chat', subs: [
    { id: 'talk', label: 'Talk Mode', icon: Headphones, desc: 'Voice I/O with TTS/STT' },
    { id: 'websearch', label: 'Web Search', icon: Monitor, desc: 'Multi-provider search' },
  ]},
  { id: 'agents-hub', label: 'Agents', icon: Terminal, subs: [
    { id: 'agent-os', label: 'Agent World', icon: Terminal, desc: 'Topology & connections' },
    { id: 'skills', label: 'Skill Workshop', icon: Wrench, desc: 'Create & run skills' },
    { id: 'ceo', label: 'CEO Orchestrator', icon: Terminal, desc: 'Goal decomposition & delegation' },
    { id: 'knowledge-graph', label: 'Knowledge Graph', icon: Cpu, desc: 'Memory connections' },
    { id: 'self-improve', label: 'Self-Improve', icon: Cpu, desc: 'Pattern learning & feedback' },
  ]},
  { id: 'devices-hub', label: 'Devices', icon: Globe, subs: [
    { id: 'remote-devices', label: 'Remote Devices', icon: Globe, desc: 'Mesh network management' },
    { id: 'security-agent', label: 'Security Agent', icon: SettingsIcon, desc: 'Cross-platform OS agent' },
  ]},
  { id: 'tools-hub', label: 'Tools', icon: Wrench, subs: [
    { id: 'canvas', label: 'Canvas', icon: Monitor, desc: 'Agent-rendered visual surface' },
    { id: 'browser', label: 'Browser', icon: Globe, desc: 'Headless browser automation' },
    { id: 'vision', label: 'Vision', icon: Monitor, desc: 'Multi-modal image analysis' },
    { id: 'git', label: 'Git', icon: GitBranch, desc: 'Clone, commit, push, PRs' },
    { id: 'cron', label: 'Cron Scheduler', icon: Cpu, desc: 'Recurring task scheduler' },
    { id: 'marketplace', label: 'Marketplace', icon: Globe, desc: 'Plugin & skill browser' },
  ]},
  { id: 'admin-hub', label: 'Admin', icon: SettingsIcon, subs: [
    { id: 'settings', label: 'Model Settings', icon: SettingsIcon, desc: 'Configuration' },
    { id: 'notifications', label: 'Notifications', icon: SettingsIcon, desc: 'Alerts, email, webhooks' },
    { id: 'workspaces', label: 'Workspaces', icon: SettingsIcon, desc: 'Multi-agent routing & isolation' },
    { id: 'api-keys', label: 'API Keys', icon: SettingsIcon, desc: 'Generate & manage keys' },
    { id: 'telemetry', label: 'System Logs & Cloud', icon: History, desc: 'View stored system metrics & logs' },
    { id: 'memory', label: 'Memory & Deps', icon: Cpu, desc: 'Supabase/Appwrite DB' },
    { id: 'vault', label: 'Safe Vault', icon: Globe, desc: 'Encrypted secrets' },
  ]},
];

// Bottom tab mapping (5 main tabs for mobile)
const BOTTOM_TABS = [
  { id: 'mission-control' as ViewId, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'chat' as ViewId, icon: MessageSquare, label: 'Chat' },
  { id: 'agents-hub' as ViewId, icon: Terminal, label: 'Agents' },
  { id: 'tools-hub' as ViewId, icon: Wrench, label: 'Tools' },
  { id: 'admin-hub' as ViewId, icon: SettingsIcon, label: 'Admin' },
];

function App() {
  return (
    <AuthProvider>
      <WakeWordProvider>
        <AppContent />
      </WakeWordProvider>
    </AuthProvider>
  );
}

import ZuvixFace, { type ZuvixFaceState } from './components/ZuvixFace';

function AppContent() {
  const { user, loading } = useAuth();
  const { startBackgroundListening } = useWakeWord();

  const [emotion, setEmotion] = useState<ZuvixFaceState>('idle');

  // One-time theme migration to ensure light/pink theme is active on load
  useEffect(() => {
    if (!localStorage.getItem('zuvix_theme_migrated_v2')) {
      localStorage.setItem('zuvix_theme', 'light');
      localStorage.setItem('zuvix_theme_migrated_v2', 'true');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
    } else {
      const stored = localStorage.getItem('zuvix_theme') || 'light';
      document.documentElement.setAttribute('data-theme', stored);
      document.documentElement.style.colorScheme = stored === 'dark' ? 'dark' : 'light';
    }
  }, []);

  useEffect(() => {
    const handleEmotion = (e: Event) => {
      const customEvent = e as CustomEvent<ZuvixFaceState>;
      setEmotion(customEvent.detail);
      
      // Auto-revert back to idle after 3 seconds for success/error
      if (customEvent.detail === 'success' || customEvent.detail === 'error') {
        setTimeout(() => setEmotion('idle'), 3000);
      }
    };
    window.addEventListener('zuvix-emotion', handleEmotion);
    return () => window.removeEventListener('zuvix-emotion', handleEmotion);
  }, []);

  useEffect(() => {
    if (user && !loading) {
      startBackgroundListening();
    }
  }, [user, loading, startBackgroundListening]);

  const [activeView, setActiveView] = useState<ViewId>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#888' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Cpu size={18} color="#60a5fa" />
          </div>
          <div style={{ fontSize: 13 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const navigateTo = (id: ViewId) => {
    const cat = CATEGORIES.find(c => c.id === id);
    if (cat?.direct) { setActiveView(cat.direct); }
    else { setActiveView(id); }
    setMobileMenuOpen(false);
  };

  const handleBottomTab = (id: ViewId) => {
    const cat = CATEGORIES.find(c => c.id === id);
    if (cat && cat.subs.length > 0 && !cat.direct) {
      // Open hub view
      setActiveView(id);
    } else if (cat?.direct) {
      setActiveView(cat.direct);
    } else {
      setActiveView(id);
    }
  };

  const renderSubView = (id: ViewId) => {
    switch (id) {
      case 'agent-os': return <AgentOS />;
      case 'chat': return <Chat />;
      case 'mission-control': return <MissionControl />;
      case 'remote-devices': return <RemoteDevices />;
      case 'settings': return <Settings />;
      case 'vault': return <SafeVault />;
      case 'canvas': return <Canvas />;
      case 'marketplace': return <Marketplace />;
      case 'websearch': return <WebSearchView />;
      case 'cron': return <CronScheduler />;
      case 'security-agent': return <SecurityAgent />;
      case 'knowledge-graph': return <KnowledgeGraphView />;
      case 'self-improve': return <SelfImprove />;
      case 'api-keys': return <ApiKeys />;
      case 'talk': return <TalkMode />;
      case 'memory': return <MemorySync />;
      case 'skills': return <SkillWorkshop />;
      case 'browser': return <BrowserView />;
      case 'workspaces': return <Workspaces />;
      case 'ceo': return <CEOView />;
      case 'vision': return <VisionView />;
      case 'notifications': return <NotificationsView />;
      case 'git': return <GitView />;
      case 'profile': return <Profile />;
      case 'telemetry': return <TelemetryDashboard />;
      default: return null;
    }
  };

  const renderView = () => {
    const sub = renderSubView(activeView);
    if (sub) return sub;

    const cat = CATEGORIES.find(c => c.id === activeView);
    if (!cat || cat.subs.length === 0) return <Chat />;
    const directView = renderSubView(cat.id);
    if (directView) return directView;

    const directSub = cat.subs.find(s => s.id === activeView);
    if (directSub) return renderSubView(directSub.id);

    return (
      <div className="responsive-padding" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 700 }}>{cat.label}</h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Select a module to open</p>
        </div>
        <div className="hub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(160px, 30vw, 220px), 1fr))', gap: 'clamp(8px, 2vw, 12px)' }}>
          {cat.subs.map(sub => (
            <button key={sub.id} onClick={() => setActiveView(sub.id)}
              className="hub-card"
              style={{
                padding: 'clamp(16px, 3vw, 24px)', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: '12px', cursor: 'pointer', color: 'inherit', textAlign: 'left',
                transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '10px',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--card-border)'}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <sub.icon size={20} style={{ color: '#60a5fa' }} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{sub.label}</div>
              <div style={{ color: '#888', fontSize: '12px', lineHeight: 1.4 }}>{sub.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const activeCategory = CATEGORIES.find(c =>
    c.id === activeView || c.subs.some(s => s.id === activeView)
  ) || CATEGORIES[0];

  const activeTab = BOTTOM_TABS.find(t =>
    t.id === activeCategory?.id || activeCategory?.subs?.some(s => s.id === activeView)
  ) || BOTTOM_TABS[1];

  return (
    <VoiceProvider>
    <div className="app-root" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-sans)', background: 'var(--app-bg)', color: 'var(--text-main)', transition: 'background 0.3s ease, color 0.3s ease' }}>
      {/* Mobile Top Bar */}
      <div className="mobile-top-bar" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))', borderBottom: '1px solid var(--sidebar-border)', backgroundColor: 'var(--sidebar-bg)', zIndex: 45 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={20} color="var(--primary)" />
          <span className="font-zuvix-title" style={{ fontSize: '18px', fontWeight: 800 }}>{config.APP_NAME}</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 4 }}>
          <Menu size={24} />
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mobile overlay */}
        {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

        {/* Desktop Sidebar */}
        <nav className={`desktop-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} style={{ width: isSidebarCollapsed ? '64px' : '200px', height: '100%', padding: '24px 12px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--sidebar-border)', backgroundColor: 'var(--sidebar-bg)', flexShrink: 0, transition: 'width 0.2s ease, background-color 0.3s ease, border-color 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', padding: isSidebarCollapsed ? '0 0 24px' : '0 8px 24px' }}>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,107,129,0.1)', border: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={18} color="var(--primary)" />
                </div>
                <span className="font-zuvix-title" style={{ fontSize: '18px', fontWeight: 900 }}>{config.APP_NAME}</span>
              </div>
            )}
            {isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,107,129,0.1)', border: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={18} color="var(--primary)" />
                </div>
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="glass-btn" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
                  <PanelLeft size={16} />
                </button>
              </div>
            )}
            {!isSidebarCollapsed && (
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="glass-btn" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>

          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', padding: '0 8px 16px' }}>
              <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--card-shadow)' }}>
                <History size={14} /> History
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory.id === cat.id;
              return (
                <button key={cat.id} onClick={() => navigateTo(cat.id)}
                  className="sidebar-btn"
                  title={cat.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                    backgroundColor: isActive ? 'var(--sidebar-bg-active)' : 'transparent',
                    color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.15s',
                  }}>
                  <cat.icon size={isSidebarCollapsed ? 20 : 16} style={{ color: isActive ? 'var(--primary)' : 'inherit' }} />
                  {!isSidebarCollapsed && <span>{cat.label}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: isSidebarCollapsed ? '0' : '0 8px' }}>
             <button title="Profile" onClick={() => navigateTo('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', backgroundColor: activeView === 'profile' ? 'var(--sidebar-bg-active)' : 'transparent', color: activeView === 'profile' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: activeView === 'profile' ? 600 : 500, transition: 'all 0.15s' }}>
                <User size={isSidebarCollapsed ? 20 : 16} style={{ color: activeView === 'profile' ? 'var(--primary)' : 'inherit' }} />
                {!isSidebarCollapsed && <span>Profile</span>}
             </button>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <ErrorBoundary key={activeView}>
            {renderView()}
          </ErrorBoundary>
          <FloatingOrb />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-bottom-nav" style={{
        display: 'none', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 0', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid var(--sidebar-border)', backgroundColor: 'var(--sidebar-bg)', zIndex: 45,
      }}>
        {BOTTOM_TABS.map(tab => {
          const isTabActive = activeTab?.id === tab.id;
          return (
            <button key={tab.id} onClick={() => handleBottomTab(tab.id)}
              className="bottom-tab-btn"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                background: 'none', border: 'none', color: isTabActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                cursor: 'pointer', padding: '4px 8px', fontSize: '9px', fontWeight: isTabActive ? 600 : 400,
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', minWidth: 0,
                transition: 'color 0.15s',
              }}>
              <tab.icon size={20} style={{ opacity: isTabActive ? 1 : 0.5, color: isTabActive ? 'var(--primary)' : 'inherit' }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <ZuvixFace state={emotion} globalRoam={true} />
    </div>
    </VoiceProvider>
  );
}

export default App;
