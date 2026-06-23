import { useState, useEffect, useCallback } from 'react';
import { Download, Search, Package, Filter, ExternalLink, Trash2, Loader, Globe } from 'lucide-react';
import { api } from '../api';

interface MarketplaceItem {
  name: string;
  description: string;
  version: string;
  publisher: string;
  score: number;
}

interface SkillfishItem {
  name: string;
  slug: string;
  owner: string;
  github: string;
  url: string;
  description: string;
  stars: number;
}

interface SkillsMPItem {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl: string;
  skillUrl: string;
  stars: number;
}

interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
}

type Source = 'npm' | 'skillfish' | 'skillsmp';

export default function Marketplace() {
  const [npmResults, setNpmResults] = useState<MarketplaceItem[]>([]);
  const [skillfishResults, setSkillfishResults] = useState<SkillfishItem[]>([]);
  const [skillsmpResults, setSkillsmpResults] = useState<SkillsMPItem[]>([]);
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [search, setSearch] = useState('zuvix');
  const [filterLocal, setFilterLocal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [source, setSource] = useState<Source>('npm');

  useEffect(() => {
    loadInstalled();
    searchNpm('zuvix');
  }, []);

  async function loadInstalled() {
    try {
      const res = await api('/marketplace/installed');
      setInstalled(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function searchNpm(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api(`/marketplace/search?q=${encodeURIComponent(query)}`);
      setNpmResults(res.results || []);
    } catch { setNpmResults([]); }
    setLoading(false);
  }

  async function searchSkillfish(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api(`/skillfish/search?q=${encodeURIComponent(query)}`);
      setSkillfishResults(res.results || []);
    } catch { setSkillfishResults([]); }
    setLoading(false);
  }

  async function searchSkillsmp(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api(`/skillsmp/search?q=${encodeURIComponent(query)}`);
      setSkillsmpResults(res.results || []);
    } catch { setSkillsmpResults([]); }
    setLoading(false);
  }

  const doSearch = useCallback(() => {
    if (filterLocal) return;
    if (source === 'npm') searchNpm(search);
    else if (source === 'skillfish') searchSkillfish(search);
    else searchSkillsmp(search);
  }, [search, filterLocal, source]);

  async function install(name: string) {
    setInstalling(name);
    try {
      await api('/marketplace/install', 'POST', { packageName: name });
      await loadInstalled();
    } catch {}
    setInstalling(null);
  }

  async function installSkillfish(githubPath: string, name: string) {
    setInstalling(name);
    try {
      await api('/skillfish/install', 'POST', { githubPath });
    } catch {}
    setInstalling(null);
  }

  async function uninstall(skillId: string) {
    try {
      await api('/marketplace/uninstall', 'POST', { skillId });
      await loadInstalled();
    } catch {}
  }

  const items = filterLocal ? [] : (source === 'npm' ? npmResults : source === 'skillfish' ? skillfishResults : skillsmpResults);

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Package size={18} /> Skill Marketplace
      </h2>

      {/* Source toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setSource('npm'); if (!filterLocal) searchNpm(search); }} style={{
          padding: '6px 14px', borderRadius: 8, border: `1px solid ${source === 'npm' ? '#3b82f6' : 'var(--card-border)'}`,
          background: source === 'npm' ? 'rgba(59,130,246,0.15)' : 'transparent',
          color: source === 'npm' ? '#60a5fa' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          npm Registry
        </button>
        <button onClick={() => { setSource('skillfish'); if (!filterLocal) searchSkillfish(search); }} style={{
          padding: '6px 14px', borderRadius: 8, border: `1px solid ${source === 'skillfish' ? '#a855f7' : 'var(--card-border)'}`,
          background: source === 'skillfish' ? 'rgba(168,85,247,0.15)' : 'transparent',
          color: source === 'skillfish' ? '#c084fc' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Globe size={14} /> MCP Market
        </button>
        <button onClick={() => { setSource('skillsmp'); if (!filterLocal) searchSkillsmp(search); }} style={{
          padding: '6px 14px', borderRadius: 8, border: `1px solid ${source === 'skillsmp' ? '#f59e0b' : 'var(--card-border)'}`,
          background: source === 'skillsmp' ? 'rgba(245,158,11,0.15)' : 'transparent',
          color: source === 'skillsmp' ? '#fbbf24' : '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Globe size={14} /> SkillsMP
        </button>
      </div>

      {/* Search */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: '#888' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder={source === 'npm' ? "Search npm for skills..." : "Search MCP Market for skills..."}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--card-border)',
                background: 'rgba(0,0,0,0.2)', color: '#e2e8f0', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <button onClick={doSearch} disabled={loading} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {loading ? <Loader size={14} /> : 'Search'}
          </button>
          <button onClick={() => setFilterLocal(!filterLocal)} style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${filterLocal ? '#10b981' : 'var(--card-border)'}`,
            background: filterLocal ? 'rgba(16,185,129,0.1)' : 'transparent',
            color: filterLocal ? '#10b981' : '#888', fontSize: 12, cursor: 'pointer',
          }}>
            <Filter size={14} /> Installed
          </button>
        </div>
      </div>

      {/* NPM Results */}
      {!filterLocal && source === 'npm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
              Search npm for skills or try "zuvix", "agent", "ai-tools"
            </div>
          )}
          {items.map((pkg: any, i) => {
            const isInstalled = installed.some(s => s.id === `npm:${pkg.name}`);
            const isInstalling = installing === pkg.name;
            return (
              <div key={i} style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 10, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                      {pkg.name}
                      {isInstalled && <span style={{ color: '#10b981', fontSize: 10, marginLeft: 6 }}>✓ Installed</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{pkg.description}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>
                      v{pkg.version} · by {pkg.publisher} · score: {(pkg.score * 100).toFixed(0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {isInstalled ? (
                      <button onClick={() => uninstall(`npm:${pkg.name}`)} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444', fontSize: 11, cursor: 'pointer',
                      }}>
                        <Trash2 size={12} /> Uninstall
                      </button>
                    ) : (
                      <button onClick={() => install(pkg.name)} disabled={isInstalling} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
                        border: 'none', background: '#3b82f6', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>
                        {isInstalling ? <Loader size={12} /> : <Download size={12} />}
                        {isInstalling ? 'Installing' : 'Install'}
                      </button>
                    )}
                    <a href={`https://npmjs.com/package/${pkg.name}`} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--card-border)', color: '#888', fontSize: 11, textDecoration: 'none',
                    }}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skillfish / MCP Market Results */}
      {!filterLocal && source === 'skillfish' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
              Search MCP Market for skills from skill.fish
            </div>
          )}
          {items.map((skill: any, i) => {
            const isInstalling = installing === skill.name;
            return (
              <div key={i} style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 10, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                      {skill.name}
                      <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 6 }}>★ {skill.stars}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{skill.description}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>
                      by {skill.owner} · {skill.github}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button onClick={() => installSkillfish(skill.github, skill.name)} disabled={isInstalling} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
                      border: 'none', background: '#a855f7', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {isInstalling ? <Loader size={12} /> : <Download size={12} />}
                      {isInstalling ? 'Adding' : 'Add Skill'}
                    </button>
                    <a href={skill.url} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--card-border)', color: '#888', fontSize: 11, textDecoration: 'none',
                    }}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SkillsMP Results */}
      {!filterLocal && source === 'skillsmp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.length === 0 && !loading && (
            <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>
              Search 1.7M+ agent skills from skillsmp.com
            </div>
          )}
          {items.map((skill: any, i) => (
            <div key={i} style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                    {skill.name}
                    <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 6 }}>★ {skill.stars}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{skill.description}</div>
                  <div style={{ fontSize: 10, color: '#555' }}>
                    by {skill.author} · {skill.id}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <a href={skill.githubUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
                    border: 'none', background: '#f59e0b', color: '#1a1a1a', fontSize: 11, fontWeight: 600,
                    textDecoration: 'none',
                  }}>
                    <ExternalLink size={12} /> View on GitHub
                  </a>
                  <a href={skill.skillUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 6,
                    border: '1px solid var(--card-border)', color: '#888', fontSize: 11, textDecoration: 'none',
                  }}>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Installed skills */}
      {filterLocal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {installed.length === 0 && (
            <div style={{ textAlign: 'center', color: '#666', padding: 24, fontSize: 13 }}>No skills installed from marketplace.</div>
          )}
          {installed.map(skill => (
            <div key={skill.id} style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{skill.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{skill.description}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{skill.id}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => uninstall(skill.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6,
                    border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                    color: '#ef4444', fontSize: 11, cursor: 'pointer',
                  }}>
                    <Trash2 size={12} /> Uninstall
                  </button>
                </div>
              </div>
              {skill.dependencies.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {skill.dependencies.map(dep => (
                    <span key={dep} style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.04)', color: '#666',
                    }}>{dep}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
