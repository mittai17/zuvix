import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[DB] Supabase connected successfully (Auth & Edge Functions).');
} else {
  console.warn('[DB] Supabase URL or Key missing.');
}

// Cloudflare D1 Configuration
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CF_D1_DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || '';

/**
 * Log a telemetry event or agent action directly to Cloudflare D1.
 * We use the Cloudflare REST API for zero-latency edge inserts.
 */
export async function logToDatabase(agentId: string, actionType: string, payload: any) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !CF_D1_DB_ID ||
      CF_ACCOUNT_ID.includes('your_') || CF_API_TOKEN.includes('your_') || CF_D1_DB_ID.includes('your_')) {
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DB_ID}/query`;
  
  // Serialize payload to JSON for SQLite
  const payloadStr = JSON.stringify(payload);
  const createdAt = new Date().toISOString();

  const query = {
    sql: `INSERT INTO zuvix_logs (agent_id, action_type, payload, created_at) VALUES (?, ?, ?, ?)`,
    params: [agentId, actionType, payloadStr, createdAt]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });

    const result: any = await response.json();
    if (!result.success) {
      console.error('[DB] Cloudflare D1 Insert Error:', JSON.stringify(result.errors));
    }
  } catch (err) {
    console.error('[DB] Exception inserting log to Cloudflare D1:', err);
  }
}

/**
 * Fetch massive tools index (1000+) from Cloudflare D1 'zuvix_tools' table.
 */
export async function fetchToolsFromDatabase(): Promise<any[]> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !CF_D1_DB_ID) {
    return [];
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DB_ID}/query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: "SELECT * FROM zuvix_tools" })
    });

    const result: any = await response.json();
    if (result.success && result.result?.[0]?.results) {
      return result.result[0].results;
    } else {
      console.error('[DB] Failed to fetch tools from D1:', result.errors);
      return [];
    }
  } catch (err) {
    console.error('[DB] Exception fetching tools from D1:', err);
    return [];
  }
}

