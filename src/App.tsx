import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import AgentOS from './views/AgentOS';
import Chat from './views/Chat';
import Settings from './views/Settings';
import MemorySync from './views/MemorySync';
import SkillWorkshop from './views/SkillWorkshop';
import MissionControl from './views/MissionControl';
import SafeVault from './views/SafeVault';
import WebSearchView from './views/WebSearch';
import TalkMode from './views/TalkMode';
import ApiKeys from './views/ApiKeys';
import Workspaces from './views/Workspaces';
import VisionView from './views/VisionView';
import NotificationsView from './views/NotificationsView';
import Profile from './views/Profile';
import TelemetryDashboard from './views/TelemetryDashboard';
import FloatingOrb from './components/FloatingOrb';
import { VoiceProvider } from './hooks/useVoice';
import { WakeWordProvider, useWakeWord } from './hooks/useWakeWord';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './views/Login';
import { Cpu, Settings as SettingsIcon, MessageSquare, Terminal, Globe, Menu, LayoutDashboard, Monitor, Wrench, Headphones, GitBranch, History, User, PanelLeftClose, PanelLeft, ChevronDown, ChevronRight, Plug, type LucideIcon } from 'lucide-react';
import { config } from './config';

type ViewId = 'chat' | 'agent-os' | 'mission-control' | 'settings' | 'memory' | 'skills' | 'vault' | 'websearch' | 'talk' | 'api-keys' | 'agents-hub' | 'tools-hub' | 'admin-hub' | 'workspaces' | 'vision' | 'notifications' | 'profile' | 'telemetry';

interface SubView { id: ViewId; label: string; icon: LucideIcon; desc: string; }

const CATEGORIES: { id: ViewId; label: string; icon: LucideIcon; direct?: ViewId; subs: SubView[] }[] = [
  { id: 'mission-control', label: 'Dashboard', icon: LayoutDashboard, subs: [] },
  { id: 'chat', label: 'Chat', icon: MessageSquare, direct: 'chat', subs: [] },
  { id: 'agents-hub', label: 'Agents', icon: Terminal, subs: [
    { id: 'agent-os', label: 'Agent World', icon: Terminal, desc: 'Topology & connections' },
    { id: 'skills', label: 'Skill Workshop', icon: Wrench, desc: 'Create & run skills' },
  ]},
  { id: 'tools-hub', label: 'Tools', icon: Wrench, subs: [
    { id: 'vision', label: 'Vision', icon: Monitor, desc: 'Multi-modal image analysis' },
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
import { useVoice } from './hooks/useVoice';

function ZuvixFaceOverlay({ globalEmotion }: { globalEmotion: ZuvixFaceState }) {
  const { state: voiceState, transcript, audioLevel, startListening } = useVoice();
  let finalEmotion = globalEmotion;
  if (voiceState === 'listening') finalEmotion = 'listening';
  else if (voiceState === 'processing') finalEmotion = 'processing';
  else if (voiceState === 'speaking') finalEmotion = 'speaking';
  
  useEffect(() => {
    const handleWake = () => {
      startListening();
    };
    window.addEventListener('zuvix-wake', handleWake);
    return () => window.removeEventListener('zuvix-wake', handleWake);
  }, [startListening]);
  
  return (
    <ZuvixFace 
      state={finalEmotion} 
      globalRoam={true} 
      transcript={transcript} 
      response={voiceState === 'speaking' ? "Processing..." : undefined} 
      audioLevel={audioLevel} 
    />
  );
}

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

  useEffect(() => {
    const handleOpenTalk = () => {
      setActiveView('talk');
    };
    window.addEventListener('zuvix-open-talk', handleOpenTalk);
    return () => window.removeEventListener('zuvix-open-talk', handleOpenTalk);
  }, []);

  const [activeView, setActiveView] = useState<ViewId>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [showBgConsent, setShowBgConsent] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['chat']));

  const toggleCat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedCats);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCats(next);
  };

  useEffect(() => {
    if (user && !loading) {
      const consent = localStorage.getItem('zuvix_bg_consent');
      if (!consent) {
        setShowBgConsent(true);
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--app-bg)', color: 'var(--text-sub)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="glass-card" style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Cpu size={24} color="var(--primary)" />
          </div>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
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
      case 'settings': return <Settings />;
      case 'vault': return <SafeVault />;
      case 'websearch': return <WebSearchView />;
      case 'api-keys': return <ApiKeys />;
      case 'talk': return <TalkMode />;
      case 'memory': return <MemorySync />;
      case 'skills': return <SkillWorkshop />;
      case 'workspaces': return <Workspaces />;
      case 'vision': return <VisionView />;
      case 'notifications': return <NotificationsView />;
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
              className="hub-card clay-card"
              style={{
                padding: 'clamp(16px, 3vw, 24px)', background: 'var(--clay-bg)',
                borderRadius: 'var(--border-radius-xl)', cursor: 'pointer', color: 'inherit', textAlign: 'left',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '10px',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                boxShadow: 'var(--clay-shadow)',
                border: 'none',
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
      <div className="mobile-top-bar glass-panel" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))', zIndex: 45 }}>
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
        <nav className={`desktop-sidebar glass-panel ${mobileMenuOpen ? 'mobile-open' : ''}`} style={{
          width: isSidebarCollapsed ? '64px' : '220px',
          height: '100%', padding: isSidebarCollapsed ? '20px 8px' : '20px 10px',
          display: 'flex', flexDirection: 'column',
          borderRight: 'none',
          flexShrink: 0,
          transition: 'width 0.25s ease, background-color 0.3s ease, border-color 0.3s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            padding: isSidebarCollapsed ? '0 0 20px' : '0 6px 20px',
          }}>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'var(--primary-glow)', opacity: 0.8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Cpu size={16} color="var(--primary)" />
                </div>
                <span className="font-zuvix-title" style={{ fontSize: '17px', fontWeight: 800 }}>{config.APP_NAME}</span>
              </div>
            )}
            {isSidebarCollapsed && (
              <div style={{
                width: 30, height: 30, borderRadius: 7,
                background: 'var(--primary-glow)', opacity: 0.8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Cpu size={16} color="var(--primary)" />
              </div>
            )}
            {!isSidebarCollapsed && (
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="glass-btn"
                style={{
                  padding: '4px', background: 'transparent', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px',
                  opacity: 0.5, transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
              >
                <PanelLeftClose size={15} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory.id === cat.id;
              const hasSubs = cat.subs && cat.subs.length > 0;
              const isExpanded = expandedCats.has(cat.id);
              return (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => navigateTo(cat.id)}
                    className="sidebar-btn clay-tab"
                    title={cat.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: isSidebarCollapsed ? '10px 0' : '9px 10px',
                      justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                      backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--sidebar-text)',
                      border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontSize: '13px', fontWeight: isActive ? 600 : 450,
                      transition: 'all 0.15s',
                      boxShadow: isActive ? 'var(--clay-shadow)' : 'none',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-bg-active)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <cat.icon size={isSidebarCollapsed ? 20 : 16}
                      style={{ color: isActive ? 'var(--primary)' : 'inherit', opacity: isActive ? 1 : 0.7 }} />
                    {!isSidebarCollapsed && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span>{cat.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {hasSubs && (
                            <div 
                              onClick={(e) => toggleCat(cat.id, e)}
                              style={{
                                display: 'flex', alignItems: 'center', padding: '3px',
                                borderRadius: '4px', cursor: 'pointer', opacity: 0.5,
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </div>
                          )}
                          {cat.id === 'chat' && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('zuvix-new-session'));
                                navigateTo('chat');
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', padding: '3px',
                                borderRadius: '4px', cursor: 'pointer',
                                color: 'var(--primary)', opacity: 0.7,
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                              title="New Session"
                            >
                              <Plus size={13} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                  
                  {!isSidebarCollapsed && hasSubs && isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingLeft: '28px', marginTop: '1px' }}>
                      {cat.subs.map(sub => {
                        const isSubActive = activeView === sub.id;
                        return (
                          <button key={sub.id} onClick={(e) => { e.stopPropagation(); navigateTo(sub.id); }}
                            className="sidebar-btn"
                            title={sub.label}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                              padding: '6px 10px',
                              backgroundColor: isSubActive ? 'var(--primary)' : 'transparent',
                              color: isSubActive ? '#fff' : 'var(--sidebar-text)',
                              border: 'none', borderRadius: '6px', cursor: 'pointer',
                              textAlign: 'left', fontSize: '12.5px', fontWeight: isSubActive ? 500 : 400,
                              transition: 'all 0.15s',
                              boxShadow: isSubActive ? '0 4px 8px rgba(0,0,0,0.2)' : 'none',
                            }}
                            onMouseEnter={e => { if (!isSubActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-bg-active)'; }}
                            onMouseLeave={e => { if (!isSubActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <sub.icon size={13} style={{ opacity: isSubActive ? 1 : 0.6, color: isSubActive ? 'var(--primary)' : 'inherit' }} />
                            <span>{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 'auto', marginBottom: '80px',
            display: 'flex', flexDirection: 'column', gap: '2px',
            padding: isSidebarCollapsed ? '0' : '0 2px',
            borderTop: '1px solid var(--sidebar-border)',
            paddingTop: '8px',
          }}>
            <button title="Profile" onClick={() => navigateTo('profile')}
              className="sidebar-btn clay-tab"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: isSidebarCollapsed ? '10px 0' : '9px 10px',
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                backgroundColor: activeView === 'profile' ? 'var(--primary)' : 'transparent',
                color: activeView === 'profile' ? '#fff' : 'var(--sidebar-text)',
                border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: '13px', fontWeight: activeView === 'profile' ? 600 : 450,
                transition: 'all 0.15s',
                boxShadow: activeView === 'profile' ? 'var(--clay-shadow)' : 'none',
              }}
              onMouseEnter={e => { if (activeView !== 'profile') e.currentTarget.style.backgroundColor = 'var(--sidebar-bg-active)'; }}
              onMouseLeave={e => { if (activeView !== 'profile') e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <User size={isSidebarCollapsed ? 20 : 16}
                style={{ color: activeView === 'profile' ? 'var(--primary)' : 'inherit', opacity: activeView === 'profile' ? 1 : 0.7 }} />
              {!isSidebarCollapsed && <span>Profile</span>}
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{
          flex: 1, height: '100%', overflow: 'hidden', position: 'relative',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <ErrorBoundary key={activeView}>
            {renderView()}
          </ErrorBoundary>
          <FloatingOrb />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-bottom-nav glass-panel" style={{
        display: 'none', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 0', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        borderTop: 'none', zIndex: 45,
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
      {showBgConsent && (
        <div className="glass-overlay">
          <div className="glass-modal" style={{
            maxWidth: '440px', width: '100%',
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,107,129,0.1)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={20} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Background Execution Consent</h2>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 }}>
              To run autonomous agent loops, execute cron schedules, and process remote commands in the background when the main window is minimized, Zuvix requires background execution permission.
            </p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  localStorage.setItem('zuvix_bg_consent', 'allow');
                  setShowBgConsent(false);
                }}
                className="clay-btn clay-btn-primary"
                style={{ flex: 1, padding: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px' }}
              >
                Allow & Run in Background
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('zuvix_bg_consent', 'deny');
                  setShowBgConsent(false);
                }}
                className="glass-btn"
                style={{ flex: 1, padding: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px' }}
              >
                Frontend Only
              </button>
            </div>
          </div>
        </div>
      )}
      <ZuvixFaceOverlay globalEmotion={emotion} />
    </div>
    </VoiceProvider>
  );
}

export default App;
