---
title: Alquim-IA Bootstrap
summary: Install the full Alquim-IA profile with one command
---

This branch includes a public, reproducible profile for standing up the `Alquim-IA` company.

The design goal is straightforward:

- the public repo contains the company structure, prompts, hierarchy, and install logic
- the private config contains the secrets and private OpenClaw agent folders
- one command materializes the full company inside a real Paperclip instance

## What Ships in the Public Branch

- `bootstrap/alquim-ia/public/paperclip.manifest.json`
- `bootstrap/alquim-ia/public/COMPANY.md`
- `bootstrap/alquim-ia/public/agents/*/AGENTS.md`
- `bootstrap/alquim-ia/public/docs/ORGANIZATION.md`
- `bootstrap/alquim-ia/public/docs/SKILLS.md`
- `scripts/bootstrap-alquim-ia.mjs`
- `scripts/setup-alquim-ia.mjs`
- `scripts/setup-alquim-ia.sh`

## What Does Not Ship in the Public Branch

- the OpenClaw gateway token
- agent claim files
- Better Auth secrets
- active API keys
- private OpenClaw workspaces

## Private Configuration

Start from:

`bootstrap/alquim-ia/private-config.example.json`

Recommended path:

```bash
mkdir -p ~/.config/paperclip-bootstrap
cp bootstrap/alquim-ia/private-config.example.json ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

Then fill in:

- `paperclip.apiUrl`
- `paperclip.agentReachableApiUrl`
- `openclaw.gatewayUrl`
- `openclaw.gatewayToken`
- `openclaw.agentsSourceDir`
- `openclaw.skillsSourceDir`

## Guided Setup for Beginners

If you want the simplest possible route, use:

```bash
./scripts/setup-alquim-ia.sh
```

That wrapper:

1. validates the base system
2. installs the public OpenClaw release if it is missing
3. activates `pnpm` if needed
4. asks for the model provider API key
5. runs `openclaw onboard` in non-interactive mode
6. retrieves `gateway.auth.token`
7. installs agents and skills under `~/.openclaw`
8. starts local Paperclip
9. runs `bootstrap:alquim-ia`

The wizard also supports an optional private bundle at:

```text
~/.config/paperclip-bootstrap/alquim-ia.bundle
```

Recommended layout:

```text
agents/<slug>/AGENTS.md
skills/<skill>/SKILL.md
docs/ORGANIZATION.md
docs/SKILLS.md
```

If that bundle exists, the wizard overlays it on top of the public profile without asking for extra paths.

## One-Command Install

Run this from the repo root:

```bash
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

The installer will:

1. check the Paperclip health endpoint
2. create or update the `Alquim-IA` company
3. import the full curated roster
4. inject the real OpenClaw gateway configuration
5. generate one claim file per agent
6. copy your private OpenClaw agent folders into `~/.openclaw/agents`
7. run the post-install verification

## Preview Mode

```bash
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json --dry-run
```

## Idempotency

The installer is intentionally idempotent:

- if `Alquim-IA` already exists, it updates that company instead of creating a duplicate
- imported agents use `collisionStrategy=replace`
- claim files are regenerated
- existing bootstrap keys are rotated

## Operational Notes

- The profile excludes ephemeral smoke agents that existed only during the refactor QA work.
- The command assumes it is being run against a Paperclip instance that is reachable over loopback or a private network.
- For private or server installs, run it on the same host where `paperclip.apiUrl` is reachable.
