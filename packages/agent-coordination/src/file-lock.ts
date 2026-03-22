import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentIdentity } from './agent-identity.js';

export interface LockOptions {
  /** Timeout in ms to wait for acquiring the lock (default: 5000) */
  timeout?: number;
  /** Polling interval in ms (default: 100) */
  pollInterval?: number;
  /** Lock expires after this many ms if holder doesn't refresh (default: 30000) */
  ttl?: number;
}

export interface LockInfo {
  /** Agent ID holding the lock */
  agentId: string;
  /** When the lock was acquired */
  acquiredAt: string;
  /** When the lock expires */
  expiresAt: string;
  /** Resource being locked */
  resource: string;
}

interface LockFile {
  agentId: string;
  acquiredAt: string;
  expiresAt: string;
  resource: string;
}

export class FileLockManager {
  private readonly locksDir: string;
  private readonly agentIdentity: AgentIdentity;
  private readonly heldLocks: Map<string, NodeJS.Timeout>;

  constructor(locksDir: string, agentIdentity: AgentIdentity) {
    this.locksDir = locksDir;
    this.agentIdentity = agentIdentity;
    this.heldLocks = new Map();
  }

  /**
   * Acquire a lock on a resource (file, directory, or logical resource)
   */
  async acquire(resource: string, options: LockOptions = {}): Promise<boolean> {
    const {
      timeout = 5000,
      pollInterval = 100,
      ttl = 30000,
    } = options;

    const lockFile = path.join(this.locksDir, `${this.encodeResource(resource)}.lock`);
    const startTime = Date.now();
    const agentId = this.agentIdentity.id;

    while (Date.now() - startTime < timeout) {
      try {
        // Try to create lock file atomically
        const lockData: LockFile = {
          agentId,
          acquiredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl).toISOString(),
          resource,
        };

        await fs.mkdir(this.locksDir, { recursive: true });
        await fs.writeFile(lockFile, JSON.stringify(lockData), { flag: 'wx' });

        // Start auto-refresh timer
        const refreshInterval = ttl / 3;
        const timer = setInterval(async () => {
          await this.refreshLock(lockFile, resource, ttl);
        }, refreshInterval);

        this.heldLocks.set(resource, timer);

        return true;
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock exists, check if it's stale or wait
          const isStale = await this.checkStaleLock(lockFile);
          if (isStale) {
            // Remove stale lock and retry
            await fs.unlink(lockFile).catch(() => {});
            continue;
          }
          // Wait and retry
          await this.sleep(pollInterval);
        } else {
          throw error;
        }
      }
    }

    return false; // Timeout
  }

  /**
   * Release a held lock
   */
  async release(resource: string): Promise<void> {
    const lockFile = path.join(this.locksDir, `${this.encodeResource(resource)}.lock`);
    
    // Clear refresh timer
    const timer = this.heldLocks.get(resource);
    if (timer) {
      clearInterval(timer);
      this.heldLocks.delete(resource);
    }

    await fs.unlink(lockFile).catch(() => {});
  }

  /**
   * Release all held locks
   */
  async releaseAll(): Promise<void> {
    const resources = Array.from(this.heldLocks.keys());
    await Promise.all(resources.map(r => this.release(r)));
  }

  /**
   * Check if a resource is currently locked and get lock info
   */
  async getLockInfo(resource: string): Promise<LockInfo | null> {
    const lockFile = path.join(this.locksDir, `${this.encodeResource(resource)}.lock`);
    try {
      const content = await fs.readFile(lockFile, 'utf-8');
      return JSON.parse(content) as LockInfo;
    } catch {
      return null;
    }
  }

  /**
   * Check if a resource is currently locked
   */
  async isLocked(resource: string): Promise<boolean> {
    const lockInfo = await this.getLockInfo(resource);
    if (!lockInfo) return false;
    
    // Check if lock is expired
    if (new Date(lockInfo.expiresAt) < new Date()) {
      return false;
    }
    
    return true;
  }

  private async checkStaleLock(lockFile: string): Promise<boolean> {
    try {
      const content = await fs.readFile(lockFile, 'utf-8');
      const lockData = JSON.parse(content) as LockFile;
      
      // Lock is stale if expired
      return new Date(lockData.expiresAt) < new Date();
    } catch {
      return true; // File doesn't exist or is corrupted
    }
  }

  private async refreshLock(lockFile: string, resource: string, ttl: number): Promise<void> {
    try {
      const content = await fs.readFile(lockFile, 'utf-8');
      const lockData = JSON.parse(content) as LockFile;
      
      // Only refresh if we still hold the lock
      if (lockData.agentId !== this.agentIdentity.id) {
        return;
      }

      lockData.expiresAt = new Date(Date.now() + ttl).toISOString();
      await fs.writeFile(lockFile, JSON.stringify(lockData));
    } catch {
      // Lock was lost or file doesn't exist
    }
  }

  private encodeResource(resource: string): string {
    // Convert file path to safe filename
    return resource.replace(/[/\\:]/g, '_');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
