import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDatabaseBackupScheduler } from "../bootstrap/database-backup-scheduler.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setupDatabaseBackupScheduler", () => {
  it("does nothing when backups are disabled", () => {
    const runDatabaseBackupFn = vi.fn();
    const setIntervalFn = vi.fn();
    const clearIntervalFn = vi.fn();

    const cleanup = setupDatabaseBackupScheduler(
      {
        connectionString: "postgres://paperclip",
        enabled: false,
        intervalMinutes: 60,
        retentionDays: 30,
        backupDir: "/tmp/backups",
      },
      { runDatabaseBackupFn, setIntervalFn, clearIntervalFn },
    );

    cleanup();
    expect(runDatabaseBackupFn).not.toHaveBeenCalled();
    expect(setIntervalFn).not.toHaveBeenCalled();
    expect(clearIntervalFn).not.toHaveBeenCalled();
  });

  it("runs and schedules backups", async () => {
    const runDatabaseBackupFn = vi.fn(async () => ({
      backupFile: "/tmp/backups/backup.sql.gz",
      sizeBytes: 123,
      prunedCount: 1,
    }));
    const setIntervalFn = vi.fn((callback: () => void) => {
      void callback();
      return 123 as never;
    });
    const clearIntervalFn = vi.fn();
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();

    const cleanup = setupDatabaseBackupScheduler(
      {
        connectionString: "postgres://paperclip",
        enabled: true,
        intervalMinutes: 60,
        retentionDays: 30,
        backupDir: "/tmp/backups",
      },
      {
        runDatabaseBackupFn,
        setIntervalFn,
        clearIntervalFn,
        logger: { info, warn, error },
      },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(runDatabaseBackupFn).toHaveBeenCalledWith({
      connectionString: "postgres://paperclip",
      backupDir: "/tmp/backups",
      retentionDays: 30,
      filenamePrefix: "paperclip",
    });
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
    cleanup();
    expect(clearIntervalFn).toHaveBeenCalledWith(123);
    expect(info).toHaveBeenCalledWith(
      {
        intervalMinutes: 60,
        retentionDays: 30,
        backupDir: "/tmp/backups",
      },
      "Automatic database backups enabled",
    );
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
