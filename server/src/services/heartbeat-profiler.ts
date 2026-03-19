import { performance } from "node:perf_hooks";
import { logger } from "../middleware/logger.js";

export type HeartbeatProfileSpan =
  | "reapOrphanedRuns"
  | "resumeQueuedRuns"
  | "startNextQueuedRunForAgent"
  | "resolveWorkspaceForRun"
  | "executeRun"
  | "tickTimers";

export type HeartbeatProfileMeta = Record<string, unknown> | undefined;

export interface HeartbeatProfiler {
  record(span: HeartbeatProfileSpan, durationMs: number, meta?: HeartbeatProfileMeta): void;
}

export async function withHeartbeatProfile<T>(
  profiler: HeartbeatProfiler | null | undefined,
  span: HeartbeatProfileSpan,
  fn: () => Promise<T> | T,
  meta?: HeartbeatProfileMeta,
): Promise<T> {
  if (!profiler) {
    return await fn();
  }

  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    profiler.record(span, performance.now() - startedAt, meta);
  }
}

export function createLoggingHeartbeatProfiler(): HeartbeatProfiler {
  return {
    record(span, durationMs, meta) {
      logger.info(
        {
          span,
          durationMs: Number(durationMs.toFixed(3)),
          ...(meta ?? {}),
        },
        "heartbeat span measured",
      );
    },
  };
}
