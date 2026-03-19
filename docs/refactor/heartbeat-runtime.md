# Heartbeat Runtime

This document describes the current heartbeat runtime surface and the parts that still need measurement.

## Where The Runtime Lives

- `server/src/services/heartbeat.ts`

## What The Runtime Does

The heartbeat service owns:

- wakeup enqueueing,
- queued run claiming,
- run execution,
- workspace resolution,
- runtime state updates,
- lifecycle cleanup,
- orphan reaping,
- timer sweeps,
- and budget-based cancellation.

## High-Risk Subpaths

### `resolveWorkspaceForRun()`

- Chooses the workspace used for a run.
- Mixes DB lookup, filesystem checks, and managed git clone fallback.
- This is a likely latency hotspot because it can cross DB and filesystem boundaries in one decision path.

### `startNextQueuedRunForAgent()`

- Claims queued runs up to policy limits.
- Uses an agent-level lock to avoid duplicate starts.
- This path is sensitive to concurrency and queue fairness.

### `executeRun()`

- The main runtime path.
- Handles:
  - agent load,
  - issue context,
  - session resolution,
  - workspace realization,
  - runtime service setup,
  - adapter execution,
  - log capture,
  - final status writes,
  - runtime state updates,
  - and post-run cleanup.

### `reapOrphanedRuns()`

- Scans running runs and marks orphaned executions as failed.
- Sensitive to startup timing and in-memory process state.

### `resumeQueuedRuns()`

- Resumes queued work after recovery.
- Needs to remain in sync with the scheduler and the queue-claim logic.

### `tickTimers()`

- Scans agents and triggers wakeups based on interval policies.
- This is an `O(n)` background sweep and a good place to measure growth costs.

## What Was Done In Wave 4

- Added a startup smoke for `startServer()` orchestration.
- Fixed scheduler lifecycle so the heartbeat and backup schedulers can be cleaned up.
- Kept the runtime logic unchanged while improving testability around the startup path.
- Added an optional heartbeat profiling seam that can log span timing when `PAPERCLIP_HEARTBEAT_PROFILE` is enabled.
- Applied a low-risk `tickTimers()` optimization by filtering eligible agents in SQL and projecting only the columns needed for the sweep.

## What Still Needs Measurement

The next useful measurements are:

1. time spent in `resolveWorkspaceForRun()`
2. time spent in `startNextQueuedRunForAgent()`
3. time spent in `executeRun()`
4. time spent in `reapOrphanedRuns()`
5. time spent in `tickTimers()`
6. contention under multiple queued runs for the same agent

## Live Baseline

A real baseline run was captured with the profiling seam enabled on a minimal `process` adapter scenario, followed by a project-scoped `process` run that exercised `projectWorkspaces` and `issues`, plus a maintenance and queue-contention baseline for scheduled recovery paths. The observed timings are documented in [heartbeat-live-baseline.md](/Users/tomasvallejo/Desktop/paperclip/docs/refactor/heartbeat-live-baseline.md).

## Recommended Next Documentation Additions

- A phase-by-phase timing table for `executeRun()`
- A wakeup decision diagram for enqueue/coalescing
- A workspace resolution decision tree
- A cleanup/shutdown note for scheduler lifecycle

## Tests That Matter Here

- `server/src/__tests__/heartbeat-workspace-session.test.ts`
- `server/src/__tests__/heartbeat-run-summary.test.ts`
- `server/src/__tests__/heartbeat-scheduler.test.ts`
- `server/src/__tests__/start-server-orchestration.test.ts`

## What This Doc Does Not Claim

- It does not claim the heartbeat runtime is fully optimized.
- It does not claim a production benchmark baseline exists yet.
- It does not claim the profiling seam is enabled by default.
- It does not claim that every subpath has end-to-end integration coverage.
