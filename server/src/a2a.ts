// Agent-to-Agent (A2A) Protocol — agents discover and communicate with each other
// Inspired by OpenFang's A2A + Google's Agent2Agent protocol

import { memoryEngine } from './memory/vector';

export type A2ACapability = 
  | 'web-search'
  | 'code-generation'
  | 'file-operations' 
  | 'browser-automation'
  | 'knowledge-graph'
  | 'memory-search'
  | 'reasoning'
  | 'translation'
  | 'summarization'
  | 'data-analysis'
  | 'custom';

export interface A2AAgent {
  id: string;
  name: string;
  description: string;
  capabilities: A2ACapability[];
  endpoint: string;  // URL or internal handler name
  version: string;
  status: 'online' | 'busy' | 'offline';
  lastSeen: number;
  metrics?: {
    tasksCompleted: number;
    avgResponseTime: number;
    successRate: number;
  };
}

export interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'stream' | 'error';
  action: string;
  payload: any;
  timestamp: number;
  correlationId?: string;
  responseTimeout?: number;  // ms
}

export interface A2AResult {
  success: boolean;
  data?: any;
  error?: string;
  agentId: string;
  processingTime: number;
}

class A2AProtocol {
  private agents = new Map<string, A2AAgent>();
  private pendingRequests = new Map<string, {
    resolve: (result: A2AResult) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  registerAgent(agent: Omit<A2AAgent, 'status' | 'lastSeen'>): A2AAgent {
    const registered: A2AAgent = {
      ...agent,
      status: 'online',
      lastSeen: Date.now(),
      metrics: { tasksCompleted: 0, avgResponseTime: 0, successRate: 1 },
    };
    this.agents.set(agent.id, registered);
    memoryEngine.saveMemory('a2a:registry', `[System] Agent "${agent.name}" registered with capabilities: ${agent.capabilities.join(', ')}`);
    return registered;
  }

  unregisterAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = 'offline';
      memoryEngine.saveMemory('a2a:registry', `[System] Agent "${agent.name}" unregistered`);
    }
    return this.agents.delete(id);
  }

  updateAgentStatus(id: string, status: A2AAgent['status']): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.lastSeen = Date.now();
    }
  }

  discoverAgents(capability?: A2ACapability): A2AAgent[] {
    const all = Array.from(this.agents.values());
    if (capability) {
      return all.filter(a => a.capabilities.includes(capability) && a.status !== 'offline');
    }
    return all.filter(a => a.status !== 'offline');
  }

  getAgent(id: string): A2AAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): A2AAgent[] {
    return Array.from(this.agents.values());
  }

  async sendRequest(
    to: string,
    action: string,
    payload: any,
    timeout = 30000
  ): Promise<A2AResult> {
    const agent = this.agents.get(to);
    if (!agent || agent.status === 'offline') {
      throw new Error(`Agent "${to}" is not available`);
    }

    const msg: A2AMessage = {
      id: `a2a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: 'a2a-gateway',
      to,
      type: 'request',
      action,
      payload,
      timestamp: Date.now(),
      responseTimeout: timeout,
    };

    // For built-in agent handlers, dispatch locally
    if (this.localHandlers.has(action)) {
      const start = Date.now();
      try {
        const handler = this.localHandlers.get(action)!;
        const result = await handler(msg);
        const processingTime = Date.now() - start;

        // Update metrics
        agent.metrics = agent.metrics || { tasksCompleted: 0, avgResponseTime: 0, successRate: 1 };
        agent.metrics.tasksCompleted++;
        agent.metrics.avgResponseTime = (agent.metrics.avgResponseTime * (agent.metrics.tasksCompleted - 1) + processingTime) / agent.metrics.tasksCompleted;

        return {
          success: true,
          data: result,
          agentId: to,
          processingTime,
        };
      } catch (err: any) {
        agent.metrics!.tasksCompleted++;
        agent.metrics!.successRate = Math.max(0, agent.metrics!.successRate - 0.1);
        return {
          success: false,
          error: err.message,
          agentId: to,
          processingTime: Date.now() - start,
        };
      }
    }

    throw new Error(`No handler registered for action "${action}"`);
  }

  private localHandlers = new Map<string, (msg: A2AMessage) => Promise<any>>();

  registerHandler(action: string, handler: (msg: A2AMessage) => Promise<any>): void {
    this.localHandlers.set(action, handler);
  }

  // Seed default built-in agents
  seedDefaultAgents(): void {
    this.registerAgent({
      id: 'reasoner',
      name: 'Reasoning Engine',
      description: 'Multi-step reasoning, logic analysis, and problem decomposition',
      capabilities: ['reasoning', 'summarization'],
      endpoint: 'internal://reasoner',
      version: '1.0.0',
    });

    this.registerAgent({
      id: 'code-gen',
      name: 'Code Generator',
      description: 'Generate, review, and refactor code in multiple languages',
      capabilities: ['code-generation'],
      endpoint: 'internal://code-gen',
      version: '1.0.0',
    });

    this.registerAgent({
      id: 'browser-agent',
      name: 'Browser Agent',
      description: 'Control headless browser for web automation and scraping',
      capabilities: ['browser-automation'],
      endpoint: 'internal://browser-agent',
      version: '1.0.0',
    });

    this.registerAgent({
      id: 'knowledge-agent',
      name: 'Knowledge Agent',
      description: 'Query and manage the knowledge graph',
      capabilities: ['knowledge-graph', 'memory-search'],
      endpoint: 'internal://knowledge-agent',
      version: '1.0.0',
    });

    this.registerAgent({
      id: 'web-search',
      name: 'Web Search Agent',
      description: 'Search the web using multiple providers',
      capabilities: ['web-search'],
      endpoint: 'internal://web-search',
      version: '1.0.0',
    });
  }
}

export const a2a = new A2AProtocol();
a2a.seedDefaultAgents();
