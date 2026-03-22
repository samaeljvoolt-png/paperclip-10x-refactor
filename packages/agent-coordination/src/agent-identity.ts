import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AgentMetadata {
  /** Agent type identifier (e.g., 'codex', 'gemini', 'claude') */
  type: string;
  /** Human-readable name */
  name: string;
  /** Session identifier */
  sessionId: string;
  /** Process ID (if applicable) */
  pid?: number;
  /** Started timestamp */
  startedAt: string;
}

export class AgentIdentity {
  private readonly metadata: AgentMetadata;
  private readonly coordinationDir: string;

  constructor(type: string, name: string, coordinationDir: string) {
    this.metadata = {
      type,
      name,
      sessionId: randomUUID(),
      pid: process.pid,
      startedAt: new Date().toISOString(),
    };
    this.coordinationDir = coordinationDir;
  }

  get id(): string {
    return `${this.metadata.type}:${this.metadata.sessionId}`;
  }

  get info(): AgentMetadata {
    return { ...this.metadata };
  }

  /**
   * Register this agent in the active agents registry
   */
  async register(): Promise<void> {
    const agentsFile = path.join(this.coordinationDir, 'active-agents.json');
    let agents: Record<string, AgentMetadata> = {};

    try {
      const content = await fs.readFile(agentsFile, 'utf-8');
      agents = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    agents[this.id] = this.metadata;
    await fs.writeFile(agentsFile, JSON.stringify(agents, null, 2));
  }

  /**
   * Unregister this agent from the active agents registry
   */
  async unregister(): Promise<void> {
    const agentsFile = path.join(this.coordinationDir, 'active-agents.json');
    let agents: Record<string, AgentMetadata> = {};

    try {
      const content = await fs.readFile(agentsFile, 'utf-8');
      agents = JSON.parse(content);
    } catch {
      return; // File doesn't exist
    }

    delete agents[this.id];
    await fs.writeFile(agentsFile, JSON.stringify(agents, null, 2));
  }

  /**
   * Get all currently active agents
   */
  static async getActiveAgents(coordinationDir: string): Promise<Record<string, AgentMetadata>> {
    const agentsFile = path.join(coordinationDir, 'active-agents.json');
    try {
      const content = await fs.readFile(agentsFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * Check if another agent of a specific type is active
   */
  static async hasActiveAgentOfType(coordinationDir: string, type: string): Promise<boolean> {
    const agents = await this.getActiveAgents(coordinationDir);
    return Object.values(agents).some(agent => agent.type === type);
  }
}
