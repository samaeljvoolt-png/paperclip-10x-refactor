# Paperclip Refactor Foundation Risks

| ID | Risk | Severity | Current State | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Original plan assumes repo features that do not exist verbatim in the fork (`lint`, `main`, required `DATABASE_URL`) | high | open | reinterpret phases against actual fork state before coding | `architecture-risk-critic` |
| R2 | `access-onboarding.ts` still constructs public URLs from forwarded headers | high | mitigated | public URL construction centralized; legacy header fallback only applies when no explicit public base is configured | `access-platform-builder` |
| R3 | `server/src/index.ts` and `server/src/services/heartbeat.ts` are large coupling hotspots | high | open | extract incrementally with rollback checkpoints | `access-platform-builder` |
| R4 | CI changes can duplicate or conflict with existing workflow protections | medium | open | extend current workflows instead of replacing them blindly | `architecture-risk-critic` |
| R5 | OpenClaw local catalog did not expose the requested GPT-5.4 mini model at baseline time | medium | mitigated | conductor now targets the requested OpenAI model id; API key remains runtime-only and must not be committed | `refactor-conductor` |
| R6 | Multi-agent execution can create file overlap and sequence drift | high | mitigated | fixed ownership, four-agent cap, workboard gate | `refactor-conductor` |
| R7 | Local validation cannot currently run through `pnpm` because the shell session lacks the binary | medium | mitigated | `pnpm@9.15.4` installed locally and workspace validation now runs successfully | `runtime-test-sentinel` |
| R8 | Startup auth wiring inside `index.ts` can drift from Better Auth contract during refactor | medium | mitigated | authenticated-mode bootstrap extracted to a dedicated module with unit coverage for secret fallback and trusted-origin wiring | `access-platform-builder` |
| R9 | Periodic schedulers for heartbeat and database backups can still drift from startup wiring | medium | mitigated | schedulers extracted into dedicated bootstrap helpers with unit coverage and rollback boundary | `access-platform-builder` |
| R10 | Large UI build chunks still trigger warnings during validation | low | open | monitor but do not treat as a refactor blocker; address only if a frontend-focused wave is opened | `refactor-conductor` |
| R11 | Wave 4 still lacks a real runtime baseline for `heartbeatService` and its hottest subpaths | medium | mitigated | real embedded-Postgres baselines captured for minimal, project-scoped, maintenance, and queue-contention paths; only a very small SQL-filter optimization was applied | `runtime-test-sentinel` |

## Rollback Notes

- OpenClaw config changes:
  - backup `~/.openclaw/openclaw.json` before edits
  - remove new agents from `agents.list` if rollback is required
- Skill rollback:
  - remove `paperclip-refactor-orchestrator` from repo and OpenClaw skills directory
- Repo planning rollback:
  - delete the dated plan files if this execution model is abandoned
