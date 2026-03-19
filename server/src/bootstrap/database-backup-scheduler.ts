import { runDatabaseBackup, formatDatabaseBackupResult } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

type DatabaseBackupSchedulerDeps = {
  runDatabaseBackupFn?: typeof runDatabaseBackup;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  logger?: Pick<typeof logger, "info" | "warn" | "error">;
};

export function setupDatabaseBackupScheduler(
  input: {
    connectionString: string;
    enabled: boolean;
    intervalMinutes: number;
    retentionDays: number;
    backupDir: string;
  },
  deps: DatabaseBackupSchedulerDeps = {},
): () => void {
  if (!input.enabled) return () => undefined;

  const runBackup = deps.runDatabaseBackupFn ?? runDatabaseBackup;
  const scheduleInterval = deps.setIntervalFn ?? setInterval;
  const clear = deps.clearIntervalFn ?? clearInterval;
  const log = deps.logger ?? logger;
  const backupIntervalMs = input.intervalMinutes * 60 * 1000;
  let backupInFlight = false;

  const runScheduledBackup = async () => {
    if (backupInFlight) {
      log.warn("Skipping scheduled database backup because a previous backup is still running");
      return;
    }

    backupInFlight = true;
    try {
      const result = await runBackup({
        connectionString: input.connectionString,
        backupDir: input.backupDir,
        retentionDays: input.retentionDays,
        filenamePrefix: "paperclip",
      });
      log.info(
        {
          backupFile: result.backupFile,
          sizeBytes: result.sizeBytes,
          prunedCount: result.prunedCount,
          backupDir: input.backupDir,
          retentionDays: input.retentionDays,
        },
        `Automatic database backup complete: ${formatDatabaseBackupResult(result)}`,
      );
    } catch (err) {
      log.error({ err, backupDir: input.backupDir }, "Automatic database backup failed");
    } finally {
      backupInFlight = false;
    }
  };

  log.info(
    {
      intervalMinutes: input.intervalMinutes,
      retentionDays: input.retentionDays,
      backupDir: input.backupDir,
    },
    "Automatic database backups enabled",
  );

  const timer = scheduleInterval(() => {
    void runScheduledBackup();
  }, backupIntervalMs);

  return () => {
    clear(timer);
  };
}
