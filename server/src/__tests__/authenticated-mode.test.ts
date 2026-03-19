import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../config.js";
import {
  bootstrapAuthenticatedMode,
  resolveAuthenticatedModeSecret,
} from "../bootstrap/authenticated-mode.js";

function buildConfig(overrides: Partial<Config> = {}): Config {
  return {
    deploymentMode: "authenticated",
    deploymentExposure: "private",
    host: "127.0.0.1",
    port: 3100,
    allowedHostnames: [],
    authBaseUrlMode: "auto",
    authPublicBaseUrl: undefined,
    authDisableSignUp: false,
    databaseMode: "embedded-postgres",
    databaseUrl: undefined,
    embeddedPostgresDataDir: "/tmp/paperclip-db",
    embeddedPostgresPort: 54329,
    databaseBackupEnabled: true,
    databaseBackupIntervalMinutes: 60,
    databaseBackupRetentionDays: 30,
    databaseBackupDir: "/tmp/paperclip-backups",
    serveUi: true,
    uiDevMiddleware: false,
    secretsProvider: "local_encrypted",
    secretsStrictMode: false,
    secretsMasterKeyFilePath: "/tmp/master.key",
    storageProvider: "local_disk",
    storageLocalDiskBaseDir: "/tmp/storage",
    storageS3Bucket: "paperclip",
    storageS3Region: "us-east-1",
    storageS3Endpoint: undefined,
    storageS3Prefix: "",
    storageS3ForcePathStyle: false,
    heartbeatSchedulerEnabled: true,
    heartbeatSchedulerIntervalMs: 30000,
    companyDeletionEnabled: false,
    ...overrides,
  };
}

const originalEnv = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  PAPERCLIP_AGENT_JWT_SECRET: process.env.PAPERCLIP_AGENT_JWT_SECRET,
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
};

afterEach(() => {
  process.env.BETTER_AUTH_SECRET = originalEnv.BETTER_AUTH_SECRET;
  process.env.PAPERCLIP_AGENT_JWT_SECRET = originalEnv.PAPERCLIP_AGENT_JWT_SECRET;
  process.env.BETTER_AUTH_TRUSTED_ORIGINS = originalEnv.BETTER_AUTH_TRUSTED_ORIGINS;
  vi.restoreAllMocks();
});

describe("authenticated mode bootstrap", () => {
  it("requires an auth secret", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.PAPERCLIP_AGENT_JWT_SECRET;

    await expect(
      bootstrapAuthenticatedMode({} as never, buildConfig(), {
        loadBetterAuthModule: async () => ({
          createBetterAuthHandler: vi.fn(),
          createBetterAuthInstance: vi.fn(),
          deriveAuthTrustedOrigins: vi.fn(() => []),
          resolveBetterAuthSession: vi.fn(),
          resolveBetterAuthSessionFromHeaders: vi.fn(),
        }),
      }),
    ).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("falls back to PAPERCLIP_AGENT_JWT_SECRET when BETTER_AUTH_SECRET is absent", () => {
    delete process.env.BETTER_AUTH_SECRET;
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "fallback-secret";

    expect(resolveAuthenticatedModeSecret()).toBe("fallback-secret");
  });

  it("wires auth runtime and merges trusted origins from config and env", async () => {
    process.env.BETTER_AUTH_SECRET = "super-secret";
    process.env.BETTER_AUTH_TRUSTED_ORIGINS =
      "https://env.example.com, https://shared.example.com";

    const auth = { kind: "auth-instance" };
    const handler = vi.fn();
    const sessionResult = {
      session: { id: "s1", userId: "u1" },
      user: { id: "u1", email: "u1@example.com", name: "User 1" },
    };
    const createBetterAuthInstance = vi.fn(() => auth);
    const createBetterAuthHandler = vi.fn(() => handler);
    const resolveBetterAuthSession = vi.fn(async () => sessionResult);
    const resolveBetterAuthSessionFromHeaders = vi.fn(async () => sessionResult);
    const initializeBoardClaimChallenge = vi.fn(async () => undefined);
    const info = vi.fn();
    const config = buildConfig({
      authBaseUrlMode: "explicit",
      authPublicBaseUrl: "https://paperclip.example.com",
      allowedHostnames: ["ops.example.com"],
    });

    const runtime = await bootstrapAuthenticatedMode({} as never, config, {
      loadBetterAuthModule: async () => ({
        createBetterAuthHandler,
        createBetterAuthInstance,
        deriveAuthTrustedOrigins: vi.fn(() => [
          "https://paperclip.example.com",
          "https://shared.example.com",
        ]),
        resolveBetterAuthSession,
        resolveBetterAuthSessionFromHeaders,
      }),
      initializeBoardClaimChallenge,
      logger: { info },
    });

    expect(createBetterAuthInstance).toHaveBeenCalledWith(
      expect.anything(),
      config,
      [
        "https://paperclip.example.com",
        "https://shared.example.com",
        "https://env.example.com",
      ],
    );
    expect(createBetterAuthHandler).toHaveBeenCalledWith(auth);
    expect(initializeBoardClaimChallenge).toHaveBeenCalledWith(
      expect.anything(),
      { deploymentMode: "authenticated" },
    );
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        authBaseUrlMode: "explicit",
        authPublicBaseUrl: "https://paperclip.example.com",
        trustedOrigins: [
          "https://paperclip.example.com",
          "https://shared.example.com",
          "https://env.example.com",
        ],
      }),
      "Authenticated mode auth origin configuration",
    );
    await expect(runtime.resolveSession({} as never)).resolves.toEqual(sessionResult);
    await expect(runtime.resolveSessionFromHeaders(new Headers())).resolves.toEqual(sessionResult);
    expect(runtime.authReady).toBe(true);
    expect(runtime.betterAuthHandler).toBe(handler);
    expect(resolveBetterAuthSession).toHaveBeenCalledWith(auth, expect.anything());
    expect(resolveBetterAuthSessionFromHeaders).toHaveBeenCalledWith(auth, expect.any(Headers));
  });
});
