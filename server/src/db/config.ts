/* server/src/db/config.ts */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Databases } from 'node-appwrite';
import * as fs from 'fs';
import * as path from 'path';

export interface DbCredentials {
  supabase: { url: string; anonKey: string; serviceRoleKey: string };
  appwrite: { endpoint: string; projectId: string; apiKey: string };
}

const CONFIG_PATH = path.join(__dirname, '../../.db-config.json');

let supabaseClient: SupabaseClient | null = null;
let appwriteClient: Databases | null = null;
let currentCredentials: DbCredentials | null = null;

function loadFromFile(): DbCredentials | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return null;
}

export function saveCredentials(creds: DbCredentials): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(creds, null, 2), 'utf8');
  currentCredentials = creds;
  reconnectClients(creds);
}

export function getCredentials(): DbCredentials | null {
  if (currentCredentials) return currentCredentials;
  const fromFile = loadFromFile();
  if (fromFile) {
    currentCredentials = fromFile;
    return fromFile;
  }
  // Fall back to env vars
  const env: DbCredentials = {
    supabase: {
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    appwrite: {
      endpoint: process.env.APPWRITE_ENDPOINT || '',
      projectId: process.env.APPWRITE_PROJECT_ID || '',
      apiKey: process.env.APPWRITE_API_KEY || '',
    },
  };
  if (env.supabase.url && (env.supabase.anonKey || env.supabase.serviceRoleKey)) {
    currentCredentials = env;
  }
  return currentCredentials;
}

function reconnectClients(creds: DbCredentials): void {
  supabaseClient = null;
  appwriteClient = null;

  if (creds.supabase.url && creds.supabase.serviceRoleKey) {
    supabaseClient = createClient(creds.supabase.url, creds.supabase.serviceRoleKey);
    console.log('[DB] Supabase client reconnected');
  } else if (creds.supabase.url && creds.supabase.anonKey) {
    supabaseClient = createClient(creds.supabase.url, creds.supabase.anonKey);
    console.log('[DB] Supabase client reconnected (anon key)');
  }

  if (creds.appwrite.endpoint && creds.appwrite.projectId && creds.appwrite.apiKey) {
    const client = new Client();
    client.setEndpoint(creds.appwrite.endpoint);
    client.setProject(creds.appwrite.projectId);
    client.setKey(creds.appwrite.apiKey);
    appwriteClient = new Databases(client);
    console.log('[DB] Appwrite client reconnected');
  }
}

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  const creds = getCredentials();
  if (!creds) return null;
  reconnectClients(creds);
  return supabaseClient;
}

export function getAppwrite(): Databases | null {
  if (appwriteClient) return appwriteClient;
  const creds = getCredentials();
  if (!creds) return null;
  reconnectClients(creds);
  return appwriteClient;
}

export async function testSupabaseConnection(creds: { url: string; key: string }): Promise<boolean> {
  try {
    const client = createClient(creds.url, creds.key);
    await client.from('agent_memory').select('id', { count: 'exact', head: true }).limit(1);
    return true;
  } catch {
    return false;
  }
}

export async function testAppwriteConnection(creds: { endpoint: string; projectId: string; apiKey: string }): Promise<boolean> {
  try {
    const client = new Client();
    client.setEndpoint(creds.endpoint);
    client.setProject(creds.projectId);
    client.setKey(creds.apiKey);
    const db = new Databases(client);
    await db.listDocuments('zuvixdb', 'tasks');
    return true;
  } catch {
    return false;
  }
}

// Initialize on load
getCredentials();
