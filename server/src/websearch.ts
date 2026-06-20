/* server/src/websearch.ts — Multi-provider web search tool */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchProvider {
  name: string;
  search: (query: string, count?: number) => Promise<SearchResult[]>;
}

// DuckDuckGo HTML scraper (no API key needed)
const duckduckgo: SearchProvider = {
  name: 'duckduckgo',
  search: async (query: string, count = 5): Promise<SearchResult[]> => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZuvixOS/1.0)' } });
      const html = await res.text();
      const results: SearchResult[] = [];
      const snippetRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetTextRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      let snippetMatch;
      while ((match = snippetRegex.exec(html)) !== null && results.length < count) {
        const snippetMatch = snippetTextRegex.exec(html);
        results.push({
          title: match[2].replace(/<[^>]*>/g, '').trim(),
          url: match[1],
          snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '',
        });
      }
      return results;
    } catch {
      return [];
    }
  },
};

// Brave Search (requires API key from env)
const brave: SearchProvider = {
  name: 'brave',
  search: async (query: string, count = 5): Promise<SearchResult[]> => {
    const key = process.env.BRAVE_API_KEY;
    if (!key) return [];
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
      const data: any = await res.json();
      return (data.web?.results || []).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
      }));
    } catch { return []; }
  },
};

// SearXNG (self-hosted, from env)
const searxng: SearchProvider = {
  name: 'searxng',
  search: async (query: string, count = 5): Promise<SearchResult[]> => {
    const instance = process.env.SEARXNG_URL;
    if (!instance) return [];
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&number_of_results=${count}`;
      const res = await fetch(url);
      const data: any = await res.json();
      return (data.results || []).slice(0, count).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.content || '',
      }));
    } catch { return []; }
  },
};

const providers: Record<string, SearchProvider> = { duckduckgo, brave, searxng };

export async function webSearch(query: string, provider = 'duckduckgo', count = 5): Promise<SearchResult[]> {
  const p = providers[provider] || duckduckgo;
  return p.search(query, count);
}

export function listProviders(): { name: string; available: boolean }[] {
  return Object.values(providers).map(p => ({
    name: p.name,
    available: p.name === 'duckduckgo' ? true :
               p.name === 'brave' ? !!process.env.BRAVE_API_KEY :
               p.name === 'searxng' ? !!process.env.SEARXNG_URL : false,
  }));
}
