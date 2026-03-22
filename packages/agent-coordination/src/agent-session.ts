import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentIdentity, type AgentMetadata } from './agent-identity.js';
import { FileLockManager, type LockOptions } from './file-lock.js';
import { ActivityLogger, type ActivityEntry, type ActivityFilter } from './activity-logger.js';

export interface AgentSessionOptions {
  /** Directory for coordination files (default: .agent-coordination in cwd) */
  coordinationDir?: string;
  /** Agent type (e.g., 'codex', 'gemini', 'claude') */
  agentType: string;
  /** Human-readable agent name */
  agentName?: string;
  /** Maximum activity log entries to keep */
  maxLogEntries?: number;
}

export interface SessionStatus {
  /** Current active agents */
  activeAgents: Record<string, AgentMetadata>;
  /** Held locks by this agent */
  heldLocks: string[];
  /** Recent activity count */
  recentActivityCount: number;
  /** Session started at */
  startedAt: string;
}

/**
 * Main coordination session for AI agents
 * 
 * Provides a unified interface for:
 * - Agent registration/discovery
 * - File/resource locking
 * - Activity logging and inter-agent communication
 */
export class AgentSession {
  private readonly coordinationDir: string;
  private readonly identity: AgentIdentity;
  private readonly lockManager: FileLockManager;
  private readonly activityLogger: ActivityLogger;
  private readonly locksDir: string;
  private readonly logsDir: string;
  private registered: boolean;

  constructor(options: AgentSessionOptions) {
    this.coordinationDir = options.coordinationDir || path.join(process.cwd(), '.agent-coordination');
    this.locksDir = path.join(this.coordinationDir, 'locks');
    this.logsDir = path.join(this.coordinationDir, 'logs');
    
    this.identity = new AgentIdentity(
      options.agentType,
      options.agentName || options.agentType,
      this.coordinationDir
    );
    
    this.lockManager = new FileLockManager(this.locksDir, this.identity);
    this.activityLogger = new ActivityLogger(
      this.logsDir,
      this.identity,
      options.maxLogEntries || 1000
    );
    
    this.registered = false;
  }

  /**
   * Initialize the coordination session
   */
  async initialize(): Promise<void> {
    // Create coordination directories
    await fs.mkdir(this.coordinationDir, { recursive: true });
    await fs.mkdir(this.locksDir, { recursive: true });
    await fs.mkdir(this.logsDir, { recursive: true });

    // Register this agent
    await this.identity.register();
    this.registered = true;

    // Log session start
    await this.activityLogger.log('task_start', `Agent session initialized`, {
      metadata: {
        agentType: this.identity.info.type,
        sessionId: this.identity.info.sessionId,
      },
    });
  }

  /**
   * Clean up and end the coordination session
   */
  async cleanup(): Promise<void> {
    // Release all locks
    await this.lockManager.releaseAll();

    // Log session end
    await this.activityLogger.log('task_complete', `Agent session ended`);

    // Unregister this agent
    if (this.registered) {
      await this.identity.unregister();
      this.registered = false;
    }
  }

  /**
   * Acquire a lock on a resource
   */
  async acquireLock(resource: string, options?: LockOptions): Promise<boolean> {
    const acquired = await this.lockManager.acquire(resource, options);
    if (acquired) {
      await this.activityLogger.log('lock_acquire', `Acquired lock`, { resource });
    }
    return acquired;
  }

  /**
   * Release a held lock
   */
  async releaseLock(resource: string): Promise<void> {
    await this.lockManager.release(resource);
    await this.activityLogger.log('lock_release', `Released lock`, { resource });
  }

  /**
   * Check if a resource is locked
   */
  async isLocked(resource: string): Promise<boolean> {
    return this.lockManager.isLocked(resource);
  }

  /**
   * Get lock information for a resource
   */
  async getLockInfo(resource: string) {
    return this.lockManager.getLockInfo(resource);
  }

  /**
   * Log a file operation
   */
  async logFileOperation(
    operation: 'read' | 'write' | 'delete',
    filePath: string,
    description?: string
  ): Promise<ActivityEntry> {
    switch (operation) {
      case 'read':
        return this.activityLogger.logFileRead(filePath, description);
      case 'write':
        return this.activityLogger.logFileWrite(filePath, description);
      case 'delete':
        return this.activityLogger.log('file_delete', description || `Deleted file: ${filePath}`, { resource: filePath });
    }
  }

  /**
   * Log a command execution
   */
  async logCommand(command: string, description?: string): Promise<ActivityEntry> {
    return this.activityLogger.logCommand(command, description);
  }

  /**
   * Log a task start
   */
  async logTaskStart(taskName: string, description?: string): Promise<ActivityEntry> {
    return this.activityLogger.logTaskStart(taskName, description);
  }

  /**
   * Log a task completion
   */
  async logTaskComplete(taskName: string, description?: string): Promise<ActivityEntry> {
    return this.activityLogger.logTaskComplete(taskName, description);
  }

  /**
   * Log an error
   */
  async logError(error: string, description?: string): Promise<ActivityEntry> {
    return this.activityLogger.logError(error, description);
  }

  /**
   * Send a message to other agents
   */
  async sendMessage(message: string, metadata?: Record<string, unknown>): Promise<ActivityEntry> {
    return this.activityLogger.logMessage(message, metadata);
  }

  /**
   * Get messages from other agents
   */
  async getMessages(since?: string): Promise<ActivityEntry[]> {
    return this.activityLogger.getMessagesFromOtherAgents(since);
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(filter?: ActivityFilter): Promise<ActivityEntry[]> {
    return this.activityLogger.getRecent(filter);
  }

  /**
   * Get session status
   */
  async getStatus(): Promise<SessionStatus> {
    const activeAgents = await AgentIdentity.getActiveAgents(this.coordinationDir);
    const recentActivity = await this.activityLogger.getRecent({ limit: 100 });

    return {
      activeAgents,
      heldLocks: [], // Would need to track internally
      recentActivityCount: recentActivity.length,
      startedAt: this.identity.info.startedAt,
    };
  }

  /**
   * Get coordination directory path
   */
  getCoordinationDir(): string {
    return this.coordinationDir;
  }

  /**
   * Get agent identity
   */
  getIdentity(): AgentIdentity {
    return this.identity;
  }
}
