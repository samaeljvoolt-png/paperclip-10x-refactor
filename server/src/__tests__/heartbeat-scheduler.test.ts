import { describe, expect, it, vi, afterEach } from "vitest";
import { setupHeartbeatScheduler } from "../bootstrap/heartbeat-scheduler.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setupHeartbeatScheduler", () => {
  it("does nothing when heartbeat scheduler is disabled", () => {
    const heartbeatServiceFactory = vi.fn();
    const setIntervalFn = vi.fn();
    const clearIntervalFn = vi.fn();

    const cleanup = setupHeartbeatScheduler({} as never, { enabled: false, intervalMs: 30000 }, {
      heartbeatServiceFactory,
      setIntervalFn,
      clearIntervalFn,
    });

    cleanup();
    expect(heartbeatServiceFactory).not.toHaveBeenCalled();
    expect(setIntervalFn).not.toHaveBeenCalled();
    expect(clearIntervalFn).not.toHaveBeenCalled();
  });

  it("runs startup recovery and schedules periodic ticks", async () => {
    const reapOrphanedRuns = vi.fn(async () => ({ reaped: 1, runIds: ["run-1"] }));
    const resumeQueuedRuns = vi.fn(async () => undefined);
    const tickTimers = vi.fn(async () => ({ enqueued: 2 }));
    const heartbeatServiceFactory = vi.fn(() => ({
      reapOrphanedRuns,
      resumeQueuedRuns,
      tickTimers,
    }));
    const clearIntervalFn = vi.fn();
    const setIntervalFn = vi.fn((callback: () => void) => {
      void callback();
      return 123 as never;
    });
    const info = vi.fn();
    const error = vi.fn();

    const cleanup = setupHeartbeatScheduler({} as never, { enabled: true, intervalMs: 60000 }, {
      heartbeatServiceFactory,
      setIntervalFn,
      clearIntervalFn,
      logger: { info, error, warn: vi.fn() },
      now: () => new Date("2026-03-19T12:00:00.000Z"),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(heartbeatServiceFactory).toHaveBeenCalledWith(expect.anything());
    expect(reapOrphanedRuns).toHaveBeenCalledTimes(2);
    expect(resumeQueuedRuns).toHaveBeenCalledTimes(2);
    expect(tickTimers).toHaveBeenCalledWith(new Date("2026-03-19T12:00:00.000Z"));
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 60000);
    cleanup();
    expect(clearIntervalFn).toHaveBeenCalledWith(123);
    expect(info).toHaveBeenCalledWith(
      { enqueued: 2 },
      "heartbeat timer tick enqueued runs",
    );
    expect(error).not.toHaveBeenCalled();
  });
});
