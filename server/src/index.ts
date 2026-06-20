/* server/src/index.ts */
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import { getInstalledSkills, saveSkill, executeSkill } from './skills';
import { AgentKernel, metricsCollector } from './agent';
import * as dotenv from 'dotenv';
import { initTelegramBot, sendTelegramMessage, setMessageHandler } from './gateway/telegram';
import { initDiscordBot, setDiscordHandler, sendDiscordMessage } from './gateway/discord';
import { initScheduler, getScheduledTasks, scheduleTaskFromNL, stopScheduledTask, deleteScheduledTask } from './scheduler';
import { memoryEngine } from './memory/vector';

dotenv.config();

import { vault } from './vault';
import { graphAPI, addMemoryToGraph } from './knowledge-graph';
import { textToSpeech, speechToText, listVoices } from './voice';
import { selfImprove } from './self-improve';
import { apiKeyManager } from './api-keys';
import { ceo } from './ceo';
import { agentRouter } from './router';
import { skillMarketplace } from './marketplace';
import { a2a, A2ACapability } from './a2a';
import { agentBrowser } from './browser';
import { autoBuildGraph, autoBuildAllSessions } from './auto-kg';
import { gitClone, gitCommit, gitPush, gitCreatePR, gitStatus, gitLog } from './git';
import { sandbox } from './sandbox';
import { notifications } from './notifications';
import { vision } from './vision';
import { voiceAgent } from './voice-agent';

// Initialize V6 Modules
const telegramToken = vault.getSecret('TELEGRAM_TOKEN') || process.env.TELEGRAM_TOKEN || 'mock';

// Route gateway messages with workspace isolation
setMessageHandler(async (msg) => {
  console.log(`[Gateway] ${msg.platform} message from ${msg.from}: ${msg.text}`);
  const channel = msg.platform || 'mock';
  const sourceId = msg.channelId || String(msg.chatId || msg.from);
  const userId = msg.from;
  const wsId = await agentRouter.routeMessage(channel, sourceId, userId, msg.text);
  if (msg.platform === 'telegram' && typeof msg.chatId === 'number') {
    sendTelegramMessage(msg.chatId, `*Zuvix* — ${wsId}*\n\n> ${msg.text}\n\n_Workspace-isolated processing…`);
  }
});

setDiscordHandler(async (msg) => {
  console.log(`[Gateway] ${msg.platform} message from ${msg.from}: ${msg.text}`);
  const sourceId = msg.channelId || msg.from;
  const wsId = await agentRouter.routeMessage('discord', sourceId, msg.from, msg.text);
  const reply = `**Zuvix** — ${wsId}\n> ${msg.text}\n\n*Workspace-isolated processing…*`;
  sendDiscordMessage(msg.channelId, reply);
});

initTelegramBot(telegramToken, (msg) => {
  console.log('[Gateway] Fallback handler:', msg.text);
});

const discordToken = vault.getSecret('DISCORD_TOKEN') || process.env.DISCORD_TOKEN || '';
initDiscordBot(discordToken, (msg) => {
  console.log('[Gateway] Discord fallback:', msg.text);
});

initScheduler().catch(err => console.error('[Scheduler] Init error:', err));

// Register A2A handlers for delegation from CEO orchestrator
import { getLLMClient, getModelName, resolveProvider, createChatCompletion } from './llm';
a2a.registerHandler('reason', async (msg) => {
  const llmClient = getLLMClient();
  const model = getModelName();
  const result = await createChatCompletion(llmClient, {
    model,
    messages: [{ role: 'user' as const, content: msg.payload.prompt || msg.payload }],
  }, resolveProvider());
  return result.choices[0]?.message?.content || '';
});
a2a.registerHandler('summarize', async (msg) => {
  const llmClient = getLLMClient();
  const model = getModelName();
  const text = msg.payload.text || msg.payload;
  const result = await createChatCompletion(llmClient, {
    model,
    messages: [
      { role: 'system' as const, content: 'Summarize the following text concisely.' },
      { role: 'user' as const, content: typeof text === 'string' ? text : JSON.stringify(text) },
    ],
  }, resolveProvider());
  return result.choices[0]?.message?.content || '';
});
a2a.registerHandler('search', async (msg) => {
  const query = msg.payload.query || msg.payload;
  return await webSearch(query);
});
a2a.registerHandler('code', async (msg) => {
  const llmClient = getLLMClient();
  const model = getModelName();
  const result = await createChatCompletion(llmClient, {
    model,
    messages: [
      { role: 'system' as const, content: 'Generate code based on the request. Return only the code, no explanation.' },
      { role: 'user' as const, content: msg.payload.prompt || msg.payload },
    ],
  }, resolveProvider());
  return result.choices[0]?.message?.content || '';
});

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// ─── Memory (Vector) API ─────────────────────────────────────────────────────────

app.get('/api/memory/:sessionId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const entries = await memoryEngine.getRecentMemory(req.params.sessionId, limit);
    res.json({ sessionId: req.params.sessionId, entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory/:sessionId/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: 'Missing query param q' });
    const results = await memoryEngine.searchMemory(req.params.sessionId, q);
    res.json({ sessionId: req.params.sessionId, query: q, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory/:sessionId/history', async (req, res) => {
  try {
    const history = await memoryEngine.getHistory(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memory/:sessionId', async (req, res) => {
  try {
    const { text, role } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    await memoryEngine.saveMemory(req.params.sessionId, text, role || 'user');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vault REST endpoints
app.get('/api/vault/keys', (req, res) => {
  try {
    res.json(vault.listSecretNames());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault/keys', (req, res) => {
  try {
    const { keyName, secretValue } = req.body;
    if (!keyName || !secretValue) {
      return res.status(400).json({ error: 'Missing keyName or secretValue' });
    }
    vault.saveSecret(keyName, secretValue);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vault/keys/:id', (req, res) => {
  try {
    const success = vault.deleteSecret(req.params.id);
    if (success) res.json({ success: true });
    else res.status(404).json({ error: 'Key not found' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// REST endpoints
app.get('/api/skills', (req, res) => {
  try {
    const skills = getInstalledSkills();
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NL Cron Scheduler ──────────────────────────────────────────────────────────

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = getScheduledTasks();
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { taskName, schedule, payload } = req.body;
    if (!taskName || !schedule) return res.status(400).json({ error: 'taskName and schedule required' });
    const result = await scheduleTaskFromNL(taskName, schedule, async (p) => {
      console.log(`[Cron] Running "${taskName}" with payload:`, p);
    }, payload);
    if ('error' in result) return res.status(400).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const ok = await deleteScheduledTask(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/stop', async (req, res) => {
  try {
    const ok = await stopScheduledTask(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/skills/:id', (req, res) => {
  try {
    const skills = getInstalledSkills();
    const skill = skills.find(s => s.id === req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/skills/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, code, readme, dependencies } = req.body;
    saveSkill({ id, name, description, code, readme, dependencies });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skills/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const { args = [] } = req.body;
    const result = await executeSkill(id, args);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { triggerHermesLearning } from './hermes';

app.post('/api/learn', async (req, res) => {
  try {
    const { goal, modelConfig } = req.body;
    
    // We send a mock log fn. In a real WS setup, we'd stream this back.
    const logs: string[] = [];
    const logFn = (msg: string) => logs.push(msg);
    
    const newSkill = await triggerHermesLearning(goal, modelConfig, logFn);
    res.json({ success: true, skill: newSkill, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { getDependencies, saveDependency, deleteDependency } from './mcp';

app.get('/api/dependencies', (req, res) => {
  try {
    res.json(getDependencies());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dependencies/:id', (req, res) => {
  try {
    saveDependency(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dependencies/:id', (req, res) => {
  try {
    deleteDependency(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { mcpManager } from './mcp';
import { getCredentials, saveCredentials, testSupabaseConnection, testAppwriteConnection } from './db/config';
import { getCanvasState, applyCanvasAction, registerCanvasClient, streamCanvasHtml, getClientCount } from './canvas';
import { webSearch, listProviders } from './websearch';

// Dynamic DB Configuration
app.get('/api/db/config', (req, res) => {
  try {
    const creds = getCredentials();
    if (!creds) return res.json({ configured: false });
    res.json({
      configured: true,
      supabase: { url: creds.supabase.url, hasKey: !!(creds.supabase.anonKey || creds.supabase.serviceRoleKey) },
      appwrite: { endpoint: creds.appwrite.endpoint, projectId: creds.appwrite.projectId, hasKey: !!creds.appwrite.apiKey },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/db/config', (req, res) => {
  try {
    const { supabase, appwrite } = req.body;
    if (!supabase || !appwrite) return res.status(400).json({ error: 'Missing supabase or appwrite config' });
    saveCredentials({
      supabase: { url: supabase.url, anonKey: supabase.anonKey || '', serviceRoleKey: supabase.serviceRoleKey || '' },
      appwrite: { endpoint: appwrite.endpoint, projectId: appwrite.projectId, apiKey: appwrite.apiKey || '' },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/test-supabase', async (req, res) => {
  try {
    const { url, key } = req.body;
    if (!url || !key) return res.status(400).json({ error: 'Missing url or key' });
    const ok = await testSupabaseConnection({ url, key });
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/test-appwrite', async (req, res) => {
  try {
    const { endpoint, projectId, apiKey } = req.body;
    if (!endpoint || !projectId || !apiKey) return res.status(400).json({ error: 'Missing endpoint, projectId, or apiKey' });
    const ok = await testAppwriteConnection({ endpoint, projectId, apiKey });
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MCP Server management
app.get('/api/mcp/servers', (req, res) => {
  try {
    res.json(mcpManager.getConnectedServers().map(id => ({ id, connected: true })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mcp/connect', async (req, res) => {
  try {
    const { id, command, args } = req.body;
    if (!id || !command) return res.status(400).json({ error: 'Missing id or command' });
    await mcpManager.connectServer({ id, command, args: args || [] });
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mcp/disconnect/:id', (req, res) => {
  try {
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Canvas — agent-rendered HTML surface

// Self-Improvement API
app.get('/api/self-improve/stats', (req, res) => {
  res.json(selfImprove.getStats());
});

app.get('/api/self-improve/records', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(selfImprove.getRecentRecords(limit));
});

app.get('/api/self-improve/patterns', (req, res) => {
  const minRate = parseFloat(req.query.minRate as string) || 0;
  res.json(selfImprove.getPatterns(minRate));
});

app.post('/api/self-improve/feedback', (req, res) => {
  const { recordId, feedback } = req.body;
  if (!recordId || !feedback) return res.status(400).json({ error: 'Missing recordId or feedback' });
  const ok = selfImprove.submitFeedback(recordId, feedback);
  res.json({ success: ok });
});

app.post('/api/self-improve/reset', (req, res) => {
  selfImprove.reset();
  res.json({ success: true });
});

// API Key Management
app.get('/api/keys', (req, res) => {
  res.json(apiKeyManager.getKeys());
});

app.get('/api/keys/:id', (req, res) => {
  const key = apiKeyManager.getKey(req.params.id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json(key);
});

app.post('/api/keys/generate', (req, res) => {
  const { name, scopes, rateLimit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = apiKeyManager.generateKey(name, scopes || ['read', 'write'], rateLimit || 100);
  res.json(result);
});

app.delete('/api/keys/:id', (req, res) => {
  const ok = apiKeyManager.revokeKey(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Key not found' });
  res.json({ success: true });
});

app.get('/api/keys/:id/usage', (req, res) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const key = apiKeyManager.getKey(req.params.id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json(apiKeyManager.getUsage(req.params.id, hours));
});

app.post('/api/keys/validate', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  const result = apiKeyManager.validateKey(key);
  if (!result) return res.status(401).json({ valid: false, error: 'Invalid or revoked key' });
  apiKeyManager.logUsage(result.id, '/api/keys/validate', 200);
  res.json({ valid: true, keyId: result.id, scopes: result.scopes });
});

import * as path from 'path';
import * as fs from 'fs';

app.get('/api/canvas', (req, res) => {
  try {
    res.json(getCanvasState());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/canvas/action', (req, res) => {
  try {
    const action = req.body;
    if (!action || !action.action) return res.status(400).json({ error: 'Missing action' });
    const result = applyCanvasAction(action);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Canvas streaming endpoint — simulate agent streaming HTML content
app.post('/api/canvas/stream', (req, res) => {
  try {
    const { html } = req.body;
    if (!html) return res.status(400).json({ error: 'Missing html content' });
    streamCanvasHtml(html);
    res.json({ success: true, clients: getClientCount() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Canvas client count
app.get('/api/canvas/clients', (req, res) => {
  res.json({ clients: getClientCount() });
});

// Serve canvas content
app.get('/__zuvix__/canvas/index.html', (req, res) => {
  try {
    const htmlPath = path.join(__dirname, '../canvas/index.html');
    if (fs.existsSync(htmlPath)) {
      res.type('html').send(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.type('html').send(getCanvasState().html);
    }
  } catch {
    res.type('html').send(getCanvasState().html);
  }
});

// ─── Knowledge Graph API ───────────────────────────────────────────────────────

app.get('/api/knowledge-graph', (req, res) => {
  res.json(graphAPI.getAll());
});

app.get('/api/knowledge-graph/nodes', (req, res) => {
  res.json(graphAPI.getAll().nodes);
});

app.post('/api/knowledge-graph/nodes', (req, res) => {
  try {
    const { label, type, weight, metadata } = req.body;
    const node = graphAPI.addNode({ label, type: type || 'concept', weight: weight || 1, metadata });
    res.json(node);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/knowledge-graph/nodes/:id', (req, res) => {
  try {
    const updated = graphAPI.updateNode(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Node not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge-graph/nodes/:id', (req, res) => {
  if (graphAPI.deleteNode(req.params.id)) {
    res.json({ deleted: true });
  } else {
    res.status(404).json({ error: 'Node not found' });
  }
});

app.post('/api/knowledge-graph/edges', (req, res) => {
  try {
    const { source, target, label } = req.body;
    if (!source || !target) return res.status(400).json({ error: 'source and target required' });
    const edge = graphAPI.addEdge(source, target, label || 'connected_to');
    if (!edge) return res.status(400).json({ error: 'One or both nodes not found' });
    res.json(edge);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge-graph/edges/:id', (req, res) => {
  if (graphAPI.deleteEdge(req.params.id)) {
    res.json({ deleted: true });
  } else {
    res.status(404).json({ error: 'Edge not found' });
  }
});

app.get('/api/knowledge-graph/nodes/:id/connections', (req, res) => {
  res.json(graphAPI.getConnections(req.params.id));
});

app.post('/api/knowledge-graph/reset', (req, res) => {
  graphAPI.reset();
  res.json({ reset: true });
});

// ─── Talk Mode (Voice I/O) ─────────────────────────────────────────────────────

app.post('/api/voice/tts', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    const audio = await textToSpeech(text, voice);
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/voice/stt', async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) return res.status(400).json({ error: 'Missing audio data' });
    const text = await speechToText(audio, mimeType);
    res.json({ text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/voice/voices', (req, res) => {
  res.json({ voices: listVoices() });
});

app.post('/api/voice/tts-stream', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    const audio = await textToSpeech(text, voice);
    res.json({ audio: audio.toString('base64'), mimeType: 'audio/mpeg', bytes: audio.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Web Search
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const provider = (req.query.provider as string) || 'duckduckgo';
    if (!query) return res.status(400).json({ error: 'Missing query parameter q' });
    const results = await webSearch(query, provider);
    res.json({ results, provider });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search/providers', (req, res) => {
  try {
    res.json({ providers: listProviders() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSockets
const wss = new WebSocketServer({ noServer: true });
const wssMesh = new WebSocketServer({ noServer: true });
const wssCanvas = new WebSocketServer({ noServer: true });

notifications.pushToWebSocket(wss);// Track connected sockets
const clients = new Set<WebSocket>();
const meshDevices = new Map<string, { ws: WebSocket, platform: string, status: string, lastSeen: number, isAlive?: boolean }>();
const deviceResults = new Map<string, { command: string, result: any, error: string | null, timestamp: number }[]>();

// Auto-reconnection & Dead Connection Cleanup
const interval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    if (ws.readyState === 1) ws.ping(); // 1 = OPEN
  });

  wssMesh.clients.forEach((ws: any) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    if (ws.readyState === 1) ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(interval));
wssMesh.on('close', () => clearInterval(interval));

app.get('/api/mesh/devices', (req, res) => {
  const devices = Array.from(meshDevices.entries()).map(([id, data]) => ({
    id,
    platform: data.platform,
    status: data.status,
    lastSeen: data.lastSeen
  }));
  res.json(devices);
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/mesh') {
    wssMesh.handleUpgrade(request, socket, head, (ws) => {
      wssMesh.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/canvas') {
    wssCanvas.handleUpgrade(request, socket, head, (ws) => {
      wssCanvas.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Connect metrics collector to broadcast clients
metricsCollector.setBroadcastClients(clients);

// Seed initial demo agents with metrics for immediate visualization
metricsCollector.registerAgent('kernel', 'Kernel');
metricsCollector.registerAgent('web-search', 'Web Search');
metricsCollector.registerAgent('code-gen', 'Code Gen');
metricsCollector.registerAgent('memory-agent', 'Memory Agent');
metricsCollector.registerAgent('reasoner', 'Reasoner');
metricsCollector.registerAgent('mesh-relay', 'Mesh Relay');

// Periodic metrics broadcast every 2s
const metricsInterval = setInterval(() => {
  metricsCollector.broadcastMetrics();
}, 2000);
wss.on('close', () => clearInterval(metricsInterval));
wssMesh.on('close', () => clearInterval(metricsInterval));

const agentKernel = new AgentKernel(clients);

wssMesh.on('connection', (ws: any) => {
  let deviceId: string | null = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('error', (err: any) => {
    console.error('[Mesh] WebSocket error:', err);
  });

  ws.on('message', (data: any) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'register_device') {
        deviceId = parsed.deviceId;
        meshDevices.set(deviceId!, { ws, platform: parsed.platform, status: 'online', lastSeen: Date.now() });
        console.log(`[Mesh] Device registered: ${deviceId} (${parsed.platform})`);
      } else if (parsed.type === 'heartbeat' && deviceId) {
        const d = meshDevices.get(deviceId);
        if (d) {
          d.lastSeen = Date.now();
          meshDevices.set(deviceId, d);
        }
      } else if (parsed.type === 'command_result' && deviceId) {
        const entries = deviceResults.get(deviceId) || [];
        entries.push({ command: parsed.command, result: parsed.result, error: parsed.error, timestamp: Date.now() });
        if (entries.length > 100) entries.shift(); // Keep last 100
        deviceResults.set(deviceId, entries);
        console.log(`[Agent] Result from ${deviceId}: ${parsed.command}`);
      }
    } catch (e) {
      console.error('[Mesh] Error:', e);
    }
  });

  ws.on('close', () => {
    if (deviceId) {
      meshDevices.delete(deviceId);
      console.log(`[Mesh] Device disconnected: ${deviceId}`);
    }
  });
});

wssCanvas.on('connection', (ws: any) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', (err: any) => console.error('[Canvas WS] Error:', err));
  const unregister = registerCanvasClient(ws);
  ws.on('close', () => { unregister(); });
});

export const sendMeshCommand = (targetDeviceId: string, command: string, args: any) => {
  const device = meshDevices.get(targetDeviceId);
  if (!device) throw new Error(`Device ${targetDeviceId} is not connected to the Mesh.`);
  if (device.ws.readyState !== 1) { // 1 = WebSocket.OPEN
    throw new Error(`Device ${targetDeviceId} WebSocket is not open.`);
  }
  device.ws.send(JSON.stringify({ type: 'execute_command', command, args }), (err) => {
    if (err) console.error(`[Mesh] Failed to send command to ${targetDeviceId}:`, err);
  });
};

app.post('/api/mesh/execute', (req, res) => {
  try {
    const { deviceId, command, args } = req.body;
    sendMeshCommand(deviceId, command, args);
    res.json({ success: true, message: `Dispatched command to ${deviceId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent API ─────────────────────────────────────────────────────────────────

// Agent metrics & mesh events
// ─── CEO Orchestrator API ─────────────────────────────────────────────────────────

app.get('/api/ceo/plans', (req, res) => {
  res.json(ceo.getPlans());
});

app.get('/api/ceo/plans/:id', (req, res) => {
  const plan = ceo.getPlan(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
});

app.post('/api/ceo/orchestrate', async (req, res) => {
  try {
    const { goal, modelConfig } = req.body;
    if (!goal) return res.status(400).json({ error: 'Missing goal' });
    const logs: string[] = [];
    const plan = await ceo.orchestrate(goal, modelConfig, (msg) => logs.push(msg));
    res.json({ plan, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Multi-Agent Router / Workspaces ────────────────────────────────────────────

app.get('/api/workspaces', (req, res) => {
  res.json(agentRouter.getWorkspaces());
});

app.post('/api/workspaces', (req, res) => {
  try {
    const { name, systemPrompt } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const ws = agentRouter.createWorkspace(name, systemPrompt);
    res.json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/workspaces/:id', (req, res) => {
  const ok = agentRouter.deleteWorkspace(req.params.id);
  if (ok) res.json({ success: true });
  else res.status(404).json({ error: 'Workspace not found' });
});

app.get('/api/routes', (req, res) => {
  res.json(agentRouter.getRoutes());
});

app.post('/api/routes', (req, res) => {
  try {
    const { channel, sourceId, workspaceId } = req.body;
    if (!channel || !sourceId || !workspaceId) {
      return res.status(400).json({ error: 'Missing channel, sourceId, or workspaceId' });
    }
    agentRouter.addRoute(channel, sourceId, workspaceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/routes', (req, res) => {
  const { channel, sourceId } = req.body;
  if (!channel || !sourceId) return res.status(400).json({ error: 'Missing channel or sourceId' });
  const ok = agentRouter.removeRoute(channel, sourceId);
  res.json({ success: ok });
});

// ─── Skill Marketplace ──────────────────────────────────────────────────────────

app.get('/api/marketplace/search', async (req, res) => {
  try {
    const query = (req.query.q as string) || '';
    const results = await skillMarketplace.search(query);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketplace/install', async (req, res) => {
  try {
    const { packageName } = req.body;
    if (!packageName) return res.status(400).json({ error: 'Missing packageName' });
    const skill = await skillMarketplace.install(packageName);
    res.json({ success: true, skill });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketplace/uninstall', async (req, res) => {
  try {
    const { skillId } = req.body;
    if (!skillId) return res.status(400).json({ error: 'Missing skillId' });
    await skillMarketplace.uninstall(skillId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketplace/installed', (req, res) => {
  try {
    res.json(skillMarketplace.listInstalled());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Browser Automation ─────────────────────────────────────────────────────────

app.get('/api/browser/status', (req, res) => {
  res.json(agentBrowser.getStatus());
});

app.post('/api/browser/launch', async (req, res) => {
  try {
    const headless = req.body.headless !== false;
    await agentBrowser.launch(headless);
    res.json({ success: true, status: agentBrowser.getStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/browser/close', async (req, res) => {
  try {
    await agentBrowser.close();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/browser/execute', async (req, res) => {
  try {
    const command = req.body;
    if (!command || !command.action) return res.status(400).json({ error: 'Missing command action' });
    const result = await agentBrowser.execute(command);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── A2A Protocol ────────────────────────────────────────────────────────────────

app.get('/api/a2a/agents', (req, res) => {
  const capability = req.query.capability as A2ACapability | undefined;
  res.json(capability ? a2a.discoverAgents(capability) : a2a.discoverAgents());
});

app.get('/api/a2a/agents/:id', (req, res) => {
  const agent = a2a.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

app.post('/api/a2a/agents/register', (req, res) => {
  try {
    const agent = req.body;
    if (!agent.id || !agent.name) return res.status(400).json({ error: 'Missing id or name' });
    const registered = a2a.registerAgent(agent);
    res.json(registered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/a2a/agents/:id', (req, res) => {
  const ok = a2a.unregisterAgent(req.params.id);
  res.json({ success: ok });
});

app.post('/api/a2a/request', async (req, res) => {
  try {
    const { to, action, payload, timeout } = req.body;
    if (!to || !action) return res.status(400).json({ error: 'Missing to or action' });
    const result = await a2a.sendRequest(to, action, payload, timeout);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auto Knowledge Graph ─────────────────────────────────────────────────────────

app.post('/api/knowledge-graph/auto-build', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const result = await autoBuildGraph(sessionId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/knowledge-graph/auto-build/all', async (req, res) => {
  try {
    const result = await autoBuildAllSessions();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Git Integration ──────────────────────────────────────────────────────────────

app.post('/api/git/clone', async (req, res) => {
  try {
    const { url, branch, targetDir } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    const result = await gitClone(url, branch, targetDir);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/commit', async (req, res) => {
  try {
    const { repoPath, message, files } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'Missing repoPath' });
    const result = await gitCommit(repoPath, message, files);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/push', async (req, res) => {
  try {
    const { repoPath, remote, branch } = req.body;
    if (!repoPath) return res.status(400).json({ error: 'Missing repoPath' });
    const result = await gitPush(repoPath, remote, branch);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/create-pr', async (req, res) => {
  try {
    const { repoPath, title, body, head, base } = req.body;
    if (!repoPath || !title) return res.status(400).json({ error: 'Missing repoPath or title' });
    const result = await gitCreatePR(repoPath, title, body, head, base);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/git/status', async (req, res) => {
  try {
    const repoPath = req.query.path as string;
    if (!repoPath) return res.status(400).json({ error: 'Missing path query param' });
    const result = await gitStatus(repoPath);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/git/log', async (req, res) => {
  try {
    const repoPath = req.query.path as string;
    const maxCount = parseInt(req.query.maxCount as string) || 10;
    if (!repoPath) return res.status(400).json({ error: 'Missing path query param' });
    const result = await gitLog(repoPath, maxCount);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sandbox (Secure Code Execution) ─────────────────────────────────────────────

app.post('/api/sandbox/run', async (req, res) => {
  try {
    const { code, language, timeout, memory } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const result = await sandbox.runCode(code, language, { timeout, memory });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sandbox/active', (req, res) => {
  res.json({ active: sandbox.getActiveSandboxes() });
});

// ─── Notifications ───────────────────────────────────────────────────────────────

app.post('/api/notifications/send', async (req, res) => {
  try {
    const { type, title, message, priority, source, metadata } = req.body;
    if (!type || !title || !message) return res.status(400).json({ error: 'Missing type, title, or message' });
    const notification = await notifications.send(type, title, message, { priority, source, metadata });
    res.json(notification);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(notifications.getHistory(limit));
});

app.post('/api/notifications/read/:id', (req, res) => {
  notifications.markRead(req.params.id);
  res.json({ success: true });
});

app.post('/api/notifications/read-all', (req, res) => {
  notifications.markAllRead();
  res.json({ success: true });
});

app.get('/api/notifications/unread-count', (req, res) => {
  res.json({ count: notifications.getUnreadCount() });
});

app.post('/api/notifications/email-config', (req, res) => {
  try {
    const { host, port, user, pass, from } = req.body;
    if (!host || !port || !user || !pass) return res.status(400).json({ error: 'Missing email config fields' });
    notifications.setEmailConfig({ host, port, user, pass, from: from || user });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/webhook', (req, res) => {
  try {
    const { url, method, headers } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    notifications.addWebhook({ url, method, headers });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/webhook', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  notifications.removeWebhook(url);
  res.json({ success: true });
});

// ─── Vision (Multi-modal Image Analysis) ─────────────────────────────────────────

app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { image, prompt, detail } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image (base64 or URL)' });
    const result = await vision.analyze({ image, prompt, detail });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Voice Agent (JARVIS endpoint) ───────────────────────────────────────────────

app.post('/api/agent/voice', async (req, res) => {
  try {
    const { text, platform, sessionId } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });
    const result = await voiceAgent.process({ text, platform, sessionId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth Middleware (Appwrite) — verify session, proxy to Supabase data ─────────────

import { Client, Account } from 'node-appwrite';

const AW_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const AW_PROJECT = process.env.APPWRITE_PROJECT_ID || '';
const AW_API_KEY = process.env.APPWRITE_API_KEY || '';

async function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const client = new Client()
      .setEndpoint(AW_ENDPOINT)
      .setProject(AW_PROJECT)
      .setKey(AW_API_KEY)
      .setSession(token);
    const account = new Account(client);
    const user = await account.get();
    req.userId = user.$id;
    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Invalid session' });
  }
}

// ─── Sync Routes (Appwrite auth → Supabase data) ─────────────────────────────────────

import { syncRouter } from './sync';
app.use('/api/sync', authMiddleware, syncRouter);

// Wire notifications to WebSocket push

// ─── Agent Metrics ───────────────────────────────────────────────────────────────

app.get('/api/agent-metrics', (req, res) => {
  res.json(metricsCollector.getAllMetrics());
});

app.get('/api/mesh/events', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(metricsCollector.getMeshEvents(limit));
});

app.get('/api/agent/devices', (req, res) => {
  const devices = Array.from(meshDevices.entries()).map(([id, data]) => ({
    id,
    platform: data.platform,
    status: data.status,
    lastSeen: data.lastSeen,
  }));
  res.json(devices);
});

app.post('/api/agent/:deviceId/command', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, args } = req.body;
    sendMeshCommand(deviceId, command, args);
    // Wait for result (poll deviceResults with timeout)
    const timeout = 30000;
    const start = Date.now();
    let result = null;
    while (Date.now() - start < timeout) {
      const entries = deviceResults.get(deviceId) || [];
      const found = entries.find(e => e.command === command && e.timestamp > start - 1000);
      if (found) {
        result = found;
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    if (result) {
      res.json({ success: true, deviceId, command, result: result.result, error: result.error });
    } else {
      res.json({ success: true, deviceId, command, message: 'Command dispatched, result pending' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agent/:deviceId/results', (req, res) => {
  const { deviceId } = req.params;
  const entries = deviceResults.get(deviceId) || [];
  res.json(entries);
});

app.get('/api/agent/:deviceId/info', async (req, res) => {
  try {
    const { deviceId } = req.params;
    sendMeshCommand(deviceId, 'system.info', {});
    const timeout = 10000;
    const start = Date.now();
    let result = null;
    while (Date.now() - start < timeout) {
      const entries = deviceResults.get(deviceId) || [];
      const found = entries.find(e => e.command === 'system.info' && e.timestamp > start - 1000);
      if (found) {
        result = found;
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    if (result) {
      res.json({ success: true, deviceId, info: result.result, error: result.error });
    } else {
      res.json({ success: false, deviceId, message: 'No response from agent within timeout' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

wss.on('connection', (ws: any) => {
  clients.add(ws);
  console.log('Client connected to WebSocket.');
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('error', (err: any) => {
    console.error('Client WebSocket error:', err);
  });

  ws.on('message', async (data: any) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'execute_task') {
        const { goal, modelConfig } = parsed.payload;
        agentKernel.dispatchTask(goal, modelConfig).catch((err: any) => {
          console.error('Task execution failed:', err);
        });
      } else if (parsed.type === 'cancel_task') {
        agentKernel.cancelTask();
      }
    } catch (err: any) {
      console.error('Error handling websocket message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected.');
  });
});

server.listen(port, () => {
  console.log(`Zuvix Agent Server running on http://localhost:${port}`);
  console.log(`WebSocket server active on ws://localhost:${port}/ws`);
});
