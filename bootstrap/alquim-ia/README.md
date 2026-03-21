# Alquim-IA Bootstrap in One Command

This profile packages the public, reproducible part of the `Alquim-IA` company:

- company metadata
- curated agent roster
- reporting hierarchy (`reportsTo`)
- roles and prompt templates
- organization and skills governance docs

It intentionally does **not** include:

- the OpenClaw gateway token
- active device keys
- live claim files
- Better Auth secrets
- real API keys

## Public vs Private Split

Use:

- `bootstrap/alquim-ia/public/` for the versioned public profile
- a private JSON file for real secrets
- an optional private repo or directory for your actual OpenClaw workspaces

## Beginner-Friendly Setup

If you want the simplest possible path, run the wrapper:

```bash
./scripts/setup-alquim-ia.sh
```

That setup performs these steps:

1. validates macOS/Linux, `curl`, and `git`
2. installs the public OpenClaw release if it is missing
3. activates `pnpm` if needed
4. asks only for the model provider API key
5. runs `openclaw onboard` in non-interactive mode
6. generates or recovers the gateway token automatically
7. installs the Alquim-IA agent tree into `~/.openclaw/agents`
8. installs the public skills from this repo into `~/.openclaw/skills`
9. applies an optional private bundle from `~/.config/paperclip-bootstrap/alquim-ia.bundle`
10. starts local Paperclip
11. bootstraps the `Alquim-IA` company

## Advanced One-Command Bootstrap

```bash
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

## Private Configuration

Start from:

```text
bootstrap/alquim-ia/private-config.example.json
```

Copy it to:

```text
~/.config/paperclip-bootstrap/alquim-ia.private.json
```

Then fill in the real values for:

- `paperclip.apiUrl`
- `paperclip.agentReachableApiUrl`
- `openclaw.gatewayUrl`
- `openclaw.gatewayToken`
- `openclaw.agentsSourceDir`
- `openclaw.skillsSourceDir`

The installer will then:

1. import or update the `Alquim-IA` company
2. configure all `openclaw_gateway` agents with your real URL and token
3. generate one claim file per agent
4. copy your private OpenClaw agent folders into `~/.openclaw/agents`
5. copy your private OpenClaw skills into `~/.openclaw/skills`
6. verify that the company is wired correctly

## What Ships in the Public Profile

- `public/paperclip.manifest.json`
- `public/COMPANY.md`
- `public/agents/*/AGENTS.md`
- `public/docs/ORGANIZATION.md`
- `public/docs/SKILLS.md`

## Operational Notes

- The public profile excludes ephemeral smoke agents that existed only for refactor QA.
- The installer is idempotent: if a company named `Alquim-IA` already exists, it updates it instead of duplicating it.
- For full parity with your private stack, create an optional bundle at `~/.config/paperclip-bootstrap/alquim-ia.bundle` with:
  - `agents/<slug>/AGENTS.md`
  - `skills/<skill>/SKILL.md`
  - `docs/ORGANIZATION.md`
  - `docs/SKILLS.md`
