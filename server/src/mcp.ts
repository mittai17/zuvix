import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { BackendSkill } from './skills';

export interface McpServerConfig {
  id: string;
  command: string;
  args: string[];
}

export class McpClientManager {
  private clients: Map<string, Client> = new Map();
  private configs: Map<string, McpServerConfig> = new Map();

  constructor() {}

  public async connectServer(config: McpServerConfig): Promise<void> {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      });

      const client = new Client(
        { name: "zuvix-os", version: "1.0.0" },
        {}
      );

      // Handle transport and client errors
      if ((client as any).on) {
        (client as any).on('error', (err: any) => console.error(`[MCP] Client error (${config.id}):`, err));
      }
      if ((transport as any).on) {
        (transport as any).on('error', (err: any) => console.error(`[MCP] Transport error (${config.id}):`, err));
      }

      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out')), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.clients.set(config.id, client);
      this.configs.set(config.id, config);
      console.log(`[MCP] Connected to server: ${config.id}`);
    } catch (err: any) {
      console.error(`[MCP] Failed to connect to server ${config.id}: ${err.message}`);
    }
  }

  public getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  public async getToolsAsSkills(): Promise<BackendSkill[]> {
    const allSkills: BackendSkill[] = [];

    for (const [serverId, client] of this.clients.entries()) {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout listing tools')), 10000)
        );
        const { tools } = await Promise.race([
          client.request({ method: 'tools/list' }, z.any()) as any,
          timeoutPromise
        ]);
        
        for (const tool of (tools || [])) {
          allSkills.push({
            id: `mcp-${serverId}-${tool.name}`,
            name: tool.name,
            description: tool.description || `Tool from MCP server ${serverId}`,
            code: `// Proxy for MCP tool execution
export async function execute(args) {
  // This is intercepted by skills.ts natively
  return { mcpProxy: true, serverId: "${serverId}", toolName: "${tool.name}", args };
}`,
            readme: '',
            dependencies: []
          });
        }
      } catch (err) {
        console.error(`[MCP] Error listing tools for ${serverId}:`, err);
      }
    }

    return allSkills;
  }

  public async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP Server ${serverId} is not connected.`);
    }

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Tool ${toolName} execution timed out`)), 30000)
      );
      const result = await Promise.race([
        client.request(
          { method: 'tools/call', params: { name: toolName, arguments: args } },
          z.any()
        ),
        timeoutPromise
      ]);
      return result;
    } catch (err: any) {
      console.error(`[MCP] Server ${serverId} tool ${toolName} error:`, err);
      throw new Error(`MCP Tool execution failed: ${err.message}`);
    }
  }
}

// Global Singleton Manager
export const mcpManager = new McpClientManager();

// In-memory dependency store (used by REST API)
const dependencyStore: Record<string, any> = {};

export function getDependencies(): any[] {
  return Object.values(dependencyStore);
}

export function saveDependency(dep: any): void {
  dependencyStore[dep.id] = dep;
}

export function deleteDependency(id: string): void {
  delete dependencyStore[id];
}
