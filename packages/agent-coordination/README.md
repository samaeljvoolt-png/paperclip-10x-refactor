# Agent Coordination Module

Coordination primitives for multiple AI agents (Codex, Gemini, Claude, etc.) working concurrently in the same repository session.

## Purpose

When multiple AI agents work in the same codebase simultaneously, they need to:
- **Avoid file collisions** - Don't edit the same file at the same time
- **Track activity** - Know what other agents are doing
- **Communicate** - Leave messages for other agents
- **Coordinate tasks** - Divide work without overlap

## Quick Start

```typescript
import { AgentSession } from '@paperclipai/agent-coordination';

// Initialize session for Codex
const session = new AgentSession({
  agentType: 'codex',
  agentName: 'Codex CLI',
});

await session.initialize();

// Acquire lock before editing a file
await session.acquireLock('src/components/NewIssueDialog.tsx');

// ... edit the file ...

// Release lock when done
await session.releaseLock('src/components/NewIssueDialog.tsx');

// Log what you did
await session.logFileOperation('write', 'src/components/NewIssueDialog.tsx', 'Added validation logic');

// Send message to other agents
await session.sendMessage('Finished updating NewIssueDialog.tsx, ready for review');

// Check for messages from other agents
const messages = await session.getMessages();

// Cleanup when done
await session.cleanup();
```

## Features

### File Locking

Prevents multiple agents from editing the same file simultaneously:

```typescript
// Try to acquire lock (waits up to 5 seconds by default)
const acquired = await session.acquireLock('path/to/file.ts', {
  timeout: 5000,      // Wait time for lock
  ttl: 30000,         // Lock expires after 30s without refresh
  pollInterval: 100,  // Check every 100ms
});

if (acquired) {
  // Safe to edit
  await editFile();
  await session.releaseLock('path/to/file.ts');
} else {
  // Another agent is editing, check who
  const lockInfo = await session.getLockInfo('path/to/file.ts');
  console.log(`Locked by: ${lockInfo.agentId}`);
}
```

### Activity Logging

Track all agent actions for coordination and debugging:

```typescript
// Log different types of activities
await session.logTaskStart('refactor-auth', 'Refactoring authentication module');
await session.logFileRead('src/auth.ts');
await session.logFileWrite('src/auth.ts', 'Added JWT support');
await session.logCommand('pnpm test', 'Running tests');
await session.logTaskComplete('refactor-auth');

// Get recent activity
const activity = await session.getRecentActivity({
  limit: 50,
  type: 'file_write',
});
```

### Inter-Agent Communication

Leave messages for other agents:

```typescript
// Send a message
await session.sendMessage('Starting work on auth module', {
  priority: 'high',
  estimatedDuration: '10 minutes',
});

// Check for messages from other agents
const messages = await session.getMessages();
for (const msg of messages) {
  console.log(`${msg.agentId}: ${msg.description}`);
}
```

### Agent Discovery

See what other agents are active:

```typescript
const status = await session.getStatus();
console.log('Active agents:', status.activeAgents);
// {
//   'codex:abc123': { type: 'codex', name: 'Codex CLI', ... },
//   'gemini:def456': { type: 'gemini', name: 'Gemini', ... }
// }
```

## Architecture

```
.agent-coordination/
├── active-agents.json    # Registered agents
├── locks/                # Lock files
│   ├── src_components_NewIssueDialog.tsx.lock
│   └── ...
└── logs/
    └── activity.jsonl    # Activity log
```

## Lock File Format

```json
{
  "agentId": "codex:abc123",
  "acquiredAt": "2026-03-22T12:00:00.000Z",
  "expiresAt": "2026-03-22T12:00:30.000Z",
  "resource": "src/components/NewIssueDialog.tsx"
}
```

## Activity Log Format

Each line in `activity.jsonl`:

```json
{
  "id": "codex:abc123:1234567890",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "agentId": "codex:abc123",
  "type": "file_write",
  "resource": "src/components/NewIssueDialog.tsx",
  "description": "Added validation logic",
  "metadata": {}
}
```

## Best Practices

1. **Always acquire locks before editing files**
2. **Release locks promptly** - Don't hold locks longer than necessary
3. **Log significant actions** - Help other agents understand what you're doing
4. **Check for messages** - Other agents may have important information
5. **Use descriptive descriptions** - Make activity logs useful for debugging

## Integration Examples

### Codex CLI

```bash
# In .codex/agent-coordination.js
import { AgentSession } from '@paperclipai/agent-coordination';

const session = new AgentSession({
  agentType: 'codex',
  agentName: 'Codex CLI',
});

await session.initialize();

// Hook into file operations
const originalWriteFile = writeFile;
writeFile = async (path, content) => {
  await session.acquireLock(path);
  try {
    await session.logFileOperation('write', path);
    return await originalWriteFile(path, content);
  } finally {
    await session.releaseLock(path);
  }
};

process.on('exit', () => session.cleanup());
```

### Gemini

```javascript
// In gemini setup
import { AgentSession } from '@paperclipai/agent-coordination';

const session = new AgentSession({
  agentType: 'gemini',
  agentName: 'Gemini',
});

await session.initialize();

// Before starting work
await session.logTaskStart('feature-name', 'Description');

// Check if files are being edited by others
if (await session.isLocked('src/file.ts')) {
  // Wait or work on something else
}
```

## API Reference

### AgentSession

| Method | Description |
|--------|-------------|
| `initialize()` | Start coordination session |
| `cleanup()` | End session, release locks |
| `acquireLock(resource, options?)` | Acquire lock on resource |
| `releaseLock(resource)` | Release held lock |
| `isLocked(resource)` | Check if resource is locked |
| `getLockInfo(resource)` | Get lock details |
| `logFileOperation(op, path, desc?)` | Log file operation |
| `logCommand(cmd, desc?)` | Log command execution |
| `logTaskStart(name, desc?)` | Log task start |
| `logTaskComplete(name, desc?)` | Log task completion |
| `logError(error, desc?)` | Log error |
| `sendMessage(msg, metadata?)` | Send message to agents |
| `getMessages(since?)` | Get messages from others |
| `getRecentActivity(filter?)` | Get activity log |
| `getStatus()` | Get session status |

### LockOptions

| Option | Default | Description |
|--------|---------|-------------|
| `timeout` | 5000 | Max wait time for lock (ms) |
| `pollInterval` | 100 | Lock check interval (ms) |
| `ttl` | 30000 | Lock expiration time (ms) |

### ActivityFilter

| Option | Description |
|--------|-------------|
| `agentId` | Filter by agent |
| `type` | Filter by activity type |
| `resourcePattern` | Filter by resource |
| `since` | Entries after timestamp |
| `limit` | Max entries to return |
