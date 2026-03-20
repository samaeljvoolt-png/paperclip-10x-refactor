# SKILLS.md - System Reference

This file is the canonical reference for skill usage across the agent system.
It complements `ORGANIZATION.md` and should be updated whenever role contracts change.

## Rule Of Thumb
- Keep skill lists in `SOUL.md` short and role-specific.
- Add a skill only if it is part of the role normal operating loop.
- Use QA skills as gates, not decoration.
- If a skill is rarely needed, use escalation rather than keeping it in the core contract.

## Skill Matrix

| Skill | Primary owners | Use when | Avoid when |
|---|---|---|---|
| `chief-editor-router` | `main`, `ceo`, `creative_director`, `frontdesk`, `bridge`, `sammy` | You need clean routing, normalization, or a fast handoff. | The role is already making the final decision. |
| `cornerstone-architect` | `ceo`, `cmo`, `creative_director`, `content_creator`, `growth_hacker` | You need to shape the core system, frame, or campaign pillar. | The task is a small execution step. |
| `distribution-authority-engine` | `cmo`, `creative_director`, `content_creator`, `copywriting`, `social_*`, `whimsy_injector` | You need channel-native distribution or repurposing. | The role is doing pure research or technical work. |
| `engineering-plan-review` | `ceo`, `cto`, `dev-architect`, `dev-coder`, `dev-debugger`, `dev-researcher`, `dev-verifier`, `frontdesk`, `bridge` | You need a bounded technical plan, sequencing, or implementation control. | The role is writing brand or marketing copy. |
| `executive-angle-review` | `ceo`, `cmo`, `cfo`, `brand_guardian`, `growth_hacker` | You need business value, focus, and opportunity-cost pressure testing. | You already have a narrow implementation contract. |
| `lead-magnet-forger` | `cmo`, `content_creator`, `copywriting` | You need hooks, offers, and conversion-oriented lead assets. | The piece is purely editorial or technical. |
| `world-class-writer` | `cmo`, `content_creator`, `content_editor`, `copywriting`, `whimsy_injector`, `social_*`, `editorial_os`, `visual_storyteller`, `video_creator` | You need high-signal prose, structure, or message craft. | The role should not author copy. |
| `research-truth-checker` | `ceo`, `cto`, `cmo`, `cfo`, `brand_guardian`, `content_editor`, `dev-researcher`, `growth_hacker`, `social_*`, `bridge`, `sync_hub`, `editorial_os` | You need claim validation, source discipline, or evidence quality control. | The task is purely creative with no factual claims. |
| `quality-auditor-scorecard` | `all gated roles` | You need a severe review, scorecard, or release readiness check. | The role is in pure drafting mode without a gate. |
| `mystic-tech-ux-designer` | `creative_director`, `visual_director`, `graphic_designer`, `ai_photography`, `content_photographer`, `visual_storyteller`, `video_creator` | You need hierarchy, scannability, visual structure, or layout control. | The role is not producing or reviewing visual assets. |
| `imagegen` | `visual_director`, `graphic_designer`, `ai_photography`, `content_photographer` | You need prompt-to-image generation or image asset work. | The task is copy, strategy, or QA only. |
| `browse-qa-operator` | `cto`, `dev-architect`, `dev-coder`, `dev-debugger`, `dev-researcher`, `dev-verifier`, `graphic_designer` | You need real browser validation, forms, flows, or UI QA. | The role has no browser-based verification step. |
| `playwright` | `cto`, `dev-architect`, `dev-coder`, `dev-debugger`, `dev-verifier` | You need repeatable browser automation for technical validation. | The task is a static document review. |
| `ship-readiness-gate` | `cto`, `dev-architect`, `dev-coder`, `dev-verifier` | You need a go/no-go release check with smoke tests and rollback thinking. | The work is still exploratory or undefined. |
| `spreadsheet` | `cfo`, `growth_hacker` | You need numeric modeling, unit economics, or KPI analysis. | The role is doing narrative or creative work. |
| `slides` | `creative_director`, `visual_storyteller`, `video_creator` | You need sequence design, presentation logic, or panel structure. | The output is not a deck or story flow. |
| `AEO/GEO Optimizer` | `cmo`, `brand_guardian`, `content_creator`, `content_editor`, `copywriting`, `whimsy_injector`, `social_*`, `editorial_os`, `sync_hub` | You need citable, discoverable, machine-readable content. | The task is private, internal, or non-public. |
| `retro-capture` | `ceo`, `cto`, `cmo`, `cfo`, `creative_director`, `dev-architect`, `growth_hacker` | You need to capture lessons learned after a launch, build, or incident. | The task has no meaningful operational aftermath. |
| `pdf` | `ceo`, `cmo`, `content_editor`, `editorial_os`, `sync_hub`, `growth_hacker` | You need to read or generate a faithful document artifact. | The task is live execution or browser QA. |
| `doc` | `content_editor`, `editorial_os`, `bridge`, `sammy` | You need a formatted document with layout fidelity. | The task is only routing or quick messaging. |
| `screenshot` | `creative_director`, `visual_director`, `dev-debugger`, `dev-verifier`, `browse-qa-operator` | You need visual evidence from a UI or asset. | The task can be resolved from text alone. |
| `playwright-interactive` | `dev-debugger`, `dev-researcher`, `dev-verifier`, `browse-qa-operator` | You need fast iterative browser debugging in a persistent session. | The task is a one-shot scriptable check. |

## Usage Notes
- Prefer the smallest skill set that can produce a reliable result.
- Do not duplicate the same skill in many sibling roles unless each one uses it for a different reason.
- If a skill appears in a `SOUL.md`, it must be part of the role normal operating loop.
- If a skill is not in the role core loop, use it through escalation or a specialized helper.
- Use QA skills as gates, not as decoration.

## Ownership Model
- `ORGANIZATION.md` defines hierarchy, handoff rules, and escalation.
- `SKILLS.md` defines the canonical skill mapping.
- `SOUL.md` files define the role contract, including inputs, outputs, QA, and personality.
- Any mismatch between `SOUL.md` and `SKILLS.md` should be resolved by tightening the role, not by expanding the matrix.

## Change Rule
When a new skill is installed or a role changes materially, update this file first, then sync the relevant `SOUL.md` files.
