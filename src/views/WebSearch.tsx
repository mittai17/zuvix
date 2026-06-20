/* src/views/WebSearch.tsx — Multi-provider web search */
import React, { useState, useEffect } from 'react';
import { Search, Globe, ExternalLink, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { config } from '../config';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ProviderInfo {
  name: string;
  available: boolean;
}

export const WebSearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('duckduckgo');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showProviders, setShowProviders] = useState(false);

  useEffect(() => {
    fetch(`${config.API_BASE}/api/search/providers`)
      .then(r => r.json())
      .then(d => setProviders(d.providers))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${config.API_BASE}/api/search?q=${encodeURIComponent(query)}&provider=${selectedProvider}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    } catch { /* offline */ }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const availableProviders = providers.filter(p => p.available);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Web Search</h1>
        <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
          Multi-provider search. DuckDuckGo (no key), Brave, or self-hosted SearXNG.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#888' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search the web..."
            className="glass-input"
            style={{ width: '100%', padding: '14px 16px 14px 48px', fontSize: '15px' }}
          />
        </div>
        <button onClick={handleSearch} disabled={loading || !query.trim()} className="glass-btn glass-btn-primary" style={{ padding: '14px 24px', background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#60a5fa' }}>
          {loading ? <Loader size={18} className="connecting-line" /> : <Search size={18} />}
        </button>
      </div>

      {/* Provider Selector */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowProviders(!showProviders)} className="glass-btn" style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Globe size={14} /> {selectedProvider} {showProviders ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showProviders && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px', zIndex: 10, minWidth: '160px' }}>
            {availableProviders.map(p => (
              <button key={p.name} onClick={() => { setSelectedProvider(p.name); setShowProviders(false); }}
                style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', background: selectedProvider === p.name ? 'rgba(59,130,246,0.1)' : 'transparent', border: 'none', borderRadius: '4px', color: selectedProvider === p.name ? '#fff' : '#888', cursor: 'pointer', fontSize: '12px' }}>
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!searched && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
            <Globe size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>Search the web using your preferred provider.</p>
          </div>
        )}
        {searched && !loading && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>
            <p>No results found.</p>
          </div>
        )}
        {results.map((r, i) => (
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
            style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'border 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--card-border)'}>
            <div style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.title} <ExternalLink size={11} />
            </div>
            <div style={{ fontSize: '11px', color: '#888', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{r.snippet}</div>
          </a>
        ))}
      </div>
    </div>
  );
};
export default WebSearchView;
