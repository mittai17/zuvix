/* src/config.ts */
const defaults = {
  API_BASE: 'http://localhost:3001',
  WS_URL: 'ws://localhost:3001/ws',
  WS_MESH_URL: 'ws://localhost:3001/ws/mesh',
  SUPABASE_URL: 'https://hvhckfiusmkajhqlvsdn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Qjj-zWXUjkiPzw8XTiEjUA_SeLcCAXH',
  APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1',
  APPWRITE_PROJECT_ID: 'zuvixos',
}

export const config = {
  get API_BASE() { return import.meta.env.VITE_API_BASE || defaults.API_BASE },
  get WS_URL() { return import.meta.env.VITE_WS_URL || defaults.WS_URL },
  get WS_MESH_URL() { return import.meta.env.VITE_WS_MESH_URL || defaults.WS_MESH_URL },
  get APP_NAME() { return 'Zuvix' },
  get SUPABASE_URL() { return import.meta.env.VITE_SUPABASE_URL || defaults.SUPABASE_URL },
  get SUPABASE_ANON_KEY() { return import.meta.env.VITE_SUPABASE_ANON_KEY || defaults.SUPABASE_ANON_KEY },
  get APPWRITE_ENDPOINT() { return import.meta.env.VITE_APPWRITE_ENDPOINT || defaults.APPWRITE_ENDPOINT },
  get APPWRITE_PROJECT_ID() { return import.meta.env.VITE_APPWRITE_PROJECT_ID || defaults.APPWRITE_PROJECT_ID },
}
