# Heartbeat Live Baseline

This document records a real Wave 4 measurement captured through the heartbeat profiling seam.

## Scenario 1: Minimal Process Adapter

- Database: embedded PostgreSQL
- Agent adapter: `process`
- Command: `bash -lc "printf 'baseline run\n'"`
- Wake source: `on_demand`
- Runtime result: `succeeded`

## Observed Spans

| Span | Duration (ms) | Notes |
|---|---:|---|
| `startNextQueuedRunForAgent` | `49.7095` | First queue-to-run handoff |
| `resolveWorkspaceForRun` | `0.6954` | Fallback workspace path, no project workspace required |
| `startNextQueuedRunForAgent` | `2.8087` | Post-run reschedule path |
| `executeRun` | `1196.4210` | Dominant runtime cost in this scenario |

## What This Baseline Shows

- `resolveWorkspaceForRun()` is cheap in the empty project path.
- `executeRun()` dominates total latency even for a minimal `process` adapter run.
- `startNextQueuedRunForAgent()` has a non-trivial first-pass cost, but most of the observed time in this scenario still sits inside `executeRun()`.

## What This Baseline Does Not Show

- It does not represent a production workload with concurrent queue pressure or user-facing traffic.
- It does not measure tail latency under concurrent queue pressure.
- It does not isolate every branch inside `executeRun()`.

## Next Measurement Targets

1. a before/after comparison if any optimization is proposed
2. a rollback note for the final Wave 4 decision
3. a final decision on whether Wave 4 should remain observability-only

## Scenario 2: Project-Scoped Process Adapter

- Database: embedded PostgreSQL
- Agent adapter: `process`
- Command: `bash -lc "printf 'project baseline run\n'"`
- Workspace: project-scoped workspace backed by a real git checkout
- Issue: project-linked issue with `executionWorkspaceSettings.mode = "shared_workspace"`
- Wake source: `on_demand`
- Runtime result: `succeeded`

## Observed Spans

| Span | Duration (ms) | Notes |
|---|---:|---|
| `startNextQueuedRunForAgent` | `11.7828` | First queue-to-run handoff |
| `resolveWorkspaceForRun` | `2.7760` | Project workspace resolved through `projectWorkspaces` |
| `startNextQueuedRunForAgent` | `3.2195` | Post-run reschedule path |
| `executeRun` | `659.1219` | Dominant runtime cost in this scenario |

## What This Baseline Adds

- `resolveWorkspaceForRun()` remains cheap even with a project-linked workspace.
- `executeRun()` is still the dominant runtime cost, but the project-scoped path is materially faster than the minimal baseline in this fixture.
- The project-scoped baseline validates the workspace-resolution path that matters for real project work.

## Scenario 3: Maintenance Baseline

- Database: embedded PostgreSQL
- Agents: three process adapters
- Workload: one orphaned running run, one queued run, one timer-victim agent with stale heartbeat
- Maintenance actions: `reapOrphanedRuns()`, `resumeQueuedRuns()`, `tickTimers()`
- Runtime result: all follow-up runs succeeded or failed as expected

## Observed Spans

| Span | Duration (ms) | Notes |
|---|---:|---|
| `reapOrphanedRuns` | `24.6617` | Reaped one orphaned run and queued the next handoff |
| `resumeQueuedRuns` | `12.8180` | Resumed one queued run |
| `tickTimers` | `70.8830` | Checked 3 agents and enqueued 1 timer run |
| `executeRun` | `1016.6197` | Maintenance follow-up run cost for the resumed agent |
| `executeRun` | `873.8162` | Maintenance follow-up run cost for the timer agent |

## What This Baseline Adds

- `reapOrphanedRuns()` is measurable and remains much cheaper than `executeRun()`.
- `resumeQueuedRuns()` is also modest relative to command execution.
- `tickTimers()` has a clear, bounded overhead in this fixture and is not the dominant cost.
- The remaining unknowns are contention under multiple queued runs and any optimization tradeoff versus code complexity.

## Scenario 4: Queue Contention Baseline

- Database: embedded PostgreSQL
- Agent adapter: `process`
- Workload: three queued runs for the same agent
- Action: a single `resumeQueuedRuns()` call
- Runtime result: all three runs succeeded sequentially

## Observed Spans

| Span | Duration (ms) | Notes |
|---|---:|---|
| `resumeQueuedRuns` | `9.3861` | Single entrypoint for the queue drain |
| `startNextQueuedRunForAgent` | `8.5812` | Initial claim and launch |
| `startNextQueuedRunForAgent` | `17.1121` | Second run launched after the first finished |
| `startNextQueuedRunForAgent` | `9.3127` | Third run launched after the second finished |
| `executeRun` | `654.2805` | First run body |
| `executeRun` | `642.3578` | Second run body |
| `executeRun` | `768.7624` | Third run body |

## What This Baseline Adds

- Queue drainage is sequential in the single-agent fixture, as expected.
- The orchestration spans are measurable but much smaller than the adapter execution spans.
- There is still no evidence here that a more complex queue scheduler would be worth the added complexity.
