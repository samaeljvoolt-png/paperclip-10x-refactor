# Paperclip Refactor Foundation Master Plan

## Objective

Turn this Paperclip refactor fork into the definitive implementation: safer, easier to operate, and stronger than the original Paperclip baseline while preserving the fork's real runtime constraints.

## Architect Model

Codex is the supervising architect for the full execution:

- audit each wave before work starts
- validate ownership and sequencing
- monitor evidence, risks, and rollback
- close each wave with explicit status and next step

## Baseline Facts

- Active branch: `codex/10x-refactor`
- Upstream tracking branch: `upstream/codex/10x-refactor`
- Critical backend surfaces:
  - `server/src/index.ts`: 713 lines
  - `server/src/services/heartbeat.ts`: 3466 lines
  - `server/src/routes/access.ts`: 1923 lines
  - `server/src/routes/access-onboarding.ts`: 950 lines
  - `server/src/config.ts`: 256 lines
- Current `.env.example`: 3 lines
- Current CI workflows:
  - `e2e.yml`
  - `pr-policy.yml`
  - `pr-verify.yml`
  - `refresh-lockfile.yml`
  - `release-smoke.yml`
  - `release.yml`

## Operating Rules

1. No wave starts without explicit ownership.
2. No overlapping edits across agents.
3. No architecture change without rollback notes.
4. No "green" status without evidence.
5. No optimization without measurement.
6. No fake prerequisites: preserve embedded Postgres and current `PAPERCLIP_*` behavior until changed intentionally.

## Waves

### Wave 0: Baseline And Control

Goals:

- convert the external working plan into repo-native markdown artifacts
- inventory real gaps in the fork
- install OpenClaw execution scaffolding
- fix ownership and acceptance criteria

Acceptance:

- all control docs exist
- OpenClaw skill exists
- four execution agents are defined
- first baseline status is published

### Wave 1: CI / Env / Hardening Baseline

Goals:

- reinterpret the original Phase 0 against the fork's real state
- align CI and environment work with actual scripts and workflows
- document rollback for pipeline and config edits

Acceptance:

- CI plan matches existing workflows
- no invalid dependency on `pnpm lint`
- no breakage of embedded Postgres default behavior

### Wave 2: Access / Onboarding / URL Hardening

Goals:

- harden onboarding URL construction
- reduce trust in `x-forwarded-*` in production paths
- complete the `access` split only where justified by current code shape

Acceptance:

- onboarding risk documented and mitigated or removed
- access module ownership map is explicit
- integration tests cover moved or changed routes

### Wave 3: Bootstrap / Logger / Env Architecture

Goals:

- reduce coupling in `server/src/index.ts`
- extract bootstrap/config/logger concerns incrementally
- preserve current runtime behavior and env names

Acceptance:

- startup flow is more modular
- environment docs are aligned
- rollback path is recorded for every extraction

### Wave 4: Heartbeat Runtime And Performance

Goals:

- measure current runtime before redesign
- decide whether any performance intervention is justified
- keep scheduler/runtime changes reversible

Acceptance:

- performance baseline recorded
- decisions and risks updated
- no Redis or event-driven redesign without evidence

### Wave 5: Advanced Validation And Finalization

Goals:

- add higher-order validation where needed
- finish the operational documentation
- separate universally reusable improvements from fork-specific design choices

Acceptance:

- test matrix is complete
- risks are either closed or explicitly accepted
- final status explains why the fork is stronger than the original

## Mandatory Validation

Per wave minimum:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

Additional validation depends on the wave:

- onboarding smoke
- access integration
- log redaction
- env/config bootstrap
- heartbeat/load tests

## Status Contract

Every checkpoint must use:

- `Fase/Ola`
- `Objetivo`
- `Estado`
- `Hecho`
- `Riesgos`
- `Bloqueos`
- `Siguiente paso`
