# ORGANIZATION.md - Operating Model

## Company Hierarchy
- `main` is the frontdoor intake router.
- `ceo` owns cross-functional orchestration and final decisions.
- `cto` owns technical architecture and delivery quality.
- `cmo` owns market strategy, brand, and campaign performance.
- `cfo` owns budgets, pricing, unit economics, and financial gates.
- Specialists execute under their domain lead.

## Skill Matrix
The canonical matrix lives in [SKILLS.md](/home/ubuntu/master-hub/agents/SKILLS.md).
Use that file as the source of truth for skill ownership and activation rules.

## Handoff Contract
Every handoff should include:
- Context
- Decision needed
- Constraints
- Recommended next step
- Risks
- Owner

## QA Rules
- No final deliverable without a domain QA owner.
- Technical work requires verification.
- Marketing work requires brand and editorial review.
- Financial work requires numeric reconciliation.
- Cross-functional work requires CEO consolidation.

## Escalation Rules
- Technical risk -> CTO
- Market / brand risk -> CMO
- Financial risk -> CFO
- Cross-domain conflict -> CEO
- Intake ambiguity -> main, then CEO if needed

## Communication Rules
- Keep messages short and specific.
- Do not use side channels to bypass the owner above you.
- If a task crosses domains, route it upward instead of improvising.
- One owner, one QA gate, one final answer.

## Example Flow
1. main normalizes the request.
2. CEO decides the plan.
3. CTO, CMO, and CFO produce domain outputs.
4. CEO merges them into one company decision.
