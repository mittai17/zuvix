import { WebSocket } from 'ws';
import { getInstalledSkills, getInstalledSkillsAsync, executeSkill } from './skills';
import { getMemory, getSoul } from './memory';
import { getLLMClient, getModelName, resolveProvider, createChatCompletion } from './llm';
import { logToDatabase } from './db';
import { selfImprove } from './self-improve';
import { telemetryStore } from './telemetry-store';

export interface AgentMetricSnapshot {
  agentId: string;
  agentName: string;
  cpu: number;
  memory: number;
  taskCount: number;
  status: 'idle' | 'thinking' | 'busy';
  currentTool: string;
  lastActive: number;
  uptime: number;
  history: { cpu: number; memory: number; t: number }[];
}

interface MeshEventEntry {
  id: string;
  source: string;
  message: string;
  targets: string[];
  timestamp: number;
}

const MAX_HISTORY = 40;

class AgentMetricsCollector {
  private metrics = new Map<string, AgentMetricSnapshot>();
  private meshEvents: MeshEventEntry[] = [];
  private startTime = Date.now();
  private broadcastClients: Set<WebSocket> | null = null;

  private eventId = 0;

  setBroadcastClients(clients: Set<WebSocket>) {
    this.broadcastClients = clients;
  }

  private agentGoals = new Map<string, string>();

  registerAgent(agentId: string, agentName: string, goal: string = '') {
    if (goal) this.agentGoals.set(agentId, goal);
    if (this.metrics.has(agentId)) return;
    this.metrics.set(agentId, {
      agentId,
      agentName,
      cpu: Math.random() * 30 + 5,
      memory: Math.random() * 40 + 10,
      taskCount: 0,
      status: 'idle',
      currentTool: '',
      lastActive: Date.now(),
      uptime: 0,
      history: [],
    });
  }

  updateAgentStatus(agentId: string, status: 'idle' | 'thinking' | 'busy', currentTool: string = '') {
    const m = this.metrics.get(agentId);
    if (!m) return;
    m.status = status;
    m.currentTool = currentTool;
    m.lastActive = Date.now();
    if (status === 'busy') m.taskCount++;
    // Simulate CPU/memory variation based on status
    const cpuBase = status === 'busy' ? 60 : status === 'thinking' ? 35 : 8;
    const memBase = status === 'busy' ? 55 : status === 'thinking' ? 30 : 12;
    m.cpu = Math.min(99, cpuBase + Math.random() * 25);
    m.memory = Math.min(98, memBase + Math.random() * 20);
    m.history.push({ cpu: m.cpu, memory: m.memory, t: Date.now() });
    if (m.history.length > MAX_HISTORY) m.history.shift();

    // Log update to telemetry
    const goal = this.agentGoals.get(agentId) || 'General tasks';
    telemetryStore.logAgentHistory(agentId, m.agentName, goal, status, currentTool, '');
  }

  recordMeshEvent(source: string, message: string, targets: string[]) {
    const event: MeshEventEntry = {
      id: `mesh-${++this.eventId}`,
      source,
      message,
      targets,
      timestamp: Date.now(),
    };
    this.meshEvents.push(event);
    if (this.meshEvents.length > 100) this.meshEvents.shift();

    if (this.broadcastClients) {
      const msg = JSON.stringify({ type: 'mesh_event', payload: event });
      for (const ws of this.broadcastClients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    }
  }

  // Periodic tick — simulates natural drift for agents that aren't actively updating
  tick() {
    const now = Date.now();
    for (const [, m] of this.metrics) {
      if (m.status === 'idle') {
        m.cpu = Math.max(2, m.cpu + (Math.random() - 0.5) * 6);
        m.memory = Math.max(4, m.memory + (Math.random() - 0.5) * 4);
        m.history.push({ cpu: m.cpu, memory: m.memory, t: now });
        if (m.history.length > MAX_HISTORY) m.history.shift();
      }
      m.uptime = Math.floor((now - this.startTime) / 1000);
    }
  }

  broadcastMetrics() {
    if (!this.broadcastClients) return;
    this.tick();
    const snapshot = this.getAllMetrics();
    const msg = JSON.stringify({ type: 'metrics_update', payload: snapshot });
    for (const ws of this.broadcastClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  getAllMetrics(): AgentMetricSnapshot[] {
    return Array.from(this.metrics.values());
  }

  getMeshEvents(limit = 20): MeshEventEntry[] {
    return this.meshEvents.slice(-limit);
  }
}

export const metricsCollector = new AgentMetricsCollector();

export class AgentKernel {
  private wsClients: Set<WebSocket>;
  private isRunning: boolean = false;
  private cancelled: boolean = false;
  private abortController: AbortController | null = null;

  public static meshListeners: Array<(msg: any) => void> = [];

  constructor(wsClients: Set<WebSocket>) {
    this.wsClients = wsClients;
  }

  public cancelTask() {
    this.cancelled = true;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
    this.broadcast('status', { status: 'idle' });
    this.emitLog('Kernel', 'Task cancelled.');
  }

  private broadcast(type: string, payload: any) {
    const msg = JSON.stringify({ type, payload });
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg, (err) => {
          if (err) console.error('Broadcast error:', err);
        });
      }
    }
  }

  private emitLog(agentId: string, message: string) {
    console.log(message);
    this.broadcast('log', { agentName: agentId, message });
    logToDatabase(agentId, 'agent_log', { message });
  }

  private emitStatus(status: string) {
    this.broadcast('status', { status });
  }

  public async dispatchTask(goal: string, modelConfig?: any) {
    if (this.isRunning) {
      this.emitLog('Kernel', "Agent is already running a task.");
      return;
    }

    this.cancelled = false;
    this.abortController = new AbortController();
    this.isRunning = true;
    this.emitStatus('running');
    this.emitLog('Kernel', `Received goal: ${goal}`);

    try {
      const result = await this.runReActLoop(goal, modelConfig);
      this.broadcast('result', { result });
    } catch (err: any) {
      this.emitLog('Kernel', `Error: ${err.message}`);
      this.broadcast('error', { error: err.message });
    } finally {
      this.isRunning = false;
      this.emitStatus('idle');
      this.emitLog('Kernel', 'Task finished.');
    }
  }

  private async runReActLoop(goal: string, modelConfig?: any, depth: number = 0, parentAgentId: string = 'AgentKernel'): Promise<string> {
    const agentId = depth === 0 ? 'Kernel' : `SubAgent-${Math.random().toString(36).substring(7)}`;
    const agentName = depth === 0 ? 'Kernel' : `Worker ${agentId.slice(-4)}`;
    metricsCollector.registerAgent(agentId, agentName, goal);

    const openai = getLLMClient(modelConfig);
    const modelName = getModelName(modelConfig);

    const skills = await getInstalledSkillsAsync();

    let systemPrompt = getSoul() + "\n\n" + getMemory() + "\n\n";
    systemPrompt += `You are a ReAct (Reason + Act) autonomous agent. Your ID is ${agentId}. Your goal is: ${goal}\n\n`;
    systemPrompt += "Available Tools:\n";
    skills.forEach(s => {
      systemPrompt += `- ${s.id}: ${s.description}\n`;
    });

    // Inject self-improvement patterns
    const improvementContext = selfImprove.getContextForPrompt(goal);
    if (improvementContext) systemPrompt += improvementContext;

    systemPrompt += `\nINSTRUCTIONS:
You must return a JSON object with one of the following formats:
1. To think: { "action": "think", "thought": "your thought process" }
2. To use a tool: { "action": "tool", "tool": "tool_id", "args": ["arg1", "arg2"] }
3. To spawn a sub-agent to solve a complex sub-task: { "action": "spawn", "agent_id": "NameOfTheAgent", "goal": "Specific instructions for the sub-agent" }
4. To communicate horizontally on the Agent Mesh: { "action": "mesh_broadcast", "message": "Information to share with peers" }
5. To finish: { "action": "finish", "result": "final answer or summary" }

Do NOT wrap the JSON in markdown code blocks like \`\`\`json. Return RAW JSON.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Begin." }
    ];

    let loopCount = 0;
    const maxLoops = 15;

    (this as any)[`_meshQueue_${agentId}`] = [];

    const meshCallback = (msg: {source: string, message: string}) => {
      if (msg.source !== agentId) {
        (this as any)[`_meshQueue_${agentId}`].push(`From ${msg.source}: ${msg.message}`);
        // Record incoming mesh event
        metricsCollector.recordMeshEvent(msg.source, msg.message, [agentId]);
      }
    };
    AgentKernel.meshListeners.push(meshCallback);

    try {
      while (loopCount < maxLoops) {
      if (this.cancelled) {
        this.emitLog(agentId, 'Task was cancelled.');
        return 'Task cancelled.';
      }
      loopCount++;
      this.emitLog(agentId, `Thinking (Loop ${loopCount})...`);

      const response = await createChatCompletion(openai, {
        model: modelName,
        messages: messages,
        temperature: 0.2,
        max_tokens: 4096,
      }, resolveProvider(modelConfig));

      const responseText = response.choices[0]?.message?.content?.trim() || "{}";

      let parsed: any;
      try {
        const cleanText = responseText.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(cleanText);
      } catch (e) {
        this.emitLog(agentId, `Failed to parse LLM response as JSON. Response: ${responseText}`);
        messages.push({ role: "user", content: `Error parsing JSON. You MUST return ONLY valid JSON matching the requested schema.` });
        continue;
      }

      const pendingMessages = (this as any)[`_meshQueue_${agentId}`] || [];
      if (pendingMessages.length > 0) {
        messages.push({ role: "user", content: `[MESH NOTIFICATION] You received messages from peers: ${pendingMessages.join(' | ')}` });
        (this as any)[`_meshQueue_${agentId}`] = [];
      }

      if (parsed.action === 'think') {
        this.emitLog(agentId, `Thought: ${parsed.thought}`);
        metricsCollector.updateAgentStatus(agentId, 'thinking', '');
        this.broadcast('agent_update', { agentId, status: 'thinking', currentTool: '' });
        messages.push({ role: "assistant", content: JSON.stringify(parsed) });
        messages.push({ role: "user", content: "Continue." });
      } else if (parsed.action === 'tool') {
        this.emitLog(agentId, `Executing tool '${parsed.tool}' with args: ${JSON.stringify(parsed.args)}`);
        metricsCollector.updateAgentStatus(agentId, 'busy', parsed.tool);
        this.broadcast('agent_update', { agentId, status: 'busy', currentTool: parsed.tool });

        try {
          const result = await executeSkill(parsed.tool, parsed.args || []);
          const resultStr = JSON.stringify(result);
          this.emitLog(agentId, `Tool result: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
          messages.push({ role: "assistant", content: JSON.stringify(parsed) });
          messages.push({ role: "user", content: `Tool result: ${resultStr}` });
          selfImprove.recordAction(agentId, parsed.tool, parsed.args, { success: true, result }, true, goal);
        } catch (err: any) {
          this.emitLog(agentId, `Tool execution failed: ${err.message}`);
          messages.push({ role: "assistant", content: JSON.stringify(parsed) });
          messages.push({ role: "user", content: `Tool execution error: ${err.message}` });
          selfImprove.recordAction(agentId, parsed.tool, parsed.args, { error: err.message }, false, goal);
        }
      } else if (parsed.action === 'mesh_broadcast') {
        this.emitLog(agentId, `[MESH] Broadcasting: ${parsed.message}`);
        this.broadcast('mesh_event', { source: agentId, message: parsed.message });

        // Record mesh event
        const targets = [...AgentKernel.meshListeners]
          .map((_, i) => `agent-${i}`)
          .filter(() => Math.random() > 0.5);

        metricsCollector.recordMeshEvent(agentId, parsed.message, targets);

        AgentKernel.meshListeners.forEach(listener => listener({ source: agentId, message: parsed.message }));

        messages.push({ role: "assistant", content: JSON.stringify(parsed) });
        messages.push({ role: "user", content: `Message broadcasted to mesh.` });

      } else if (parsed.action === 'spawn') {
        this.emitLog(agentId, `Spawning sub-agent '${parsed.agent_id}' for goal: ${parsed.goal}`);
        metricsCollector.updateAgentStatus(agentId, 'busy', 'spawn');
        this.broadcast('agent_update', { agentId: parsed.agent_id, status: 'thinking', currentTool: '' });
        this.broadcast('topology_spawn', { parentId: agentId, childId: parsed.agent_id });

        try {
          const subResult = await this.runReActLoop(parsed.goal, modelConfig, depth + 1, agentId);
          this.emitLog(agentId, `Sub-agent '${parsed.agent_id}' returned: ${subResult}`);
          messages.push({ role: "assistant", content: JSON.stringify(parsed) });
          messages.push({ role: "user", content: `Sub-agent ${parsed.agent_id} completed with result: ${subResult}` });
        } catch (err: any) {
          this.emitLog(agentId, `Sub-agent failed: ${err.message}`);
          messages.push({ role: "assistant", content: JSON.stringify(parsed) });
          messages.push({ role: "user", content: `Sub-agent ${parsed.agent_id} failed with error: ${err.message}` });
        }
      } else if (parsed.action === 'finish') {
        this.emitLog(agentId, `Task Complete: ${parsed.result}`);
        metricsCollector.updateAgentStatus(agentId, 'idle', '');
        this.broadcast('agent_update', { agentId, status: 'idle', currentTool: '' });
        return parsed.result;
      } else {
        this.emitLog(agentId, `Unknown action: ${parsed.action}`);
        messages.push({ role: "user", content: `Unknown action: ${parsed.action}. Please use "think", "tool", "mesh_broadcast", "spawn", or "finish".` });
      }
      }
    } finally {
      AgentKernel.meshListeners = AgentKernel.meshListeners.filter(l => l !== meshCallback);
    }

    if (loopCount >= maxLoops) {
      this.emitLog(agentId, `Maximum loops reached. Terminating task.`);
      return "Task timed out.";
    }

    return "Task completed.";
  }
}
