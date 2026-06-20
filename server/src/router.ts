import { memoryEngine } from './memory/vector';
import { AgentKernel, metricsCollector } from './agent';

export interface AgentWorkspace {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: number;
  lastActive: number;
  sessionId: string;
  routeRules: RouteRule[];
}

export interface RouteRule {
  channel: 'telegram' | 'discord' | 'mock' | 'web';
  sourceId: string;  // chat ID, channel ID, user ID
  workspaceId: string;
}

class AgentRouter {
  private workspaces = new Map<string, AgentWorkspace>();
  private routeRules: RouteRule[] = [];
  private agents = new Map<string, AgentKernel>();

  createWorkspace(name: string, systemPrompt?: string): AgentWorkspace {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ws: AgentWorkspace = {
      id,
      name,
      systemPrompt: systemPrompt || 'You are a helpful AI agent. Be concise and accurate.',
      createdAt: Date.now(),
      lastActive: Date.now(),
      sessionId: `session:${id}`,
      routeRules: [],
    };
    this.workspaces.set(id, ws);
    // Create dedicated memory session
    memoryEngine.saveMemory(ws.sessionId, `[System] Workspace "${name}" created`);
    return ws;
  }

  addRoute(channel: RouteRule['channel'], sourceId: string, workspaceId: string) {
    // Remove existing routes for same source
    this.routeRules = this.routeRules.filter(
      r => !(r.channel === channel && r.sourceId === sourceId)
    );
    this.routeRules.push({ channel, sourceId, workspaceId });
  }

  getRoute(channel: string, sourceId: string): RouteRule | undefined {
    return this.routeRules.find(r => r.channel === channel && r.sourceId === sourceId);
  }

  getWorkspace(id: string): AgentWorkspace | undefined {
    return this.workspaces.get(id);
  }

  getWorkspaces(): AgentWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  deleteWorkspace(id: string): boolean {
    return this.workspaces.delete(id);
  }

  removeRoute(channel: string, sourceId: string): boolean {
    const before = this.routeRules.length;
    this.routeRules = this.routeRules.filter(
      r => !(r.channel === channel && r.sourceId === sourceId)
    );
    return this.routeRules.length < before;
  }

  getRoutes(): RouteRule[] {
    return [...this.routeRules];
  }

  /** Route an incoming message to the right workspace and dispatch to agent */
  async routeMessage(channel: string, sourceId: string, userId: string, text: string): Promise<string | null> {
    const route = this.getRoute(channel, sourceId);

    // Auto-create workspace if no route exists
    let workspace: AgentWorkspace;
    if (!route) {
      workspace = this.createWorkspace(`${channel}:${userId}'s workspace`);
      this.addRoute(channel as any, sourceId, workspace.id);
    } else {
      const existing = this.getWorkspace(route.workspaceId);
      if (!existing) return null;
      workspace = existing;
    }

    workspace.lastActive = Date.now();

    // Save message to workspace memory
    await memoryEngine.saveMemory(workspace.sessionId, `[${userId}] ${text}`, 'user');

    return workspace.id;
  }
}

export const agentRouter = new AgentRouter();

// Seed default workspace
agentRouter.createWorkspace('Default', 'You are Zuvix, a self-learning multi-agent OS. Help users with their goals efficiently.');
