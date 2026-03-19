# Paperclip Refactor Foundation Test Matrix

| Wave | Change Surface | Required Evidence | Status |
|---|---|---|---|
| Wave 0 | control docs, skill, agent scaffolding | file presence, OpenClaw config backup + registration, architect status | `verified` |
| Wave 1 | CI / env baseline reinterpretation | `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`, workflow diff review | `verified` |
| Wave 2 | access / onboarding / URL hardening | integration tests for changed routes, onboarding smoke, regression review | `verified` |
| Wave 3 | startup/bootstrap/config/logger | typecheck, existing tests, targeted unit coverage for extracted pieces | `verified` |
| Wave 4 | heartbeat/runtime/performance | measured baseline, profiling seam, empty-state harness, project-scoped baseline, maintenance baseline, queue contention baseline, lightweight optimization, rollback note | `verified` |
| Wave 5 | advanced validation and final documentation | simulation coverage where added, final build/test pass, release-readiness summary | `verified` |

## Minimum Command Set

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

## Additional Checks

- onboarding smoke for any onboarding change
- redaction/logging checks for logger or event-surface changes
- access integration for route or auth-surface edits
- load/perf baseline before any runtime optimization proposal
- optional heartbeat profiling via `PAPERCLIP_HEARTBEAT_PROFILE` before any runtime comparison
- empty-state harness in `server/src/__tests__/heartbeat-baseline.test.ts` before any live-data baseline
- real embedded-Postgres baseline in `server/src/__tests__/heartbeat-live-baseline.test.ts` before any production-scale comparison
- project-scoped embedded-Postgres baseline in `server/src/__tests__/heartbeat-live-baseline.test.ts` before any optimization proposal
- maintenance baseline in `server/src/__tests__/heartbeat-live-baseline.test.ts` before any queue or scheduler optimization proposal
- queue contention baseline in `server/src/__tests__/heartbeat-live-baseline.test.ts` before any scheduling or concurrency optimization proposal
- lightweight `tickTimers()` optimization in `server/src/services/heartbeat.ts` before closing the wave
