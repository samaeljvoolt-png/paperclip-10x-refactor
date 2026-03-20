# Prompt Compiler API

The Prompt Compiler turns a raw business request into a structured issue brief before issue creation.

## Endpoints

### `POST /api/companies/:companyId/prompt-compiler/compile`

Compiles a raw request into:
- a structured brief
- a validation result
- a suggested issue draft

#### Request

```json
{
  "rawRequest": "Build a benchmark sandbox for comparing models.",
  "additionalContext": "Keep the final report in Spanish and require verifiable evidence.",
  "preferredLanguage": "auto"
}
```

#### Response

```json
{
  "brief": {
    "schemaVersion": "prompt_compiler.v1",
    "status": "ready",
    "intentType": "web_app",
    "language": "en",
    "title": "Build a benchmark sandbox for comparing models",
    "objective": "Turn this request into an executable and verifiable web_app issue.",
    "problemStatement": "Build a benchmark sandbox for comparing models.",
    "context": "Keep the final report in Spanish and require verifiable evidence.",
    "inScope": ["..."],
    "outOfScope": ["..."],
    "constraints": ["..."],
    "assumptions": ["..."],
    "deliverables": ["..."],
    "acceptanceCriteria": ["..."],
    "evidencePlan": ["..."],
    "roleRouting": {
      "orchestrator": "cto",
      "executors": ["dev-coder", "dev-architect"],
      "verification": ["dev-verifier"]
    },
    "risks": [
      {
        "risk": "Ambiguity in scope or deliverables.",
        "impact": "medium",
        "mitigation": "Make scope, evidence, and closure criteria explicit before creating the issue."
      }
    ],
    "openQuestions": []
  },
  "validation": {
    "score": 92,
    "gateStatus": "pass",
    "hardFails": [],
    "warnings": [],
    "fieldErrors": [],
    "evidenceErrors": [],
    "criteriaErrors": [],
    "fixHints": []
  },
  "issueDraft": {
    "title": "Build a benchmark sandbox for comparing models",
    "description": "# ...",
    "suggestedAssigneeRole": "cto",
    "suggestedAssigneeAgentId": "..."
  }
}
```

## `POST /api/companies/:companyId/prompt-compiler/issues`

Creates an issue from an approved compiled brief.

This route:
- re-validates the brief
- creates the issue
- persists the raw request as the `prompt_intent` issue document
- persists the compiled brief as the `compiled_brief` issue document
- wakes the assigned agent when appropriate

### Request shape

```json
{
  "rawRequest": "Build a benchmark sandbox for comparing models.",
  "additionalContext": "Keep the report in Spanish.",
  "preferredLanguage": "auto",
  "brief": { "...compiled brief..." },
  "issueDraft": {
    "title": "Build a benchmark sandbox for comparing models",
    "description": "# ..."
  },
  "issue": {
    "title": "Build a benchmark sandbox for comparing models",
    "description": "# ...",
    "priority": "high",
    "assigneeAgentId": "..."
  }
}
```

### Validation behavior

If the compiled brief fails validation, the route returns `422`:

```json
{
  "error": "Compiled brief failed validation",
  "validation": {
    "gateStatus": "reject",
    "hardFails": ["..."]
  }
}
```

## Validation model

The Prompt Compiler rejects or flags briefs based on:
- missing required fields
- weak or untestable acceptance criteria
- missing evidence mapping for deliverables
- language ambiguity

Gate outcomes:
- `pass`
- `revise`
- `reject`

`reject` blocks issue creation.

## Persistence model

The feature intentionally reuses existing issue documents instead of introducing a dedicated prompt-compiler table in V1.

Stored documents:
- `prompt_intent`
- `compiled_brief`

This keeps the feature rollback-safe and avoids schema churn while preserving full traceability.

## Real Validation Battery

The API and routing behavior described here was validated against the live Oracle instance with real multi-agent issues and persisted deliverables.

Reference:

- [prompt-compiler-validation.md](/Users/tomasvallejo/Desktop/paperclip/docs/guides/board-operator/prompt-compiler-validation.md)
