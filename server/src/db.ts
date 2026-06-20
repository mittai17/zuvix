import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fallback to empty strings so it doesn't crash if not provided yet.
// Zuvix will log a warning if these are missing.
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[DB] Supabase connected successfully.');
} else {
  console.warn('[DB] Supabase URL or Key missing. Database sync is disabled.');
}

/**
 * Log a telemetry event or agent action to the 'zuvix_logs' table in Postgres.
 */
export async function logToDatabase(agentId: string, actionType: string, payload: any) {
  if (!supabase) return;
  
  try {
    const { error } = await supabase
      .from('zuvix_logs')
      .insert([
        { 
          agent_id: agentId, 
          action_type: actionType, 
          payload: payload,
          created_at: new Date().toISOString()
        }
      ]);
      
    if (error) {
      console.error('[DB] Failed to insert log:', error.message);
    }
  } catch (err) {
    console.error('[DB] Exception inserting log:', err);
  }
}

/**
 * Fetch massive tools index (1000+) from Supabase 'zuvix_tools' table.
 * If Supabase is disabled, returns an empty array.
 */
export async function fetchToolsFromDatabase(): Promise<any[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('zuvix_tools')
      .select('*');
      
    if (error) {
      console.error('[DB] Failed to fetch tools:', error.message);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('[DB] Exception fetching tools:', err);
    return [];
  }
}
