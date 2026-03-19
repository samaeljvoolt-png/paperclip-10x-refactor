# Paperclip Refactor Foundation Workboard

| Workstream | Owner | Status | Allowed Files | Exit Criteria |
|---|---|---|---|---|
| Baseline control docs | `refactor-conductor` | `verified` | `doc/plans/*` | control docs and baseline status exist |
| OpenClaw orchestration skill | `refactor-conductor` | `verified` | `skills/paperclip-refactor-orchestrator/**` | skill and references installed |
| OpenClaw agent definitions | `refactor-conductor` | `verified` | `~/.openclaw/openclaw.json`, `~/.openclaw/agents/**` | four fixed agents registered with prompts |
| CI and env reinterpretation | `architecture-risk-critic` | `verified` | `.github/workflows/*`, `package.json`, `server/src/config.ts`, `doc/plans/*` | safe phase-1 sequence approved |
| Access/onboarding hardening design | `access-platform-builder` | `planned` | `server/src/routes/access*.ts`, `server/src/utils/**`, tests | secure target design and first change set approved |
| Test matrix and acceptance coverage | `runtime-test-sentinel` | `verified` | `doc/plans/2026-03-19-refactor-test-matrix.md` | every wave mapped to evidence |
| Wave 1 repo alignment | `refactor-conductor` | `verified` | `.github/workflows/pr-verify.yml`, `.env.example`, `docs/deploy/environment-variables.md`, `doc/plans/*` | CI gate simplified and env contract aligned to current runtime |
| Access/onboarding hardening implementation | `access-platform-builder` | `verified` | `server/src/routes/access*.ts`, `server/src/utils/**`, tests | public URL resolution centralized and covered |
| Wave 3 deployment-config extraction | `access-platform-builder` | `verified` | `server/src/index.ts`, `server/src/bootstrap/deployment-config.ts`, `server/src/__tests__/*`, `doc/plans/*` | first startup validation cut extracted and tested |
| Wave 3 authenticated bootstrap extraction | `access-platform-builder` | `verified` | `server/src/index.ts`, `server/src/bootstrap/authenticated-mode.ts`, `server/src/__tests__/*`, `doc/plans/*` | authenticated-mode wiring extracted and covered |
| Wave 3 runtime/bootstrap continuation | `access-platform-builder` | `verified` | `server/src/index.ts`, `server/src/bootstrap/**`, `server/src/__tests__/*`, `doc/plans/*` | heartbeat and backup schedulers extracted and covered |
| Wave 3 listen/bootstrap tail | `access-platform-builder` | `verified` | `server/src/index.ts`, `server/src/bootstrap/**`, `server/src/__tests__/*`, `doc/plans/*` | final startup/listen cut extracted and covered |
| Wave 4 heartbeat/runtime baseline | `runtime-test-sentinel` | `verified` | `server/src/services/heartbeat.ts`, `server/src/bootstrap/**`, `server/src/__tests__/start-server-orchestration.test.ts`, `doc/plans/*` | measured runtime baseline captured before optimization |
| Wave 4 heartbeat profiling seam | `runtime-test-sentinel` | `verified` | `server/src/services/heartbeat-profiler.ts`, `server/src/services/heartbeat.ts`, `server/src/__tests__/heartbeat-profiler.test.ts`, `docs/refactor/*`, `docs/deploy/environment-variables.md` | opt-in span timing seam exists without changing default semantics |
| Wave 4 heartbeat baseline harness | `runtime-test-sentinel` | `verified` | `server/src/__tests__/heartbeat-baseline.test.ts`, `server/src/services/heartbeat.ts`, `doc/plans/*`, `docs/refactor/*` | empty-state baseline harness is executable and repeatable |
| Wave 4 live heartbeat baseline | `runtime-test-sentinel` | `verified` | `server/src/__tests__/heartbeat-live-baseline.test.ts`, `server/src/services/heartbeat.ts`, `docs/refactor/heartbeat-live-baseline.md`, `doc/plans/*` | real embedded-Postgres baseline captured for the minimal and project-scoped process adapter paths |
| Wave 4 maintenance baseline | `runtime-test-sentinel` | `verified` | `server/src/__tests__/heartbeat-live-baseline.test.ts`, `server/src/services/heartbeat.ts`, `docs/refactor/heartbeat-live-baseline.md`, `doc/plans/*` | reaping, resume, and timer tick paths measured on synthetic but executable data |
| Wave 4 queue contention baseline | `runtime-test-sentinel` | `verified` | `server/src/__tests__/heartbeat-live-baseline.test.ts`, `server/src/services/heartbeat.ts`, `docs/refactor/heartbeat-live-baseline.md`, `doc/plans/*` | multi-run contention measured on a single agent and drained sequentially |
| Wave 4 tickTimers SQL filtering optimization | `runtime-test-sentinel` | `verified` | `server/src/services/heartbeat.ts`, `server/src/__tests__/heartbeat-live-baseline.test.ts`, `server/src/__tests__/heartbeat-baseline.test.ts`, `server/src/__tests__/heartbeat-scheduler.test.ts`, `server/src/__tests__/start-server-orchestration.test.ts`, `doc/plans/*`, `docs/refactor/*` | eligible agents are filtered in SQL and only required columns are projected |
| Wave 5 final validation and documentation | `refactor-conductor` | `verified` | `docs/refactor/*`, `doc/plans/*` | final release-readiness summary exists and the plan is closed out |

## Agent Ownership Rules

- `refactor-conductor`
  - owns the plan, workboard, decisions, status, and integration sequencing
- `access-platform-builder`
  - owns structural backend refactors in `access`, `config`, `index`, and future bootstrap modules
- `runtime-test-sentinel`
  - owns test coverage strategy, execution evidence, and validation gaps
- `architecture-risk-critic`
  - owns risk review, rollback scrutiny, and sequence corrections

## Escalation Rules

- no agent edits a file outside its allowed set without conductor approval
- any contract conflict pauses both workstreams until ownership is reassigned
- any rollout-sensitive change requires a rollback note in `risks.md` before merge
