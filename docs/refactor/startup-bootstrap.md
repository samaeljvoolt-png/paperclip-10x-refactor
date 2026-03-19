# Startup Bootstrap

`server/src/index.ts` used to hold the entire startup sequence inline. The refactor split that flow into smaller bootstrap modules so each responsibility can be tested and reviewed independently.

## Current Startup Flow

1. Load config.
2. Resolve the database connection and migrations.
3. Validate the deployment mode.
4. Initialize authenticated-mode wiring when needed.
5. Build the app.
6. Register live events.
7. Start the heartbeat scheduler.
8. Start the database backup scheduler.
9. Start the HTTP listener and print the startup banner.

## Bootstrap Modules

### `server/src/bootstrap/deployment-config.ts`

- Exports `assertValidDeploymentConfig(config)`.
- Purpose: guard deployment-mode invariants before the rest of startup continues.
- Coverage: validates `local_trusted` loopback/private constraints and `authenticated/public` constraints.

### `server/src/bootstrap/authenticated-mode.ts`

- Exports `resolveAuthenticatedModeSecret()`, `resolveEnvTrustedOrigins()`, and `bootstrapAuthenticatedMode()`.
- Purpose: isolate authenticated-mode auth setup from the rest of startup.
- Responsibilities:
  - validate the auth secret,
  - resolve trusted origins,
  - construct Better Auth handlers and session resolvers,
  - initialize the board-claim challenge.

### `server/src/bootstrap/heartbeat-scheduler.ts`

- Exports `setupHeartbeatScheduler()`.
- Purpose: isolate periodic heartbeat recovery and timer ticking from startup orchestration.
- Behavior:
  - reaps orphaned runs at startup,
  - resumes queued runs,
  - schedules periodic ticks,
  - returns a cleanup function for shutdown or failure rollback.

### `server/src/bootstrap/database-backup-scheduler.ts`

- Exports `setupDatabaseBackupScheduler()`.
- Purpose: isolate periodic backup scheduling from startup orchestration.
- Behavior:
  - schedules backups only when enabled,
  - prevents overlapping backup execution,
  - returns a cleanup function for shutdown or failure rollback.

### `server/src/bootstrap/server-listener.ts`

- Exports `startServerListener()`.
- Purpose: own the final listen step, banner printing, and board-claim warning output.
- Behavior:
  - binds the server,
  - optionally opens a browser when enabled,
  - prints the startup banner,
  - emits the one-time board-claim URL when applicable.

## Important Guarantees

- Schedulers now return cleanup handles, so startup failures can unwind cleanly.
- The listener is a dedicated seam, which makes the open-browser branch testable.
- The orchestration smoke test covers the composition of `startServer()`, not just the individual helpers.

## Files To Watch

- `server/src/index.ts`
- `server/src/bootstrap/**`
- `server/src/__tests__/start-server-orchestration.test.ts`

## What This Doc Does Not Claim

- It does not claim that heartbeat is performance-optimized.
- It does not claim that the runtime has a production benchmark baseline yet.
- It does not claim the refactor is finished; it only explains the current bootstrap decomposition.
