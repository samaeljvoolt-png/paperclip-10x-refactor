import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentIdentity } from './agent-identity.js';

export type ActivityType =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'directory_create'
  | 'command_exec'
  | 'lock_acquire'
  | 'lock_release'
  | 'task_start'
  | 'task_complete'
  | 'error'
  | 'message';

export interface ActivityEntry {
  /** Unique entry ID */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** Agent that performed the action */
  agentId: string;
  /** Type of activity */
  type: ActivityType;
  /** Resource or subject of the activity */
  resource?: string;
  /** Human-readable description */
  description: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ActivityFilter {
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by activity type */
  type?: ActivityType;
  /** Filter by resource pattern */
  resourcePattern?: string;
  /** Only entries after this timestamp */
  since?: string;
  /** Maximum entries to return */
  limit?: number;
}

export class ActivityLogger {
  private readonly logFile: string;
  private readonly agentIdentity: AgentIdentity;
  private readonly maxEntries: number;

  constructor(logDir: string, agentIdentity: AgentIdentity, maxEntries = 1000) {
    this.logFile = path.join(logDir, 'activity.jsonl');
    this.agentIdentity = agentIdentity;
    this.maxEntries = maxEntries;
  }

  /**
   * Log an activity entry
   */
  async log(
    type: ActivityType,
    description: string,
    options: { resource?: string; metadata?: Record<string, unknown> } = {}
  ): Promise<ActivityEntry> {
    const entry: ActivityEntry = {
      id: `${this.agentIdentity.id}:${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: this.agentIdentity.id,
      type,
      resource: options.resource,
      description,
      metadata: options.metadata,
    };

    await this.appendEntry(entry);
    return entry;
  }

  /**
   * Log a file read operation
   */
  async logFileRead(filePath: string, description?: string): Promise<ActivityEntry> {
    return this.log('file_read', description || `Read file: ${filePath}`, { resource: filePath });
  }

  /**
   * Log a file write operation
   */
  async logFileWrite(filePath: string, description?: string): Promise<ActivityEntry> {
    return this.log('file_write', description || `Modified file: ${filePath}`, { resource: filePath });
  }

  /**
   * Log a command execution
   */
  async logCommand(command: string, description?: string): Promise<ActivityEntry> {
    return this.log('command_exec', description || `Executed: ${command}`, { 
      resource: command,
      metadata: { command }
    });
  }

  /**
   * Log task start
   */
  async logTaskStart(taskName: string, description?: string): Promise<ActivityEntry> {
    return this.log('task_start', description || `Started task: ${taskName}`, { 
      resource: taskName,
      metadata: { taskName }
    });
  }

  /**
   * Log task completion
   */
  async logTaskComplete(taskName: string, description?: string): Promise<ActivityEntry> {
    return this.log('task_complete', description || `Completed task: ${taskName}`, { 
      resource: taskName,
      metadata: { taskName }
    });
  }

  /**
   * Log an error
   */
  async logError(error: string, description?: string): Promise<ActivityEntry> {
    return this.log('error', description || `Error: ${error}`, { 
      metadata: { error }
    });
  }

  /**
   * Log a message for other agents
   */
  async logMessage(message: string, metadata?: Record<string, unknown>): Promise<ActivityEntry> {
    return this.log('message', message, { metadata });
  }

  /**
   * Get recent activity entries
   */
  async getRecent(filter: ActivityFilter = {}): Promise<ActivityEntry[]> {
    const entries: ActivityEntry[] = [];

    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as ActivityEntry;

          // Apply filters
          if (filter.agentId && entry.agentId !== filter.agentId) continue;
          if (filter.type && entry.type !== filter.type) continue;
          if (filter.resourcePattern && !entry.resource?.includes(filter.resourcePattern)) continue;
          if (filter.since && entry.timestamp < filter.since) continue;

          entries.push(entry);
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // File doesn't exist yet
    }

    // Sort by timestamp descending and apply limit
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    const limit = filter.limit || this.maxEntries;
    return entries.slice(0, limit).reverse();
  }

  /**
   * Get messages from other agents
   */
  async getMessagesFromOtherAgents(since?: string): Promise<ActivityEntry[]> {
    const entries = await this.getRecent({
      type: 'message',
      since,
    });
    
    // Filter out own messages
    return entries.filter(e => e.agentId !== this.agentIdentity.id);
  }

  /**
   * Get activity summary for a time range
   */
  async getSummary(since: string, until?: string): Promise<{
    totalEntries: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
    modifiedFiles: string[];
  }> {
    const entries = await this.getRecent({ since });
    const filtered = until ? entries.filter(e => e.timestamp <= until) : entries;

    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const modifiedFiles = new Set<string>();

    for (const entry of filtered) {
      byAgent[entry.agentId] = (byAgent[entry.agentId] || 0) + 1;
      byType[entry.type] = (byType[entry.type] || 0) + 1;

      if (entry.type === 'file_write' && entry.resource) {
        modifiedFiles.add(entry.resource);
      }
    }

    return {
      totalEntries: filtered.length,
      byAgent,
      byType,
      modifiedFiles: Array.from(modifiedFiles),
    };
  }

  private async appendEntry(entry: ActivityEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.logFile), { recursive: true });
    
    // Append to log file
    await fs.appendFile(this.logFile, line);

    // Trim old entries if needed
    await this.trimLog();
  }

  private async trimLog(): Promise<void> {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);

      if (lines.length > this.maxEntries) {
        const trimmed = lines.slice(-this.maxEntries);
        await fs.writeFile(this.logFile, trimmed.join('\n') + '\n');
      }
    } catch {
      // Ignore trim errors
    }
  }
}
