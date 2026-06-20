import { Router } from 'express';
import { getSupabase } from './db/config';

const router = Router();

// Helper: use service-role client for admin operations
function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  return client;
}

// ─── User Tools ──────────────────────────────────────────────────────

router.get('/tools', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { data, error } = await sb().from('user_tools').select('*').eq('user_id', userId);
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/tools', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { tool_name, tool_version, config } = req.body;
    if (!tool_name) return res.status(400).json({ error: 'Missing tool_name' });
    const { data, error } = await sb().from('user_tools').insert({
      user_id: userId, tool_name, tool_version: tool_version || '1.0', config: config || {},
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/tools/:id', async (req, res) => {
  try {
    const { error } = await sb().from('user_tools').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── User Devices ────────────────────────────────────────────────────

router.get('/devices', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { data, error } = await sb().from('user_devices').select('*').eq('user_id', userId);
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/devices', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { device_name, platform, os_version, browser } = req.body;
    if (!device_name) return res.status(400).json({ error: 'Missing device_name' });
    const { data, error } = await sb().from('user_devices').upsert({
      user_id: userId, device_name, platform: platform || 'unknown',
      os_version: os_version || '', browser: browser || '',
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id,device_name' }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── MCP Configs ─────────────────────────────────────────────────────

router.get('/mcp', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { data, error } = await sb().from('user_mcp_configs').select('*').eq('user_id', userId);
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/mcp', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { config_name, config } = req.body;
    if (!config_name) return res.status(400).json({ error: 'Missing config_name' });
    const { data, error } = await sb().from('user_mcp_configs').insert({
      user_id: userId, config_name, config: config || {},
    }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/mcp/:id', async (req, res) => {
  try {
    const { error } = await sb().from('user_mcp_configs').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── User Preferences ────────────────────────────────────────────────

router.get('/preferences', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { data, error } = await sb().from('user_preferences').select('*').eq('user_id', userId);
    if (error) throw error;
    const map: Record<string, any> = {};
    for (const row of data || []) map[row.pref_key] = row.pref_value;
    res.json(map);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/preferences', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { pref_key, pref_value } = req.body;
    if (!pref_key) return res.status(400).json({ error: 'Missing pref_key' });
    const { data, error } = await sb().from('user_preferences').upsert({
      user_id: userId, pref_key, pref_value: pref_value || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,pref_key' }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
export const syncRouter = router;
