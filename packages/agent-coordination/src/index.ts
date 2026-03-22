/**
 * Agent Coordination Module
 * 
 * Provides coordination primitives for multiple AI agents (Codex, Gemini, Claude, etc.)
 * working concurrently in the same repository session.
 */

export { AgentSession, type AgentSessionOptions } from './agent-session.js';
export { FileLockManager, type LockOptions, type LockInfo } from './file-lock.js';
export { ActivityLogger, type ActivityEntry, type ActivityFilter } from './activity-logger.js';
export { AgentIdentity, type AgentMetadata } from './agent-identity.js';
