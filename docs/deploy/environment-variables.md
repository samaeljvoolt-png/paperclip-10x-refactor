---
title: Environment Variables
summary: Current environment variable reference
---

This page documents the environment variables currently used by Paperclip for server configuration and runtime behavior.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `PAPERCLIP_HOME` | `~/.paperclip` | Base directory for all Paperclip data |
| `PAPERCLIP_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `PAPERCLIP_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | mode-dependent | Explicit exposure override for non-`local_trusted` deployments |
| `SERVE_UI` | `true` | Whether the API server serves the UI |
| `PAPERCLIP_UI_DEV_MIDDLEWARE` | `false` | Enable Vite dev middleware mode |
| `HEARTBEAT_SCHEDULER_ENABLED` | `true` | Enable scheduled heartbeat wakeups |
| `HEARTBEAT_SCHEDULER_INTERVAL_MS` | `30000` | Heartbeat scheduler interval in milliseconds |
| `PAPERCLIP_HEARTBEAT_PROFILE` | `false` | Emit heartbeat span timings through the server logger |
| `PAPERCLIP_ENABLE_COMPANY_DELETION` | mode-dependent | Allow company deletion APIs |

## Auth And Public URL

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_AUTH_BASE_URL_MODE` | `auto` | Auth base URL resolution mode |
| `PAPERCLIP_AUTH_PUBLIC_BASE_URL` | unset | Explicit public base URL for auth callbacks and public links |
| `PAPERCLIP_PUBLIC_URL` | unset | Fallback public URL source |
| `BETTER_AUTH_URL` | unset | Better Auth-compatible public base URL |
| `BETTER_AUTH_BASE_URL` | unset | Better Auth-compatible public base URL alias |
| `PAPERCLIP_ALLOWED_HOSTNAMES` | unset | Comma-separated allowlist for private hostname guard |
| `PAPERCLIP_AUTH_DISABLE_SIGN_UP` | `false` | Disable self-serve sign-up |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `PAPERCLIP_SECRETS_MASTER_KEY_FILE` | `~/.paperclip/.../secrets/master.key` | Path to key file |
| `PAPERCLIP_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |
| `PAPERCLIP_SECRETS_PROVIDER` | `local_encrypted` | Active secrets backend |

## Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_STORAGE_PROVIDER` | `local_disk` | Storage backend |
| `PAPERCLIP_STORAGE_LOCAL_DIR` | instance data dir | Base directory for local file storage |
| `PAPERCLIP_STORAGE_S3_BUCKET` | `paperclip` | S3 bucket name |
| `PAPERCLIP_STORAGE_S3_REGION` | `us-east-1` | S3 region |
| `PAPERCLIP_STORAGE_S3_ENDPOINT` | unset | Custom S3-compatible endpoint |
| `PAPERCLIP_STORAGE_S3_PREFIX` | empty | Path prefix inside bucket |
| `PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE` | `false` | Force path-style S3 addressing |

## Database Backups

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERCLIP_DB_BACKUP_ENABLED` | `true` | Enable periodic backups |
| `PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES` | `60` | Backup interval in minutes |
| `PAPERCLIP_DB_BACKUP_RETENTION_DAYS` | `30` | Backup retention window |
| `PAPERCLIP_DB_BACKUP_DIR` | instance backup dir | Backup output directory |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `PAPERCLIP_AGENT_ID` | Agent's unique ID |
| `PAPERCLIP_COMPANY_ID` | Company ID |
| `PAPERCLIP_API_URL` | Paperclip API base URL |
| `PAPERCLIP_API_KEY` | Short-lived JWT for API auth |
| `PAPERCLIP_RUN_ID` | Current heartbeat run ID |
| `PAPERCLIP_TASK_ID` | Issue that triggered this wake |
| `PAPERCLIP_WAKE_REASON` | Wake trigger reason |
| `PAPERCLIP_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `PAPERCLIP_APPROVAL_ID` | Resolved approval ID |
| `PAPERCLIP_APPROVAL_STATUS` | Approval decision |
| `PAPERCLIP_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |

## Notes

- In local development, leave `DATABASE_URL` unset to use embedded Postgres.
- `PAPERCLIP_DEPLOYMENT_MODE=local_trusted` intentionally enables a permissive local workflow; do not assume production-style requirements from that mode.
- Some values are mode-dependent and may be derived from config file defaults, not just environment variables.
- This reference reflects the current runtime contract and may evolve as the refactor continues.
