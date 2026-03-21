<div align="center">
  <strong>Paperclip Refactor Foundation</strong>
  <br/>
  A public, reproducible install path for Paperclip + OpenClaw teams, with a guided Alquim-IA bootstrap.
</div>

<br/>

<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="#installation-paths"><strong>Install</strong></a> &middot;
  <a href="#troubleshooting"><strong>Troubleshooting</strong></a> &middot;
  <a href="https://paperclip.ing/docs"><strong>Docs</strong></a> &middot;
  <a href="https://github.com/samaeljvoolt-png/paperclip-refactor-foundation"><strong>GitHub</strong></a>
</p>

<p align="center">
  <a href="https://github.com/samaeljvoolt-png/paperclip-refactor-foundation/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/samaeljvoolt-png/paperclip-refactor-foundation/stargazers"><img src="https://img.shields.io/github/stars/samaeljvoolt-png/paperclip-refactor-foundation?style=flat" alt="Stars" /></a>
  <a href="https://discord.gg/m4HZY7xNG3"><img src="https://img.shields.io/discord/000000000?label=discord" alt="Discord" /></a>
</p>

## What this branch is

Paperclip Refactor Foundation is the public, reproducible foundation for installing and operating an Alquim-IA company on top of Paperclip and OpenClaw.

OpenClaw provides the agents. Paperclip coordinates the company.

This branch exists so a non-technical operator can get from zero to a working company without hand-wiring agents, claims, gateway wiring, or deliverable enforcement.

## What you get

- A beginner-friendly setup wizard that validates the local machine before it touches the stack.
- A one-command bootstrap path for the full Alquim-IA company profile.
- Preconfigured agents and skills in the public branch.
- Per-agent claim files instead of one shared global claim file.
- Exact-path deliverable enforcement for tasks that require a file, report, or artifact.
- Reproducible smoke tests for the wizard and orchestration flow.
- A public/private split so secrets stay out of the branch while the company structure stays reproducible.

## Quickstart

```bash
./scripts/setup-alquim-ia.sh
```

That is the recommended route for a first-time install.

What the wizard does:

1. validates the local environment
2. installs the public OpenClaw CLI if it is missing
3. asks for only the provider API key
4. generates or recovers the OpenClaw gateway token
5. seeds the curated Alquim-IA agents and skills
6. starts Paperclip locally
7. bootstraps the company into the running instance

If you only want to inspect the public repo without installing anything, read the docs first:

- [Alquim-IA Setup Wizard](./docs/deploy/alquim-ia-setup-wizard.md)
- [Alquim-IA Bootstrap](./docs/deploy/alquim-ia-bootstrap.md)

## Installation Paths

### Beginner path

Use this path if you want the least friction and are installing from scratch.

```bash
./scripts/setup-alquim-ia.sh
```

The wrapper is designed to keep the operator out of the weeds. It validates `curl`, `git`, `bash`, `node`, `pnpm`, and `openclaw`; if `openclaw` is missing, it installs the public version through the official installer.

After that, it moves through OpenClaw onboarding, captures the gateway token, writes the private bootstrap config, and finishes by running the Paperclip bootstrap step.

### Manual or private path

Use this path if you already manage secrets, run a remote server, or want to control the company bootstrap explicitly.

```bash
mkdir -p ~/.config/paperclip-bootstrap
cp bootstrap/alquim-ia/private-config.example.json ~/.config/paperclip-bootstrap/alquim-ia.private.json
pnpm bootstrap:alquim-ia --private-config ~/.config/paperclip-bootstrap/alquim-ia.private.json
```

Fill the private config with your real values for:

- `paperclip.apiUrl`
- `paperclip.agentReachableApiUrl`
- `openclaw.gatewayUrl`
- `openclaw.gatewayToken`
- `openclaw.agentsSourceDir`
- `openclaw.skillsSourceDir`

## Verification

After a successful install, check these first:

```bash
curl -sS http://127.0.0.1:3100/api/health | jq
pnpm paperclipai doctor
```

Then confirm that:

- the `Alquim-IA` company exists
- the imported agents use `openclaw_gateway`
- the gateway token is non-empty
- the issue you asked for has a work product before it is closed

If you want a reproducible end-to-end smoke, use the setup wizard smoke harness:

```bash
node scripts/smoke/alquim-ia-setup-wizard-e2e.mjs
```

## Public vs private

What ships in this public branch:

- `bootstrap/alquim-ia/public/*`
- `scripts/setup-alquim-ia.sh`
- `scripts/setup-alquim-ia.mjs`
- `scripts/bootstrap-alquim-ia.mjs`
- `docs/deploy/alquim-ia-setup-wizard.md`
- `docs/deploy/alquim-ia-bootstrap.md`
- the smoke and test coverage that proves the install works

What stays private:

- API keys
- gateway tokens
- claim files with active credentials
- Better Auth secrets
- private OpenClaw workspaces
- local master keys and runtime secrets

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Instance setup required` or `Instance admin required` | The instance has no first board admin yet | Run `pnpm paperclipai auth bootstrap-ceo` in the Paperclip environment, open the invite URL it generates, and create the first admin. |
| `OpenClaw was not added to PATH` after install | The shell has not reloaded PATH or the official installer did not finish cleanly | Open a new terminal, run `hash -r`, verify `command -v openclaw`, and rerun `./scripts/setup-alquim-ia.sh`. |
| `Command not found in PATH: "codex"` | A `codex_local` agent was launched but the Codex CLI is not installed or not on PATH | Install the Codex CLI or use a different adapter; for the public Alquim-IA flow, prefer the `openclaw_gateway` agents that do not depend on `codex`. |
| OpenClaw join or claim never completes | The invite prompt was not generated, pasted, or approved in the right place | Regenerate the invite prompt from Paperclip, paste it into a stock OpenClaw session, approve the join/device request, and retry the task. |
| A deliverable issue will not close | The issue requires proof of output, not just a comment | Create the file or artifact first, then register a work product with the exact absolute `metadata.path` or a verifiable URL before marking the issue done. |
| Oracle or reverse-proxy login loops | The external URL and the internal agent-reachable URL do not match | Set `PAPERCLIP_PUBLIC_URL`, `PAPERCLIP_AUTH_PUBLIC_BASE_URL`, and `PAPERCLIP_ALLOWED_HOSTNAMES` correctly, keep `paperclip.agentReachableApiUrl` reachable from the gateway, and rerun the bootstrap. |

### Oracle / remote server note

For Oracle or any remote deployment, use the same repo flow but keep the boundaries clear:

- Public browser traffic should point at the public origin.
- Agent callbacks should use the private or internal URL that the gateway can reach.
- The auth bootstrap must happen before the first operator login.
- If you expose the UI behind a reverse proxy, confirm the forwarded host and public URL match the origin you actually use.

## Reference docs

- [API Authentication](./docs/api/authentication.md)
- [Secrets Management](./docs/deploy/secrets.md)
- [OpenClaw Onboarding](./doc/OPENCLAW_ONBOARDING.md)
- [OpenClaw Docker Setup](./docs/guides/openclaw-docker-setup.md)
- [Board Operator: Managing Agents](./docs/guides/board-operator/managing-agents.md)
- [Board Operator: Managing Tasks](./docs/guides/board-operator/managing-tasks.md)

## Why this fork exists

Paperclip is the control plane for a company of agents.

This fork focuses on the operational layer that makes that idea usable in practice:

- startup that can be repeated
- public profile that can be audited
- company structure that can be imported
- claims that do not collide across agents
- deliverables that can be verified before closure
- smoke tests that catch regressions before they reach production

If you want the shortest path to a working company template, start with the wizard. If you want to customize the private parts, use the manual bootstrap and keep the public branch clean.
