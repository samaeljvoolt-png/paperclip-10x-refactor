---
name: paperclip-refactor-orchestrator
description: >
  Use when coordinating a large Paperclip refactor foundation effort through OpenClaw agents.
  Trigger on multi-wave execution, architecture-supervised refactors, ownership-sensitive changes,
  or any request to run backend hardening step by step with documented risks, tests, and status.
---

# Paperclip Refactor Orchestrator

This skill governs the refactor. It does not replace implementation skill. It keeps multi-agent execution controlled.

## When To Use

- the user wants to improve the Paperclip refactor fork in waves
- multiple agents must work on one repo without overlapping edits
- architecture, rollback, and test evidence matter as much as code changes
- Codex or another supervisor needs repeatable status checkpoints

## Do Not Use

- one-file fixes
- isolated bug patches
- content or documentation tasks with no refactor surface

## Core Workflow

1. Read the current `master-plan`, `workboard`, `risks`, `decisions`, and `test-matrix`.
2. Determine the active wave and its acceptance criteria.
3. Assign one workstream per agent with strict file ownership.
4. Block any wave that lacks rollback, evidence, or explicit scope.
5. Require a status update at the end of every heartbeat.
6. Close the wave only when the evidence matches the acceptance criteria.

## Fixed Team

- `refactor-conductor`
- `access-platform-builder`
- `runtime-test-sentinel`
- `architecture-risk-critic`

Use ephemeral agents only for a real bottleneck. Never exceed six active agents total.

## Mandatory Artifacts

- `doc/plans/2026-03-19-refactor-master-plan.md`
- `doc/plans/2026-03-19-refactor-workboard.md`
- `doc/plans/2026-03-19-refactor-risks.md`
- `doc/plans/2026-03-19-refactor-decisions.md`
- `doc/plans/2026-03-19-refactor-test-matrix.md`
- `doc/plans/2026-03-19-refactor-status.md`

## Status Contract

Every checkpoint must include:

- `Fase/Ola`
- `Objetivo`
- `Estado`
- `Hecho`
- `Riesgos`
- `Bloqueos`
- `Siguiente paso`

## Operating Constraints

- no overlapping file edits
- no opportunistic cleanup
- no architecture change without rollback note
- no performance work without measurement
- no wave closes without evidence

Use `references/role-prompts.md` for agent prompts and `references/artifacts.md` for artifact rules.
