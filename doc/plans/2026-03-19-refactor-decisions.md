# Paperclip 10x Refactor Decisions

## D1

- Date: `2026-03-19`
- Decision: use OpenClaw, not Paperclip itself, as the execution layer for the refactor
- Why: the goal is to improve `paperclip-10x-refactor`, not to bootstrap Paperclip as a prerequisite

## D2

- Date: `2026-03-19`
- Decision: start with four fixed agents and allow ephemeral agents only for real bottlenecks
- Why: lower coordination overhead and stricter ownership

## D3

- Date: `2026-03-19`
- Decision: version the orchestration skill inside the repo and install a live copy into the OpenClaw skills directory
- Why: one copy is reviewable in git, the other is immediately executable by the local OpenClaw runtime

## D4

- Date: `2026-03-19`
- Decision: target the conductor agent at the requested GPT-5.4 mini OpenAI model in OpenClaw while keeping the API key runtime-only
- Why: the user supplied a dedicated low-cost OpenAI key for the conductor path, but it must not be stored in repo files

## D5

- Date: `2026-03-19`
- Decision: Wave 1 will not introduce strict centralized env validation
- Why: the current runtime depends on mixed env/file/default resolution and mode-aware fallbacks, especially embedded Postgres and local deployment defaults

## D6

- Date: `2026-03-19`
- Decision: `pr-verify` becomes a pure verification gate and drops the release canary dry run
- Why: release-dry-run logic is not a safe baseline requirement for every pull request in this fork and adds avoidable branch/release coupling

## D7

- Date: `2026-03-19`
- Decision: centralize public URL resolution before completing the broader `access` split
- Why: this removes a concrete onboarding risk immediately and avoids waiting for a larger module refactor

## D8

- Date: `2026-03-19`
- Decision: start Wave 3 by extracting deployment-mode validation out of `server/src/index.ts`
- Why: it is behavior-preserving, testable in isolation, and reduces startup coupling without opening a large bootstrap refactor yet

## D9

- Date: `2026-03-19`
- Decision: continue Wave 3 with authenticated-mode bootstrap extraction before heartbeat recovery work
- Why: auth bootstrap is already bounded by deployment mode and can be isolated with unit tests, while heartbeat recovery remains a Wave 4 concern because it mixes timers, persisted runtime recovery, and operational risk

## D10

- Date: `2026-03-19`
- Decision: extract heartbeat and database backup schedulers into dedicated bootstrap helpers
- Why: both are periodic background responsibilities that obscure `index.ts`; isolating them lowers startup coupling without changing runtime behavior

## D11

- Date: `2026-03-19`
- Decision: extract the server listen/banner/board-claim block into a dedicated bootstrap helper
- Why: it is orchestration-only, easy to test in isolation, and removes the last large procedural block from `index.ts`

## D12

- Date: `2026-03-19`
- Decision: close Wave 4 with a minimal SQL-side filtering optimization in `tickTimers()` instead of rewriting the queue scheduler or `executeRun()`
- Why: the measured hotspots showed `executeRun()` dominates, while `tickTimers()` had a bounded `O(n)` cost that could be reduced safely without changing queue fairness or recovery semantics
