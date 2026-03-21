# Paperclip Refactor Foundation Status

## Checkpoint 01
- `Phase/Wave`: `Wave 0`
- `Goal`: install the control system, the orchestration skill, and the base OpenClaw org
- `Status`: `Baseline verified`
- `Done`:
  - created the project control documents
  - versioned the `paperclip-refactor-orchestrator` skill
  - installed a live copy of the skill for OpenClaw
  - prepared the base four-agent org
  - locked the real fork baseline into the plan artifacts
- `Risks`:
  - the dedicated OpenAI key for the conductor must stay local to OpenClaw runtime and be rotated after this session
  - the original plan still needs to be reinterpreted against the fork before touching CI or env
- `Blockers`:
  - none for starting Wave 1
- `Next step`:
  - audit and reinterpret Wave 1 against the real state of CI, env, and fork bootstrap

## Checkpoint 02
- `Phase/Wave`: `Wave 1`
- `Goal`: align CI and the environment contract with the real fork state without breaking defaults or introducing false assumptions
- `Status`: `Wave 1 verified`
- `Done`:
  - `pr-verify` is now a pure gate for install, typecheck, tests, and build
  - removed the release-canary dry run from the PR gate
  - aligned `pr-verify` Node with the repo-supported baseline
  - `.env.example` now reflects the current runtime contract
  - expanded `docs/deploy/environment-variables.md` with real config, auth, storage, and backup variables
  - made it explicit that strict central env validation is not in scope yet
- `Risks`:
  - the current shell still lacks `pnpm`, so this wave cannot yet be closed with full local execution evidence
  - the docs are better aligned, but `config.ts` still mixes env, file, and defaults
- `Blockers`:
  - restore `pnpm` or an equivalent path to run the minimum local battery
- `Next step`:
  - resolve the local validation toolchain and move to Wave 2 on `access/onboarding`

## Checkpoint 03
- `Phase/Wave`: `Wave 2`
- `Goal`: harden onboarding and centralize public URL construction without waiting for the full `access` split
- `Status`: `Wave 2 verified`
- `Done`:
  - centralized public URL resolution in `server/src/utils/public-url.ts`
  - `access.ts` and `access-onboarding.ts` no longer duplicate public URL construction logic
  - precedence now favors `PAPERCLIP_AUTH_PUBLIC_BASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_BASE_URL`, and `PAPERCLIP_PUBLIC_URL`
  - added unit tests for the public URL utility
- `Risks`:
  - the header-based fallback still exists as legacy behavior when no public URL is configured
  - the larger `access` split is still incomplete
- `Blockers`:
  - none for the next incremental startup extraction
- `Next step`:
  - open Wave 3 with small, reversible cuts in `server/src/index.ts`

## Checkpoint 04
- `Phase/Wave`: `Wave 3`
- `Goal`: reduce coupling in `server/src/index.ts` with a safe and testable extraction
- `Status`: `Wave 3 in progress`
- `Done`:
  - extracted deployment-mode validation into `server/src/bootstrap/deployment-config.ts`
  - added dedicated unit tests for `local_trusted` and `authenticated/public`
  - `server/src/index.ts` now delegates that validation to an isolated module
- `Risks`:
  - `index.ts` and `heartbeat.ts` remain large hotspots
  - the rest of startup still mixes auth, database, scheduler, backups, and runtime env
- `Blockers`:
  - none immediate
- `Next step`:
  - extract the `authenticated` wiring into a small bootstrap module and revalidate the full matrix

## Checkpoint 05
- `Phase/Wave`: `Wave 3`
- `Goal`: keep decoupling startup with a reversible authentication bootstrap extraction
- `Status`: `Wave 3 checkpoint met`
- `Done`:
  - extracted authenticated-mode wiring into `server/src/bootstrap/authenticated-mode.ts`
  - `server/src/index.ts` no longer resolves Better Auth secrets, trusted origins, handlers, and session resolvers inline
  - added unit tests for required secrets, fallback to `PAPERCLIP_AGENT_JWT_SECRET`, and trusted-origin merging
  - the minimum workspace battery passed again: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Risks`:
  - `index.ts` and `heartbeat.ts` are still large hotspots
  - startup, runtime, backups, and scheduler still need clearer separation before Wave 3 can truly close
- `Blockers`:
  - none immediate
- `Next step`:
  - choose the next reversible cut between runtime env/listen bootstrap and the groundwork for Wave 4 in heartbeat

## Checkpoint 06
- `Phase/Wave`: `Wave 3`
- `Goal`: decouple the heartbeat and backup schedulers from the main bootstrap
- `Status`: `Wave 3 checkpoint met`
- `Done`:
  - extracted the heartbeat scheduler into `server/src/bootstrap/heartbeat-scheduler.ts`
  - extracted the backup scheduler into `server/src/bootstrap/database-backup-scheduler.ts`
  - `server/src/index.ts` now delegates both periodic behaviors
  - added unit tests for both helpers with wiring verification and no-op checks when disabled
  - the full matrix passed again: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Risks`:
  - `index.ts` still owns listen/startup banner/shutdown, so Wave 3 is not fully closed
  - deeper heartbeat runtime work is the main target for Wave 4
- `Blockers`:
  - none immediate
- `Next step`:
  - decide whether Wave 3 should extract the final listen/bootstrap seam or whether Wave 4 should start now

## Checkpoint 07
- `Phase/Wave`: `Wave 3`
- `Goal`: close the structural decomposition of the startup path
- `Status`: `Wave 3 closure verified`
- `Done`:
  - extracted the listen startup, startup banner, and board-claim warning into `server/src/bootstrap/server-listener.ts`
  - `server/src/index.ts` now only orchestrates bootstrap helpers instead of hosting the heavy operational blocks
  - added unit tests for the listener bootstrap and kept the full matrix green: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Risks`:
  - runtime still has temporal and recovery behavior that deserves its own measurement wave
  - `heartbeat.ts` remains a functional hotspot because of size, not lack of coverage
- `Blockers`:
  - none immediate
- `Next step`:
  - open Wave 4 on heartbeat runtime and capture a performance baseline before optimization

## Checkpoint 08
- `Phase/Wave`: `Wave 4`
- `Goal`: capture a real heartbeat runtime baseline and challenge confidence in the freshly refactored wiring
- `Status`: `Wave 4 in progress`
- `Done`:
  - activated the council to review earlier phases and prioritize real hotspots
  - fixed the scheduler lifecycle so it can be cleaned up on startup or shutdown failures
  - added a composition smoke for `startServer()` covering scheduler wiring and cleanup
  - the full matrix passed again: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- `Risks`:
  - there is still no real latency/throughput measurement for `heartbeatService`
  - `heartbeat.ts` remains the main hotspot by volume and complexity
- `Blockers`:
  - none immediate
- `Next step`:
  - instrument or isolate `resolveWorkspaceForRun` and `startNextQueuedRunForAgent` first so the baseline can be measured without changing semantics

## Checkpoint 09
- `Phase/Wave`: `Wave 4`
- `Goal`: prepare the profiling seam needed to capture a baseline without changing normal semantics
- `Status`: `Wave 4 profiling seam ready`
- `Done`:
  - added `server/src/services/heartbeat-profiler.ts` as an opt-in helper for measuring spans
  - `heartbeatService()` can now record timings for `reapOrphanedRuns`, `resumeQueuedRuns`, `startNextQueuedRunForAgent`, `resolveWorkspaceForRun`, `executeRun`, and `tickTimers`
  - added unit coverage for the profiling wrapper
  - documented `PAPERCLIP_HEARTBEAT_PROFILE` as the local measurement contract
- `Risks`:
  - the real baseline still depends on a run with the flag enabled
  - profiling logs can be noisy if left on outside a measurement session
- `Blockers`:
  - none
- `Next step`:
  - run a real measurement with profiling enabled and store the largest-span baseline

## Checkpoint 10
- `Phase/Wave`: `Wave 4`
- `Goal`: validate the baseline harness and make it ready for repeatable runs
- `Status`: `Wave 4 baseline harness verified`
- `Done`:
  - added `server/src/__tests__/heartbeat-baseline.test.ts` to exercise the empty `heartbeat` path
  - the test captures `reapOrphanedRuns`, `resumeQueuedRuns`, and `tickTimers` spans with an injected profiler
  - the harness passed together with `pnpm -r typecheck`, `pnpm test:run`, and `pnpm build`
- `Risks`:
  - the baseline is still a proxy for empty state, not a production load run
  - we still need to decide which fixture best represents the real flow we should measure first
- `Blockers`:
  - none
- `Next step`:
  - prepare a representative run and use the opt-in seam to capture the real baseline

## Checkpoint 11
- `Phase/Wave`: `Wave 4`
- `Goal`: capture a real heartbeat run with the smallest useful amount of data
- `Status`: `Wave 4 live baseline captured`
- `Done`:
  - executed a real run on embedded PostgreSQL with a `process` agent
  - the profiler recorded `resolveWorkspaceForRun`, `startNextQueuedRunForAgent`, and `executeRun`
  - `executeRun` was the dominant component in the minimum run
  - documented the result in [docs/refactor/heartbeat-live-baseline.md](/Users/tomasvallejo/Desktop/paperclip/docs/refactor/heartbeat-live-baseline.md)
- `Risks`:
  - the minimum run still does not represent a project with `projectWorkspaces` and `issues`
  - this measurement is a starting baseline, not a final performance conclusion
- `Blockers`:
  - none
- `Next step`:
  - increase fixture complexity and measure a project-scoped path against this baseline

## Checkpoint 12
- `Phase/Wave`: `Wave 4`
- `Goal`: validate a stable project-scoped run and compare it to the minimum baseline
- `Status`: `Wave 4 project-scoped baseline captured`
- `Done`:
  - stabilized the project fixture to use a real git workspace with `projectWorkspaces` and `issues`
  - the project-scoped run recorded `startNextQueuedRunForAgent`, `resolveWorkspaceForRun`, and `executeRun`
  - the baseline now covers both the minimal path and the project path with a resolved workspace
  - the full matrix stayed green after the run
- `Risks`:
  - `heartbeat.ts` still concentrates most of the work needed for comparative observability and optimization decisions
  - we still lack measurements for `reapOrphanedRuns()`, `resumeQueuedRuns()`, `tickTimers()`, and multi-run contention
- `Blockers`:
  - none immediate
- `Next step`:
  - measure additional Wave 4 paths before proposing semantic optimizations

## Checkpoint 13
- `Phase/Wave`: `Wave 4`
- `Goal`: capture a maintenance baseline for `reapOrphanedRuns`, `resumeQueuedRuns`, and `tickTimers`
- `Status`: `Wave 4 maintenance baseline captured`
- `Done`:
  - added a synthetic run with an orphaned run, a salvageable queue, and an expired timer signal
  - the profiler recorded `reapOrphanedRuns`, `resumeQueuedRuns`, `tickTimers`, `startNextQueuedRunForAgent`, `resolveWorkspaceForRun`, and `executeRun`
  - `tickTimers()` showed real load with `checked: 3` and `enqueued: 1` in the fixture
  - the full matrix passed again after the new test
- `Risks`:
  - we still need to measure multi-run contention and compare before/after if we decide to optimize
  - these measurements are still lab baselines, not production load
- `Blockers`:
  - none immediate
- `Next step`:
  - measure queue contention and decide whether Wave 4 closes without semantic changes or with a minimal optimization

## Checkpoint 14
- `Phase/Wave`: `Wave 4`
- `Goal`: measure queue contention for one agent with several pending runs
- `Status`: `Wave 4 contention baseline captured`
- `Done`:
  - added three `queued` runs for the same agent and drained them with a single `resumeQueuedRuns()` call
  - the profiler recorded three sequential `executeRun` executions and multiple `startNextQueuedRunForAgent` spans
  - the run confirmed that draining is sequential and that contention behaves as expected in the fixture
  - the full matrix turned green again after the test
- `Risks`:
  - there is still no before/after comparison because no concrete optimization has been proposed yet
  - the measurements are still lab-oriented, not production load
- `Blockers`:
  - none immediate
- `Next step`:
  - close Wave 4 with an explicit no-op decision or open a minimal, reversible optimization

## Checkpoint 15
- `Phase/Wave`: `Wave 4`
- `Goal`: apply the smallest safe optimization to `tickTimers()` and close the phase
- `Status`: `Wave 4 complete`
- `Done`:
  - `tickTimers()` now filters out ineligible agents in SQL and projects only the required columns
  - the change did not alter wakeup, recovery, or queue-draining semantics
  - the full battery passed again: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
  - the four heartbeat baselines were documented and remain internally consistent
- `Risks`:
  - the optimization is intentionally small; bigger performance gains would require more complexity and risk
  - there is still no real production-load before/after comparison
- `Blockers`:
  - none
- `Next step`:
  - open Wave 5 for advanced validation, final documentation, and plan closure

## Checkpoint 16
- `Phase/Wave`: `Wave 5`
- `Goal`: close the advanced validation, consolidate the final documentation, and declare the plan ready
- `Status`: `Wave 5 complete`
- `Done`:
  - finalized Wave 4 with the minimal `tickTimers()` optimization
  - added the final release-readiness summary in [docs/refactor/release-readiness.md](/Users/tomasvallejo/Desktop/paperclip/docs/refactor/release-readiness.md)
  - the operational documentation now covers startup, access/onboarding, heartbeat runtime, test evidence, and the final closure readout
  - the workspace battery passed in the latest stable refactor cycle
- `Risks`:
  - there is still no production load benchmark, only lab baselines and structural validation
  - the large UI chunk warning is still a separate issue outside this refactor's scope
- `Blockers`:
  - none
- `Next step`:
  - keep these artifacts as the stable fork reference and only reopen a new wave if a meaningful functional change appears
