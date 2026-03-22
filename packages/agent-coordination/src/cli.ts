#!/usr/bin/env node
/**
 * Agent Coordination CLI
 * 
 * Utility for AI agents to coordinate work in shared sessions.
 * 
 * Usage:
 *   pnpm agent-coord status              # Check active agents and locks
 *   pnpm agent-coord lock <file>         # Acquire lock on a file
 *   pnpm agent-coord unlock <file>       # Release lock on a file
 *   pnpm agent-coord locked <file>       # Check if file is locked
 *   pnpm agent-coord message <text>      # Send message to other agents
 *   pnpm agent-coord messages            # Get messages from other agents
 *   pnpm agent-coord activity            # Show recent activity
 *   pnpm agent-coord log <text>          # Log a custom activity
 * 
 * Environment:
 *   AGENT_TYPE - Your agent type (e.g., 'codex', 'gemini')
 *   AGENT_NAME - Your agent name (optional)
 */

import { AgentSession } from './agent-session.js';

const COORDINATION_DIR = process.env.AGENT_COORDINATION_DIR || '.agent-coordination';
const AGENT_TYPE = process.env.AGENT_TYPE || 'unknown';
const AGENT_NAME = process.env.AGENT_NAME || AGENT_TYPE;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const session = new AgentSession({
    agentType: AGENT_TYPE,
    agentName: AGENT_NAME,
    coordinationDir: COORDINATION_DIR,
  });

  try {
    switch (command) {
      case 'status':
        await showStatus(session);
        break;
      case 'lock':
        await acquireLock(session, args[1]);
        break;
      case 'unlock':
        await releaseLock(session, args[1]);
        break;
      case 'locked':
        await checkLocked(session, args[1]);
        break;
      case 'message':
        await sendMessage(session, args.slice(1).join(' '));
        break;
      case 'messages':
        await getMessages(session);
        break;
      case 'activity':
        await showActivity(session, args[1] ? parseInt(args[1]) : 20);
        break;
      case 'log':
        await logActivity(session, args.slice(1).join(' '));
        break;
      case 'init':
        await initSession(session);
        break;
      case 'cleanup':
        await cleanupSession(session);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showStatus(session: AgentSession) {
  const status = await session.getStatus();

  console.log('=== Agent Coordination Status ===\n');

  console.log('Active Agents:');
  const agents = Object.values(status.activeAgents);
  if (agents.length === 0) {
    console.log('  (none)');
  } else {
    for (const agent of agents) {
      console.log(`  - ${agent.name} (${agent.type}) [${agent.sessionId.slice(0, 8)}...]`);
    }
  }

  console.log('\nSession Started:', status.startedAt);
  console.log('Recent Activity Entries:', status.recentActivityCount);
}

async function acquireLock(session: AgentSession, resource: string) {
  if (!resource) {
    console.error('Usage: agent-coord lock <resource>');
    process.exit(1);
  }

  console.log(`Acquiring lock on: ${resource}`);
  const acquired = await session.acquireLock(resource, { timeout: 3000 });

  if (acquired) {
    console.log('✓ Lock acquired');
  } else {
    const lockInfo = await session.getLockInfo(resource);
    if (lockInfo) {
      console.log('✗ Lock held by:', lockInfo.agentId);
      console.log('  Acquired at:', lockInfo.acquiredAt);
      console.log('  Expires at:', lockInfo.expiresAt);
    } else {
      console.log('✗ Could not acquire lock');
    }
    process.exit(1);
  }
}

async function releaseLock(session: AgentSession, resource: string) {
  if (!resource) {
    console.error('Usage: agent-coord unlock <resource>');
    process.exit(1);
  }

  await session.releaseLock(resource);
  console.log('✓ Lock released:', resource);
}

async function checkLocked(session: AgentSession, resource: string) {
  if (!resource) {
    console.error('Usage: agent-coord locked <resource>');
    process.exit(1);
  }

  const isLocked = await session.isLocked(resource);

  if (isLocked) {
    const lockInfo = await session.getLockInfo(resource);
    console.log('🔒 Locked by:', lockInfo?.agentId || 'unknown');
    console.log('  Expires:', lockInfo?.expiresAt || 'unknown');
    process.exit(1); // Exit with error to indicate locked
  } else {
    console.log('✓ Not locked');
  }
}

async function sendMessage(session: AgentSession, message: string) {
  if (!message) {
    console.error('Usage: agent-coord message <text>');
    process.exit(1);
  }

  await session.sendMessage(message);
  console.log('✓ Message sent');
}

async function getMessages(session: AgentSession) {
  const messages = await session.getMessages();

  console.log('=== Messages from Other Agents ===\n');

  if (messages.length === 0) {
    console.log('  (no messages)');
    return;
  }

  for (const msg of messages) {
    console.log(`[${msg.timestamp}] ${msg.agentId}:`);
    console.log(`  ${msg.description}`);
    if (msg.metadata && Object.keys(msg.metadata).length > 0) {
      console.log(`  Metadata:`, JSON.stringify(msg.metadata));
    }
    console.log();
  }
}

async function showActivity(session: AgentSession, limit: number) {
  const activity = await session.getRecentActivity({ limit });

  console.log(`=== Recent Activity (last ${limit}) ===\n`);

  if (activity.length === 0) {
    console.log('  (no activity)');
    return;
  }

  for (const entry of activity) {
    console.log(`[${entry.timestamp}] ${entry.type}`);
    console.log(`  Agent: ${entry.agentId}`);
    if (entry.resource) {
      console.log(`  Resource: ${entry.resource}`);
    }
    console.log(`  ${entry.description}`);
    console.log();
  }
}

async function logActivity(session: AgentSession, description: string) {
  if (!description) {
    console.error('Usage: agent-coord log <text>');
    process.exit(1);
  }

  await session.sendMessage(description);
  console.log('✓ Activity logged');
}

async function initSession(session: AgentSession) {
  await session.initialize();
  console.log('✓ Session initialized');
  console.log('  Agent ID:', session.getIdentity().id);
  console.log('  Coordination dir:', session.getCoordinationDir());
}

async function cleanupSession(session: AgentSession) {
  await session.cleanup();
  console.log('✓ Session cleaned up');
}

function showHelp() {
  console.log(`
Agent Coordination CLI

Usage:
  pnpm agent-coord <command> [arguments]

Commands:
  status              Show active agents and session status
  lock <resource>     Acquire lock on a file/resource
  unlock <resource>   Release lock on a file/resource
  locked <resource>   Check if a file/resource is locked
  message <text>      Send message to other agents
  messages            Get messages from other agents
  activity [count]    Show recent activity (default: 20)
  log <text>          Log a custom activity
  init                Initialize coordination session
  cleanup             Clean up and end session
  help                Show this help message

Environment Variables:
  AGENT_TYPE          Your agent type (e.g., 'codex', 'gemini')
  AGENT_NAME          Your agent name (optional)
  AGENT_COORDINATION_DIR  Coordination directory (default: .agent-coordination)

Examples:
  # Initialize session
  AGENT_TYPE=codex pnpm agent-coord init

  # Lock a file before editing
  AGENT_TYPE=codex pnpm agent-coord lock src/components/File.tsx

  # Send a message
  AGENT_TYPE=codex pnpm agent-coord message "Starting work on auth module"

  # Check status
  pnpm agent-coord status

  # See recent activity
  pnpm agent-coord activity 50
`);
}

main();
