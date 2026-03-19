import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  createDb: vi.fn(),
  inspectMigrations: vi.fn(),
  ensureMigrations: vi.fn(),
  createApp: vi.fn(),
  bootstrapAuthenticatedMode: vi.fn(),
  setupHeartbeatScheduler: vi.fn(),
  setupDatabaseBackupScheduler: vi.fn(),
  startServerListener: vi.fn(),
  setupLiveEventsWebSocketServer: vi.fn(),
  reconcilePersistedRuntimeServicesOnStartup: vi.fn(),
  createStorageServiceFromConfig: vi.fn(),
  detectPort: vi.fn(),
  printStartupBanner: vi.fn(),
}));

vi.mock("../config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("@paperclipai/db", () => ({
  createDb: mocks.createDb,
  ensurePostgresDatabase: vi.fn(),
  getPostgresDataDirectory: vi.fn(),
  inspectMigrations: mocks.inspectMigrations,
  applyPendingMigrations: vi.fn(),
  reconcilePendingMigrationHistory: vi.fn(),
  formatDatabaseBackupResult: vi.fn(),
  runDatabaseBackup: vi.fn(),
  authUsers: {},
  companies: {},
  companyMemberships: {},
  instanceUserRoles: {},
}));

vi.mock("detect-port", () => ({
  default: mocks.detectPort,
}));

vi.mock("../app.js", () => ({
  createApp: mocks.createApp,
}));

vi.mock("../bootstrap/authenticated-mode.js", () => ({
  bootstrapAuthenticatedMode: mocks.bootstrapAuthenticatedMode,
}));

vi.mock("../bootstrap/heartbeat-scheduler.js", () => ({
  setupHeartbeatScheduler: mocks.setupHeartbeatScheduler,
}));

vi.mock("../bootstrap/database-backup-scheduler.js", () => ({
  setupDatabaseBackupScheduler: mocks.setupDatabaseBackupScheduler,
}));

vi.mock("../bootstrap/server-listener.js", () => ({
  startServerListener: mocks.startServerListener,
}));

vi.mock("../realtime/live-events-ws.js", () => ({
  setupLiveEventsWebSocketServer: mocks.setupLiveEventsWebSocketServer,
}));

vi.mock("../services/index.js", () => ({
  reconcilePersistedRuntimeServicesOnStartup: mocks.reconcilePersistedRuntimeServicesOnStartup,
}));

vi.mock("../storage/index.js", () => ({
  createStorageServiceFromConfig: mocks.createStorageServiceFromConfig,
}));

vi.mock("../startup-banner.js", () => ({
  printStartupBanner: mocks.printStartupBanner,
}));

import { startServer } from "../index.js";

function buildConfig(overrides: Record<string, unknown> = {}) {
  return {
    deploymentMode: "authenticated",
    deploymentExposure: "private",
    host: "127.0.0.1",
    port: 3100,
    allowedHostnames: ["paperclip.example.com"],
    authBaseUrlMode: "explicit",
    authPublicBaseUrl: "https://paperclip.example.com",
    authDisableSignUp: false,
    databaseMode: "postgres",
    databaseUrl: "postgres://paperclip:paperclip@localhost:5432/paperclip",
    embeddedPostgresDataDir: "/tmp/paperclip-db",
    embeddedPostgresPort: 54329,
    databaseBackupEnabled: true,
    databaseBackupIntervalMinutes: 60,
    databaseBackupRetentionDays: 30,
    databaseBackupDir: "/tmp/backups",
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

afterEach(() => {
  vi.clearAllMocks();
});

describe("startServer orchestration", () => {
  it("wires bootstrap helpers in order and returns started server info", async () => {
    const stopHeartbeat = vi.fn();
    const stopBackup = vi.fn();

    mocks.loadConfig.mockReturnValue(buildConfig());
    mocks.createDb.mockReturnValue({ db: true });
    mocks.inspectMigrations.mockResolvedValue({ status: "upToDate" });
    mocks.createStorageServiceFromConfig.mockReturnValue({ provider: "local_disk" });
    mocks.bootstrapAuthenticatedMode.mockResolvedValue({
      authReady: true,
      betterAuthHandler: vi.fn(),
      resolveSession: vi.fn(),
      resolveSessionFromHeaders: vi.fn(),
    });
    mocks.setupHeartbeatScheduler.mockReturnValue(stopHeartbeat);
    mocks.setupDatabaseBackupScheduler.mockReturnValue(stopBackup);
    mocks.detectPort.mockResolvedValue(3100);
    mocks.createApp.mockResolvedValue(() => undefined);
    mocks.setupLiveEventsWebSocketServer.mockReturnValue(undefined);
    mocks.reconcilePersistedRuntimeServicesOnStartup.mockResolvedValue({ reconciled: 0 });
    mocks.startServerListener.mockResolvedValue(undefined);

    const started = await startServer();

    expect(started).toMatchObject({
      host: "127.0.0.1",
      listenPort: 3100,
      apiUrl: "http://127.0.0.1:3100",
      databaseUrl: "postgres://paperclip:paperclip@localhost:5432/paperclip",
    });
    expect(mocks.bootstrapAuthenticatedMode).toHaveBeenCalledWith({ db: true }, buildConfig());
    expect(mocks.setupHeartbeatScheduler).toHaveBeenCalledWith({ db: true }, {
      enabled: true,
      intervalMs: 30000,
    });
    expect(mocks.setupDatabaseBackupScheduler).toHaveBeenCalledWith({
      connectionString: "postgres://paperclip:paperclip@localhost:5432/paperclip",
      enabled: true,
      intervalMinutes: 60,
      retentionDays: 30,
      backupDir: "/tmp/backups",
    });
    expect(mocks.startServerListener).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "127.0.0.1",
        listenPort: 3100,
        authReady: true,
      }),
    );
    expect(stopHeartbeat).not.toHaveBeenCalled();
    expect(stopBackup).not.toHaveBeenCalled();
  });

  it("cleans up schedulers when listener startup fails", async () => {
    const stopHeartbeat = vi.fn();
    const stopBackup = vi.fn();

    mocks.loadConfig.mockReturnValue(buildConfig());
    mocks.createDb.mockReturnValue({ db: true });
    mocks.inspectMigrations.mockResolvedValue({ status: "upToDate" });
    mocks.createStorageServiceFromConfig.mockReturnValue({ provider: "local_disk" });
    mocks.bootstrapAuthenticatedMode.mockResolvedValue({
      authReady: true,
      betterAuthHandler: vi.fn(),
      resolveSession: vi.fn(),
      resolveSessionFromHeaders: vi.fn(),
    });
    mocks.setupHeartbeatScheduler.mockReturnValue(stopHeartbeat);
    mocks.setupDatabaseBackupScheduler.mockReturnValue(stopBackup);
    mocks.detectPort.mockResolvedValue(3100);
    mocks.createApp.mockResolvedValue(() => undefined);
    mocks.setupLiveEventsWebSocketServer.mockReturnValue(undefined);
    mocks.reconcilePersistedRuntimeServicesOnStartup.mockResolvedValue({ reconciled: 0 });
    mocks.startServerListener.mockRejectedValue(new Error("listen failed"));

    await expect(startServer()).rejects.toThrow("listen failed");
    expect(stopHeartbeat).toHaveBeenCalledTimes(1);
    expect(stopBackup).toHaveBeenCalledTimes(1);
  });
});
