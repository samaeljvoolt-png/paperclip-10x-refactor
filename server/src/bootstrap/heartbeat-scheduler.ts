import type { Db } from "@paperclipai/db";
import { heartbeatService } from "../services/heartbeat.js";
import { logger } from "../middleware/logger.js";

type HeartbeatSchedulerDeps = {
  heartbeatServiceFactory?: typeof heartbeatService;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  logger?: Pick<typeof logger, "info" | "error" | "warn">;
  now?: () => Date;
};

export function setupHeartbeatScheduler(
  db: Db,
  opts: { enabled: boolean; intervalMs: number },
  deps: HeartbeatSchedulerDeps = {},
): () => void {
  if (!opts.enabled) return () => undefined;

  const heartbeatFactory = deps.heartbeatServiceFactory ?? heartbeatService;
  const heartbeat = heartbeatFactory(db);
  const interval = deps.setIntervalFn ?? setInterval;
  const clear = deps.clearIntervalFn ?? clearInterval;
  const log = deps.logger ?? logger;
  const now = deps.now ?? (() => new Date());

  // Recover persisted work immediately after process start, then keep driving timers.
  void heartbeat
    .reapOrphanedRuns()
    .then(() => heartbeat.resumeQueuedRuns())
    .catch((err) => {
      log.error({ err }, "startup heartbeat recovery failed");
    });

  const timer = interval(() => {
    void heartbeat
      .tickTimers(now())
      .then((result) => {
        if (result.enqueued > 0) {
          log.info({ ...result }, "heartbeat timer tick enqueued runs");
        }
      })
      .catch((err) => {
        log.error({ err }, "heartbeat timer tick failed");
      });

    void heartbeat
      .reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })
      .then(() => heartbeat.resumeQueuedRuns())
      .catch((err) => {
        log.error({ err }, "periodic heartbeat recovery failed");
      });
  }, opts.intervalMs);

  return () => {
    clear(timer);
  };
}
