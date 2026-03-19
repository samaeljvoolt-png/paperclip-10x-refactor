import type { Db } from "@paperclipai/db";
import type { Request as ExpressRequest, RequestHandler } from "express";
import { initializeBoardClaimChallenge } from "../board-claim.js";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import type { Config } from "../config.js";
import { logger } from "../middleware/logger.js";

type BetterAuthModule = typeof import("../auth/better-auth.js");

type AuthenticatedModeDeps = {
  loadBetterAuthModule?: () => Promise<BetterAuthModule>;
  initializeBoardClaimChallenge?: typeof initializeBoardClaimChallenge;
  logger?: Pick<typeof logger, "info">;
};

export type AuthenticatedModeBootstrap = {
  authReady: true;
  betterAuthHandler: RequestHandler;
  resolveSession: (req: ExpressRequest) => Promise<BetterAuthSessionResult | null>;
  resolveSessionFromHeaders: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
};

export function resolveAuthenticatedModeSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.BETTER_AUTH_SECRET?.trim() ?? env.PAPERCLIP_AGENT_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "authenticated mode requires BETTER_AUTH_SECRET (or PAPERCLIP_AGENT_JWT_SECRET) to be set",
    );
  }
  return secret;
}

export function resolveEnvTrustedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export async function bootstrapAuthenticatedMode(
  db: Db,
  config: Config,
  deps: AuthenticatedModeDeps = {},
): Promise<AuthenticatedModeBootstrap> {
  const loadBetterAuthModule =
    deps.loadBetterAuthModule ??
    (async () => import("../auth/better-auth.js"));
  const betterAuth = await loadBetterAuthModule();
  resolveAuthenticatedModeSecret();

  const derivedTrustedOrigins = betterAuth.deriveAuthTrustedOrigins(config);
  const envTrustedOrigins = resolveEnvTrustedOrigins();
  const effectiveTrustedOrigins = Array.from(
    new Set([...derivedTrustedOrigins, ...envTrustedOrigins]),
  );

  (deps.logger ?? logger).info(
    {
      authBaseUrlMode: config.authBaseUrlMode,
      authPublicBaseUrl: config.authPublicBaseUrl ?? null,
      trustedOrigins: effectiveTrustedOrigins,
      trustedOriginsSource: {
        derived: derivedTrustedOrigins.length,
        env: envTrustedOrigins.length,
      },
    },
    "Authenticated mode auth origin configuration",
  );

  const auth = betterAuth.createBetterAuthInstance(db, config, effectiveTrustedOrigins);
  const betterAuthHandler = betterAuth.createBetterAuthHandler(auth);
  const resolveSession = (req: ExpressRequest) =>
    betterAuth.resolveBetterAuthSession(auth, req);
  const resolveSessionFromHeaders = (headers: Headers) =>
    betterAuth.resolveBetterAuthSessionFromHeaders(auth, headers);

  await (deps.initializeBoardClaimChallenge ?? initializeBoardClaimChallenge)(
    db,
    { deploymentMode: config.deploymentMode },
  );

  return {
    authReady: true,
    betterAuthHandler,
    resolveSession,
    resolveSessionFromHeaders,
  };
}
