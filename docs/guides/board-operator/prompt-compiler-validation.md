# Prompt Compiler Real Validation Battery

This document records the real multi-agent validation battery executed against the live Oracle Paperclip instance for the Prompt Compiler feature.

## Environment

- Instance: Oracle private deployment
- Health endpoint: `http://127.0.0.1:3100/api/health`
- Company ID: `05100f6d-b0a4-4a15-b785-61949b90c6df`
- Adapter under test: `openclaw_gateway`
- Language policy: final reports and user-facing summaries were written in Spanish for this validation run

## Goal

Validate that the Prompt Compiler can:

1. compile rough business requests into executable issues
2. route those issues to the correct first owner
3. produce real deliverables through multiple agents
4. persist verifiable work products
5. close the loop with a final consolidated artifact

## Code Hardening Added During Validation

The validation battery uncovered routing edge cases and led to these changes:

- finance-oriented requests now route to `CFO`
- QA checklist requests now route to `Dev Verifier`
- operational runbooks now route to `Sammy`
- executive consolidation packages now route to `Sammy` even if they mention validation status
- single-owner requests now carry an explicit no-delegation constraint in the compiled brief and wake prompt

Relevant code:

- [prompt-compiler.ts](../../../server/src/services/prompt-compiler.ts)
- [execute.ts](../../../packages/adapters/openclaw-gateway/src/server/execute.ts)
- [prompt-compiler.test.ts](../../../server/src/__tests__/prompt-compiler.test.ts)
- [openclaw-gateway-adapter.test.ts](../../../server/src/__tests__/openclaw-gateway-adapter.test.ts)

## Real Test Cases

### 1. Operational Runbook

- Issue: `ALQ-127`
- Issue ID: `d5505230-2884-46a1-bb09-7a350d0e8267`
- Agent: `Sammy`
- Outcome: `done`
- Work product:
  - `/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_runbook.md`

What was validated:

- Prompt Compiler routing to `Sammy`
- single-owner execution
- artifact generation in Spanish
- work product persistence in Paperclip

### 2. Risk Register and Cost/Benefit Analysis

- Issue: `ALQ-142`
- Issue ID: `27777d97-840f-4e1c-9b91-9b6913051f34`
- Agent: `CFO`
- Outcome: `done`
- Work product:
  - `/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_risk_assessment.md`

What was validated:

- finance routing to `CFO`
- no fallback to generic CEO/CTO lanes
- artifact registration and a Spanish summary

### 3. QA Checklist

- Issue: `ALQ-143`
- Issue ID: `7422d736-ad3d-4806-bcad-762d38ce0d10`
- Agent: `Dev Verifier`
- Outcome: `done`
- Work products:
  - `/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_qa_checklist.md`

What was validated:

- QA routing to `Dev Verifier`
- single-owner execution for verification work
- artifact persistence and evidence discipline

### 4. Consolidated Final Deliverable

- Issue: `ALQ-144`
- Issue ID: `3d449eba-16fd-4e0c-b3c4-b6408af7ca30`
- Agent: `Sammy`
- Outcome: `done`
- Work product:
  - `/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_consolidated_deliverable.md`

What was validated:

- executive consolidation routing to `Sammy`
- artifact-based final package generation
- final summary and next steps written in Spanish
- reuse of previously verified artifacts as inputs

## Final Deliverables Produced

- [prompt_compiler_runbook.md](/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_runbook.md)
- [prompt_compiler_risk_assessment.md](/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_risk_assessment.md)
- [prompt_compiler_qa_checklist.md](/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_qa_checklist.md)
- [prompt_compiler_consolidated_deliverable.md](/home/ubuntu/apps/openclaw-frontdesk/prompt_compiler_consolidated_deliverable.md)

## Assertions Verified

- compiled issues were created from raw business requests
- issue documents `prompt_intent` and `compiled_brief` were persisted
- assignment wakeups reached the correct first owner
- artifacts were written to stable absolute paths
- artifacts were registered as work products in Paperclip
- final operator-facing output remained in Spanish for this run

## Known Operational Caveat

During live execution, two single-owner runs produced their artifact and completion comment before their run session terminated cleanly. The control plane state was reconciled after evidence existed.

Observed on:

- `ALQ-143`
- `ALQ-144`

Impact:

- no data loss
- no missing artifact
- no false success without evidence
- but the issue could remain `in_progress` briefly after the deliverable already existed

Follow-up recommended:

- treat `artifact + completion comment` as a stronger closure signal for single-owner deliverable runs

## Local Validation Run

The routing and wake hardening introduced during this battery was covered locally with:

```bash
pnpm -C server exec vitest run \
  src/__tests__/prompt-compiler.test.ts \
  src/__tests__/prompt-compiler-route.test.ts \
  src/__tests__/openclaw-gateway-adapter.test.ts

pnpm -C server exec tsc --noEmit
```

## Oracle Validation Run

The updated Prompt Compiler logic was also verified on Oracle with:

```bash
pnpm -C server exec vitest run \
  src/__tests__/prompt-compiler.test.ts \
  src/__tests__/prompt-compiler-route.test.ts
```

and by checking:

- `/api/health`
- issue status transitions
- work product registration
- issue comments
- live run logs
