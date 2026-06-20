/* src/store/agentStore.ts */

export interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'thinking' | 'busy' | 'error' | 'success';
  currentTool?: string;
  x: number;
  y: number;
  avatar: string;
}

export interface Connection {
  id?: string;
  from: string;
  to: string;
  active: boolean;
}

export interface LogEntry {
  timestamp: string;
  agentName: string;
  message: string;
  type: 'info' | 'tool' | 'success' | 'error' | 'thought' | 'user' | 'stream';
}

export interface AgentOSState {
  agents: AgentNode[];
  connections: Connection[];
  logs: LogEntry[];
  activeTask: string;
  isRunning: boolean;
  currentStepIndex: number;
}

export const INITIAL_AGENTS: AgentNode[] = [
  { id: 'coordinator', name: 'Coordinator Agent', role: 'Planner & Orchestrator', status: 'idle', x: 250, y: 100, avatar: '👑' },
  { id: 'researcher', name: 'Web Researcher', role: 'Information Retrieval', status: 'idle', x: 100, y: 260, avatar: '🔍' },
  { id: 'coder', name: 'Software Engineer', role: 'TS/JS Code Generator', status: 'idle', x: 250, y: 260, avatar: '💻' },
  { id: 'verifier', name: 'Quality Assurance', role: 'Testing & Linter', status: 'idle', x: 400, y: 260, avatar: '🛡️' }
];

export const INITIAL_CONNECTIONS: Connection[] = [
  { id: 'coordinator-researcher', from: 'coordinator', to: 'researcher', active: false },
  { id: 'coordinator-coder', from: 'coordinator', to: 'coder', active: false },
  { id: 'coordinator-verifier', from: 'coordinator', to: 'verifier', active: false },
  { id: 'researcher-coder', from: 'researcher', to: 'coder', active: false },
  { id: 'coder-verifier', from: 'coder', to: 'verifier', active: false }
];

// Simulated Multi-agent steps for standard tasks
export interface SimStep {
  agentId: string;
  message: string;
  type: 'info' | 'tool' | 'success' | 'error' | 'thought';
  toolName?: string;
  activeConnections: string[]; // List of from-to connections to activate (e.g. ["coordinator-researcher"])
  nodeStatuses: Record<string, 'idle' | 'thinking' | 'busy' | 'success' | 'error'>;
}

export const SIMULATION_TASKS: Record<string, SimStep[]> = {
  'build-contact-api': [
    {
      agentId: 'coordinator',
      message: 'Received goal: "Create a syncable contact database API". Spawning subagents and compiling implementation plan.',
      type: 'thought',
      activeConnections: [],
      nodeStatuses: { coordinator: 'thinking', researcher: 'idle', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'coordinator',
      message: 'Delegating background search to Web Researcher to find best database schemas.',
      type: 'info',
      activeConnections: ['coordinator-researcher'],
      nodeStatuses: { coordinator: 'busy', researcher: 'thinking', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'researcher',
      message: 'Running web search for: "PostgreSQL syncable schema design best practices".',
      type: 'tool',
      toolName: 'web_search',
      activeConnections: [],
      nodeStatuses: { coordinator: 'idle', researcher: 'busy', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'researcher',
      message: 'Discovered that using UUIDs and update timestamps (last_modified) is recommended for sync conflicts. Relaying findings back.',
      type: 'success',
      activeConnections: ['coordinator-researcher'],
      nodeStatuses: { coordinator: 'idle', researcher: 'success', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'coordinator',
      message: 'Findings processed. Assigning Coder Agent to write Express.js router with UUID sync endpoints.',
      type: 'info',
      activeConnections: ['coordinator-coder'],
      nodeStatuses: { coordinator: 'busy', researcher: 'idle', coder: 'thinking', verifier: 'idle' }
    },
    {
      agentId: 'coder',
      message: 'Creating file: src/api/contacts.ts with sync protocols and conflicts handler.',
      type: 'tool',
      toolName: 'write_to_file',
      activeConnections: [],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'busy', verifier: 'idle' }
    },
    {
      agentId: 'coder',
      message: 'Code generation complete. Relaying schema structure to Quality Assurance for test plan generation.',
      type: 'success',
      activeConnections: ['coder-verifier'],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'success', verifier: 'thinking' }
    },
    {
      agentId: 'verifier',
      message: 'Running linter and unit tests on src/api/contacts.ts.',
      type: 'tool',
      toolName: 'run_command',
      activeConnections: [],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'idle', verifier: 'busy' }
    },
    {
      agentId: 'verifier',
      message: 'Linter passed. 4/4 unit tests succeeded. The sync engine resolves conflicts cleanly.',
      type: 'success',
      activeConnections: ['coordinator-verifier'],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'idle', verifier: 'success' }
    },
    {
      agentId: 'coordinator',
      message: 'All subagents completed successfully. Task "syncable contact database API" is fully resolved and saved in vector DB.',
      type: 'success',
      activeConnections: [],
      nodeStatuses: { coordinator: 'success', researcher: 'idle', coder: 'idle', verifier: 'idle' }
    }
  ],
  'scrape-and-summarize': [
    {
      agentId: 'coordinator',
      message: 'Received goal: "Gather latest research papers on Autonomous Agents self-improvement and build skill files".',
      type: 'thought',
      activeConnections: [],
      nodeStatuses: { coordinator: 'thinking', researcher: 'idle', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'coordinator',
      message: 'Spawning Web Researcher to search arXiv and fetch relevant PDFs.',
      type: 'info',
      activeConnections: ['coordinator-researcher'],
      nodeStatuses: { coordinator: 'busy', researcher: 'thinking', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'researcher',
      message: 'Searching arXiv database for query: "Nous Research Hermes learning loop self-improvement".',
      type: 'tool',
      toolName: 'arxiv_search',
      activeConnections: [],
      nodeStatuses: { coordinator: 'idle', researcher: 'busy', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'researcher',
      message: 'Fetched 3 paper abstracts. Found critical paper describing recursive self-improvement and skill caching. Forwarding abstracts.',
      type: 'success',
      activeConnections: ['coordinator-researcher'],
      nodeStatuses: { coordinator: 'idle', researcher: 'success', coder: 'idle', verifier: 'idle' }
    },
    {
      agentId: 'coordinator',
      message: 'Synthesizing paper rules. Assigning Coder to create a mock recursive parser skill template.',
      type: 'info',
      activeConnections: ['coordinator-coder'],
      nodeStatuses: { coordinator: 'busy', researcher: 'idle', coder: 'thinking', verifier: 'idle' }
    },
    {
      agentId: 'coder',
      message: 'Writing skill document: SKILL.md under skills/recursive-parser/ directory.',
      type: 'tool',
      toolName: 'write_to_file',
      activeConnections: [],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'busy', verifier: 'idle' }
    },
    {
      agentId: 'coder',
      message: 'Finished draft skill code. Requesting QA check compatibility with openclaw-agents.',
      type: 'success',
      activeConnections: ['coder-verifier'],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'success', verifier: 'thinking' }
    },
    {
      agentId: 'verifier',
      message: 'Verifying skill syntax and validating structure against OpenClaw specs.',
      type: 'tool',
      toolName: 'linter_check',
      activeConnections: [],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'idle', verifier: 'busy' }
    },
    {
      agentId: 'verifier',
      message: 'Validation successful. Skill is fully compatible and standard-compliant.',
      type: 'success',
      activeConnections: ['coordinator-verifier'],
      nodeStatuses: { coordinator: 'idle', researcher: 'idle', coder: 'idle', verifier: 'success' }
    },
    {
      agentId: 'coordinator',
      message: 'Task complete. New skill is registered on ClawHub local cache and cloud database sync.',
      type: 'success',
      activeConnections: [],
      nodeStatuses: { coordinator: 'success', researcher: 'idle', coder: 'idle', verifier: 'idle' }
    }
  ]
};
