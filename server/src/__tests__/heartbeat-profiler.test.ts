import { describe, expect, it, vi } from "vitest";
import { withHeartbeatProfile } from "../services/heartbeat-profiler.js";

describe("withHeartbeatProfile", () => {
  it("returns the wrapped result and records the measured span", async () => {
    const record = vi.fn();
    const profiler = { record };

    const result = await withHeartbeatProfile(profiler, "tickTimers", async () => {
      await Promise.resolve();
      return { checked: 3, enqueued: 1, skipped: 2 };
    });

    expect(result).toEqual({ checked: 3, enqueued: 1, skipped: 2 });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      "tickTimers",
      expect.any(Number),
      undefined,
    );
  });

  it("records the span even when the wrapped function throws", async () => {
    const record = vi.fn();
    const profiler = { record };
    const error = new Error("boom");

    await expect(
      withHeartbeatProfile(profiler, "reapOrphanedRuns", async () => {
        throw error;
      }),
    ).rejects.toThrow("boom");

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      "reapOrphanedRuns",
      expect.any(Number),
      undefined,
    );
  });
});
