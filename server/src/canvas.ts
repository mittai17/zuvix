import * as fs from 'fs';
import * as path from 'path';
import { WebSocket } from 'ws';

export interface CanvasAction {
  action: 'present' | 'navigate' | 'eval' | 'hide' | 'snapshot';
  content?: string;
  url?: string;
  script?: string;
}

const CANVAS_DIR = path.join(__dirname, '../canvas');
const STATE_FILE = path.join(CANVAS_DIR, '.state.json');

interface CanvasState {
  html: string;
  activeUrl: string | null;
  snapshot: string | null;
  lastAction: CanvasAction | null;
  updatedAt: number;
}

let state: CanvasState = {
  html: '<!DOCTYPE html><html><head><style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:1rem}</style></head><body><h1>Zuvix Canvas</h1><p style="color:#64748b">Waiting for agent output...</p></body></html>',
  activeUrl: null,
  snapshot: null,
  lastAction: null,
  updatedAt: Date.now(),
};

if (!fs.existsSync(CANVAS_DIR)) {
  fs.mkdirSync(CANVAS_DIR, { recursive: true });
}

function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
    }
  } catch { }
}

function saveState(): void {
  state.updatedAt = Date.now();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ html: state.html, activeUrl: state.activeUrl, updatedAt: state.updatedAt }), 'utf8');
  } catch { }
}

loadState();

// Canvas WebSocket clients for live streaming
const canvasClients = new Set<WebSocket>();

export function registerCanvasClient(ws: WebSocket): () => void {
  canvasClients.add(ws);
  // Send current state immediately
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'canvas_state', payload: state }));
  }
  return () => { canvasClients.delete(ws); };
}

function broadcastState(): void {
  const msg = JSON.stringify({ type: 'canvas_state', payload: state });
  for (const ws of canvasClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// Stream HTML content in chunks (for agent streaming)
export function streamCanvasHtml(chunk: string): void {
  const msg = JSON.stringify({ type: 'canvas_stream', payload: { html: chunk, updatedAt: Date.now() } });
  for (const ws of canvasClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function getCanvasState(): CanvasState {
  return { ...state };
}

export function applyCanvasAction(action: CanvasAction): { success: boolean; error?: string } {
  switch (action.action) {
    case 'present': {
      const html = action.content || '';
      state.html = html;
      state.activeUrl = null;
      state.lastAction = action;
      saveState();
      const htmlPath = path.join(CANVAS_DIR, 'index.html');
      fs.writeFileSync(htmlPath, html, 'utf8');
      broadcastState();
      return { success: true };
    }
    case 'navigate': {
      if (!action.url) return { success: false, error: 'No URL provided' };
      state.activeUrl = action.url;
      state.lastAction = action;
      saveState();
      broadcastState();
      return { success: true };
    }
    case 'eval': {
      state.lastAction = action;
      broadcastState();
      return { success: true };
    }
    case 'hide': {
      state.lastAction = action;
      broadcastState();
      return { success: true };
    }
    case 'snapshot': {
      state.lastAction = action;
      return { success: true, error: 'Snapshot not implemented' };
    }
    default:
      return { success: false, error: `Unknown action: ${(action as any).action}` };
  }
}

export function getClientCount(): number {
  return canvasClients.size;
}
