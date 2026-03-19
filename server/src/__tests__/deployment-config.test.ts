import { describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { assertValidDeploymentConfig } from "../bootstrap/deployment-config.js";

function buildConfig(overrides: Partial<Config> = {}): Config {
  return {
    deploymentMode: "local_trusted",
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
    companyDeletionEnabled: true,
    ...overrides,
  };
}

describe("assertValidDeploymentConfig", () => {
  it("allows local_trusted loopback configuration", () => {
    expect(() => assertValidDeploymentConfig(buildConfig())).not.toThrow();
  });

  it("rejects local_trusted with non-loopback host", () => {
    expect(() => assertValidDeploymentConfig(buildConfig({ host: "0.0.0.0" }))).toThrow(
      /loopback host binding/,
    );
  });

  it("rejects local_trusted public exposure", () => {
    expect(() =>
      assertValidDeploymentConfig(buildConfig({ deploymentExposure: "public" })),
    ).toThrow(/only supports private exposure/);
  });

  it("rejects authenticated public mode without explicit base url mode", () => {
    expect(() =>
      assertValidDeploymentConfig(
        buildConfig({
          deploymentMode: "authenticated",
          deploymentExposure: "public",
          authBaseUrlMode: "auto",
        }),
      ),
    ).toThrow(/requires auth.baseUrlMode=explicit/);
  });

  it("rejects authenticated public mode without authPublicBaseUrl", () => {
    expect(() =>
      assertValidDeploymentConfig(
        buildConfig({
          deploymentMode: "authenticated",
          deploymentExposure: "public",
          authBaseUrlMode: "explicit",
          authPublicBaseUrl: undefined,
        }),
      ),
    ).toThrow(/requires auth.publicBaseUrl/);
  });
});
