---
title: Alquim-IA Setup Wizard
summary: Guided installation for public OpenClaw + Paperclip + the Alquim-IA company
---

## Purpose

This wizard exists to remove the most fragile parts of the setup for a first-time operator:

- install public OpenClaw
- generate or recover the gateway token
- seed the Alquim-IA agents and skills
- start Paperclip locally
- create the full company in one pass

## Recommended Command

Run this from the repo root:

```bash
./scripts/setup-alquim-ia.sh
```

## What It Validates

- operating system: macOS or Linux
- `curl`
- `git`
- `node`
- `pnpm`
- `openclaw`

If `openclaw` is missing, the wrapper calls the official public installer:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

## What It Asks From the User

In the normal flow, only:

- the primary model provider
- the provider API key

If a key is already present in an environment variable, the wizard reuses it and does not ask again.

## What It Installs Into OpenClaw

- the `Alquim-IA` agent tree in `~/.openclaw/agents`
- the public skills from this repo in `~/.openclaw/skills`
- an optional private bundle in `~/.config/paperclip-bootstrap/alquim-ia.bundle`

## Optional Private Bundle

If you want the closest possible match to your private stack, create:

```text
~/.config/paperclip-bootstrap/alquim-ia.bundle/
```

With this structure:

```text
agents/<slug>/AGENTS.md
skills/<skill>/SKILL.md
docs/ORGANIZATION.md
docs/SKILLS.md
```

The wizard detects this bundle automatically and overlays it on top of the public profile.

## What It Persists

- private bootstrap config:
  - `~/.config/paperclip-bootstrap/alquim-ia.private.json`
- local Paperclip logs:
  - `~/.config/paperclip-bootstrap/alquim-ia/logs/paperclip.log`
- PID for the local Paperclip process started by the wizard:
  - `~/.config/paperclip-bootstrap/alquim-ia/paperclip.pid`

## What Happens After OpenClaw

1. runs `openclaw onboard --non-interactive`
2. forces a gateway token if one is missing
3. retrieves `gateway.auth.token`
4. builds the private Paperclip config
5. starts local Paperclip if it is not already healthy
6. runs `pnpm bootstrap:alquim-ia`

## Useful Flags

```bash
pnpm setup:alquim-ia --help
```

Important flags:

- `--provider <id>`
- `--api-key <key>`
- `--private-bundle <dir>`
- `--paperclip-public-url <url>`
- `--skip-openclaw-install`
- `--skip-openclaw-onboard`
- `--skip-paperclip-start`
- `--skip-bootstrap`
- `--dry-run`

## What the Public Branch Does Not Store

- real API keys
- the real gateway token
- active claim files
- private keys
- Better Auth secrets

## Recommended Next Step

When the wizard finishes:

1. open Paperclip at `http://127.0.0.1:3100`
2. verify that the `Alquim-IA` company exists
3. if you are using a domain or a remote deployment, update `paperclip.agentReachableApiUrl` in your private config and run `pnpm bootstrap:alquim-ia` again
