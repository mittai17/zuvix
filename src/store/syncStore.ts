/* src/store/syncStore.ts */

export interface CloudDependency {
  id: string;
  name: string;
  type: 'mcp' | 'package' | 'env';
  status: 'active' | 'inactive';
  cloudUrl: string;
}

export interface SyncStats {
  localDbSize: string;
  itemsCached: number;
  lastSyncedAt: string;
  syncInProgress: boolean;
  supabaseConfigured: boolean;
}

export const INITIAL_DEPENDENCIES: CloudDependency[] = [
  { id: 'notion-mcp', name: 'Notion Workspace (MCP)', type: 'mcp', status: 'active', cloudUrl: 'https://mcp.notion.so/v1' },
  { id: 'github-mcp', name: 'GitHub Repositories (MCP)', type: 'mcp', status: 'active', cloudUrl: 'https://mcp.github.com/v1' },
  { id: 'gmail-api', name: 'Gmail Auth Token (Env)', type: 'env', status: 'active', cloudUrl: 'Encrypted Cloud Store' },
  { id: 'puppeteer', name: 'Puppeteer Chrome Binaries (Pkg)', type: 'package', status: 'inactive', cloudUrl: 'https://registry.npmjs.org/puppeteer' }
];

export const INITIAL_STATS: SyncStats = {
  localDbSize: '1.4 MB',
  itemsCached: 42,
  lastSyncedAt: '2026-06-19 22:30:00',
  syncInProgress: false,
  supabaseConfigured: false
};
