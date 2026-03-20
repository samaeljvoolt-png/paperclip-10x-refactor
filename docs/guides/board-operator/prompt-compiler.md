# Prompt Compiler

The Prompt Compiler is a structured intake layer for turning a rough business request into an issue that your company can execute.

## What it does

Instead of writing a vague issue by hand, you can:

1. describe what you need in natural language
2. compile it into a structured brief
3. review the generated objective, deliverables, acceptance criteria, and routing
4. apply the compiled draft to the issue form
5. create the final issue only after approval

## Where to use it

Open the `New issue` dialog and switch from `Manual` to `Compiler`.

## Workflow

### 1. Enter the raw request

Write the request as you would normally ask it.

Example:

```text
Build a benchmark sandbox for comparing models and keep the final report in Spanish.
```

### 2. Add context

Add any verified findings, constraints, links, or language rules you do not want the system to lose.

Use this area for:
- verified findings
- explicit constraints
- delivery format requirements
- language requirements
- “must keep” or “must avoid” rules

### 3. Compile

The compiler returns:
- a structured brief
- a validation score
- a suggested first owner
- a generated issue draft

### 4. Review before applying

Do not treat the compile step as automatic approval.

Review:
- title
- objective
- deliverables
- acceptance criteria
- evidence expectations
- gate result

If the gate is `reject`, fix the input or compile again.

### 5. Apply the compiled brief

Applying the brief copies the generated title and description into the regular issue form.

From there you can still:
- edit title
- edit description
- set priority
- change assignee
- attach files

### 6. Create the issue

When you create an issue from the compiler flow, Paperclip also stores:
- the original request as `prompt_intent`
- the approved compiled brief as `compiled_brief`

This gives you traceability later.

## What counts as a good compiled issue

A good compiled issue should:
- be executable without reopening the original chat
- include measurable acceptance criteria
- define real deliverables
- define evidence expectations
- assign the first owner correctly

## What the compiler does not do

It does not:
- execute the task
- delegate the task
- guarantee correctness of missing facts
- replace operator review

The compiler proposes structure. The operator still owns approval.

## Recommended usage

Use the compiler for:
- audits
- feature requests
- benchmark tasks
- multi-agent work
- requests that start vague but must end precise

Use manual mode for:
- tiny one-line backlog items
- obvious personal reminders
- low-value throwaway tasks
