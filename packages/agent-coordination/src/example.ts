#!/usr/bin/env node
/**
 * Example: How to use Agent Coordination in your code
 * 
 * This example shows how Codex and Gemini can work together
 * without file collisions.
 */

import { AgentSession } from './agent-session.js';

async function exampleCodex() {
  console.log('=== Codex Agent Example ===\n');

  // Initialize session
  const session = new AgentSession({
    agentType: 'codex',
    agentName: 'Codex CLI',
  });

  await session.initialize();
  console.log('✓ Session initialized');

  try {
    // Check for messages from other agents
    const messages = await session.getMessages();
    if (messages.length > 0) {
      console.log('Messages from other agents:');
      for (const msg of messages) {
        console.log(`  - ${msg.description}`);
      }
    }

    // Start working on a task
    await session.logTaskStart('update-component', 'Updating NewIssueDialog component');

    // Acquire lock before editing
    const fileToEdit = 'ui/src/components/NewIssueDialog.tsx';
    console.log(`Acquiring lock on: ${fileToEdit}`);

    const acquired = await session.acquireLock(fileToEdit);
    if (!acquired) {
      const lockInfo = await session.getLockInfo(fileToEdit);
      console.log(`File is locked by ${lockInfo?.agentId}, waiting...`);
      // Could wait and retry, or work on something else
      return;
    }

    try {
      // Do the actual work
      console.log('Editing file...');
      // ... edit file code here ...

      // Log the change
      await session.logFileOperation('write', fileToEdit, 'Added validation logic');

      // Send message for other agents
      await session.sendMessage(
        'Finished updating NewIssueDialog.tsx with validation logic',
        { affectedFiles: [fileToEdit], status: 'complete' }
      );

      console.log('✓ Work complete');
    } finally {
      // Always release the lock
      await session.releaseLock(fileToEdit);
      console.log('✓ Lock released');
    }

    // Mark task complete
    await session.logTaskComplete('update-component');

  } finally {
    // Cleanup when done
    await session.cleanup();
    console.log('✓ Session cleaned up');
  }
}

async function exampleGemini() {
  console.log('\n=== Gemini Agent Example ===\n');

  const session = new AgentSession({
    agentType: 'gemini',
    agentName: 'Gemini',
  });

  await session.initialize();

  try {
    // Check what Codex is doing
    const activity = await session.getRecentActivity({
      type: 'file_write',
      limit: 10,
    });

    console.log('Recent file modifications:');
    for (const entry of activity) {
      console.log(`  - ${entry.resource}: ${entry.description}`);
    }

    // Check for messages
    const messages = await session.getMessages();
    console.log('\nMessages:');
    for (const msg of messages) {
      console.log(`  [${msg.agentId}] ${msg.description}`);
    }

    // Work on a different file
    const fileToEdit = 'ui/src/components/MarkdownEditor.tsx';

    if (await session.isLocked(fileToEdit)) {
      console.log(`${fileToEdit} is locked, working on something else...`);
      return;
    }

    await session.acquireLock(fileToEdit);

    try {
      console.log(`Editing ${fileToEdit}...`);
      // ... edit file code here ...

      await session.logFileOperation('write', fileToEdit);

    } finally {
      await session.releaseLock(fileToEdit);
    }

  } finally {
    await session.cleanup();
  }
}

// Run examples
async function main() {
  const agent = process.argv[2] || 'codex';

  if (agent === 'codex') {
    await exampleCodex();
  } else if (agent === 'gemini') {
    await exampleGemini();
  } else {
    console.log('Usage: node example.js [codex|gemini]');
  }
}

main().catch(console.error);
