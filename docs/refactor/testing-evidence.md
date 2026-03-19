# Testing Evidence

This document records the evidence currently used to validate the refactor.

## Workspace Commands

- `pnpm -r typecheck`
- `pnpm test:run`
- `pnpm build`

## Targeted Server Checks

- `server/src/__tests__/public-url.test.ts`
- `server/src/__tests__/deployment-config.test.ts`
- `server/src/__tests__/authenticated-mode.test.ts`
- `server/src/__tests__/heartbeat-scheduler.test.ts`
- `server/src/__tests__/heartbeat-profiler.test.ts`
- `server/src/__tests__/heartbeat-baseline.test.ts`
- `server/src/__tests__/heartbeat-live-baseline.test.ts`
- `server/src/__tests__/database-backup-scheduler.test.ts`
- `server/src/__tests__/server-listener.test.ts`
- `server/src/__tests__/start-server-orchestration.test.ts`

## What These Tests Prove

- public URL precedence and fallback behavior
- deployment-mode validation
- authenticated-mode secret and trusted-origin wiring
- heartbeat scheduler startup recovery and cleanup
- heartbeat profiling wrapper semantics
- empty-state heartbeat baseline harness
- real embedded-Postgres heartbeat baseline harness
- database backup scheduler wiring and cleanup
- listener startup, banner output, and browser-open seam
- `startServer()` orchestration across bootstrap modules

## What The Suite Still Does Not Prove

- runtime performance of `heartbeatService`
- production benchmark data from the profiling seam
- a real embedded-Postgres baseline exists for the minimal `process` adapter scenario
- measured empty-state baseline from the harness is only a proxy, not production data
- production latency of `resolveWorkspaceForRun()`
- full end-to-end adapter execution across every deployment mode
- real-world throughput under load

## How To Read The Evidence

- Passing helper tests means the wiring is correct at the unit level.
- Passing the orchestration smoke means the startup path is composed correctly.
- Passing the workspace commands means the repo still builds and tests after the refactor.
- The final Wave 5 closeout also records the release-readiness summary and the current boundary of what the suite does and does not prove.
- None of these alone prove runtime performance or production scaling behavior.
