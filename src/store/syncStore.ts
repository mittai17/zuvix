/* src/store/syncStore.ts */

// Personal Node Web Sync Architecture
// This handles the connection between the Web Client and the Local Laptop Node via Supabase Realtime Channels.

import { supabase } from '../utils/supabase';

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
  personalNodeConnected: boolean; // Tells Web UI if Laptop is online
}

export const INITIAL_DEPENDENCIES: CloudDependency[] = [
  { id: 'notion-mcp', name: 'Notion Workspace (MCP)', type: 'mcp', status: 'active', cloudUrl: 'https://mcp.notion.so/v1' },
  { id: 'github-mcp', name: 'GitHub Repositories (MCP)', type: 'mcp', status: 'active', cloudUrl: 'https://mcp.github.com/v1' },
];

export const INITIAL_STATS: SyncStats = {
  localDbSize: '1.4 MB',
  itemsCached: 42,
  lastSyncedAt: new Date().toISOString(),
  syncInProgress: false,
  supabaseConfigured: true,
  personalNodeConnected: false
};

// Web Sync Hook: Call this when initializing the app.
export function initPersonalNodeSync(userId: string, onMessageReceived: (payload: any) => void) {
  const channel = supabase.channel(`workspace_${userId}`);

  channel
    .on('broadcast', { event: 'node-sync' }, (payload) => {
      console.log('Received payload from Personal Node:', payload);
      onMessageReceived(payload);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Successfully connected to Web Sync Relay.');
      }
    });

  // Function to send command from Web to Laptop
  const sendCommandToNode = async (command: string, args: any) => {
    await channel.send({
      type: 'broadcast',
      event: 'web-command',
      payload: { command, args, timestamp: new Date().toISOString() }
    });
  };

  return { channel, sendCommandToNode };
}

