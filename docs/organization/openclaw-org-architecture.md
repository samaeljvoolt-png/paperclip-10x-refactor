# OpenClaw Org Architecture

This document defines the recommended chain of command for the Paperclip + OpenClaw operating model.

The goal is not just a visual tree. The goal is a usable company structure:

- every agent knows one manager
- every manager owns a single functional slice
- blockers move upward quickly
- execution moves downward in small, testable units
- cross-functional issues are escalated, not broadcast
- legacy gateways route work, but do not create parallel authority

## Command Ladder

### Level 0: CEO

Single owner of company direction and final arbitration.

- CEO sets goals, priorities, and release gates
- CEO resolves conflicts between functions
- CEO approves company-level changes and policy

### Level 1: Executive Functions

These roles report to the CEO and own major business surfaces.

- CTO
  - owns technical execution, delivery, runtime behavior, and system reliability
- CMO
  - owns brand, messaging, public communication, community narrative, and growth marketing
- CFO
  - owns cost, capacity, budget, pricing, margins, and financial risk

### Level 1.5: Gateways And Legacy Controllers

These agents are routing points, not centers of power.

- Sammy
- Laura Agency Bot

They may relay work, approve execution context, or bridge legacy behavior, but they should not bypass the CEO/CTO/CMO/CFO ladder.

### Level 2: Functional Leads

Functional leads report to the executive that owns their domain.

Technical branch under CTO:

- Dev Architect
- Dev Coder
- Dev Debugger
- Dev Verifier
- Researcher
- DevOps
- Nexo Worker
- Codex Bridge

Communication branch under CMO:

- Creative Director
- Brand Guardian
- Content Creator
- Content Editor
- Copywriting
- Visual Director
- Graphic Designer
- AI Photography
- Content Photographer
- Visual Storyteller
- Video Creator
- Social Twitter
- Social Instagram
- Social TikTok
- Social Facebook
- Whimsy Injector
- Growth Hacker

Finance branch under CFO:

- No specialist sprawl unless the business truly needs it.
- Keep CFO lightweight and focused on control gates, pricing, margins, and budget approvals.

### Level 3: Execution Agents

These agents execute specific tasks and report to the closest functional lead.

- implementation workers
- debugging workers
- verification workers
- content production workers
- support workers

## Recommended Reporting Map

Use this as the default when a `reportsTo` value is missing or ambiguous.

### CEO direct reports

- CTO
- CMO
- CFO
- Sammy
- Laura Agency Bot

### CTO branch

- Dev Architect reports to CTO
- Dev Coder reports to Dev Architect or CTO if no architect exists
- Dev Debugger reports to Dev Architect
- Dev Verifier reports to Dev Architect
- DevOps reports to CTO
- Researcher reports to CTO or Dev Architect depending task type
- Nexo Worker reports to CTO
- Codex Bridge reports to CTO
- General technical agents report to CTO, not to the CEO.

### CMO branch

- Creative Director reports to CMO
- Brand Guardian reports to Creative Director
- Content Creator reports to Creative Director
- Content Editor reports to Content Creator or Creative Director
- Copywriting reports to Creative Director
- Visual Director reports to Creative Director
- Graphic Designer reports to Visual Director
- AI Photography reports to Visual Director or Creative Director
- Content Photographer reports to Content Creator or Creative Director
- Visual Storyteller reports to Creative Director
- Video Creator reports to Creative Director
- Social agents report to Content Creator or Brand Guardian
- Whimsy Injector reports to Content Editor or Creative Director
- Growth Hacker reports to CMO when acting as growth marketing, not finance

### CFO branch

- CFO stays lean.
- If an analyst is needed, it reports to CFO and remains a support function.
- Growth Research Oracle reports to CFO only when the task is financial or margin-related.

## Information Flow

### Downward flow

1. CEO publishes company goals.
2. Executives convert goals into function-level priorities.
3. Leads turn priorities into concrete tasks.
4. Executors work from one assigned task at a time.
5. Gateways can route work, but they do not decide the priority ladder.

### Upward flow

1. Executors report progress, blockers, and evidence to their manager.
2. Leads summarize status into a function update.
3. Executives escalate only unresolved blockers or cross-functional risks.
4. CEO receives concise, decision-ready summaries.
5. Gateway controllers forward context; they do not override functional owners.

### Lateral flow

Use lateral communication sparingly.

- only when two domains must coordinate on the same artifact
- never for unresolved authority conflicts
- always name one owner before work begins

## Practical Rules

- Do not give an executor two managers.
- Do not let the org chart be a flat list of agents.
- If an agent has no `reportsTo`, assign one before using it in production.
- If a role is ambiguous, report to the nearest lead that owns the output.
- Status should move upward; work should move downward.
- Avoid parallel authority paths for legacy controllers.

## What Makes The UI Look Better

The org chart becomes readable when the data follows the ladder above:

- exactly one CEO root
- a small executive layer under the CEO
- functional leads grouped by domain
- operators placed beneath their lead
- no duplicate roots unless they are intentional business units

If the chart still looks flat, the problem is usually missing `reportsTo` data, not the renderer.
