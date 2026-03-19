# Access And Onboarding

The access/onboarding path was refactored to reduce URL duplication and to make public URL resolution explicit.

## Goal

- Keep onboarding links stable across deployment modes.
- Prefer explicit public base URLs when they are configured.
- Fall back to request-derived forwarding headers only when no explicit public URL is available.

## URL Resolution Helpers

### `server/src/utils/public-url.ts`

- `resolveConfiguredPublicBaseUrl()`
  - Returns the configured public base URL from environment variables, in precedence order.
- `requestBaseUrl(req?)`
  - Resolves a request-scoped public base URL using explicit config first and forwarded headers second.
- `buildPublicUrl(path, req?)`
  - Joins a path onto the resolved public base URL.

## Current Precedence

The effective public base URL precedence is:

1. `PAPERCLIP_AUTH_PUBLIC_BASE_URL`
2. `BETTER_AUTH_URL`
3. `BETTER_AUTH_BASE_URL`
4. `PAPERCLIP_PUBLIC_URL`
5. forwarded request headers as a legacy fallback

## Files Using The Helper

- `server/src/routes/access.ts`
- `server/src/routes/access-onboarding.ts`

## Why This Matters

Before the refactor, access/onboarding code duplicated URL construction in multiple places. That made it harder to reason about:

- onboarding links,
- invite URLs,
- skill index URLs,
- manifest URLs,
- and the host/proxy behavior in public deployments.

The helper centralizes that behavior so tests can exercise the decision logic directly.

## Tests

- `server/src/__tests__/public-url.test.ts`
- `server/src/__tests__/start-server-orchestration.test.ts`

## Remaining Note

- The legacy request-header fallback is still present by design.
- That fallback should only be removed if a later wave fully commits to explicit public URL configuration in every deployment mode.
