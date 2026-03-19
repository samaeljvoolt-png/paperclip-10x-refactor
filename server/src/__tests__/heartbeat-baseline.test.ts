import { describe, expect, it, vi } from "vitest";
import { heartbeatService } from "../services/heartbeat.js";

function createEmptyDbStub() {
  const query = {
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    set: vi.fn(() => query),
    values: vi.fn(() => query),
    returning: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve([]))),
    catch: vi.fn(() => Promise.resolve([])),
  };

  return {
    db: {
      select: vi.fn(() => ({ from: vi.fn(() => query) })),
      update: vi.fn(() => ({ set: vi.fn(() => query) })),
      insert: vi.fn(() => ({ values: vi.fn(() => query) })),
      delete: vi.fn(() => query),
      execute: vi.fn(async () => []),
      transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    },
  };
}

describe("heartbeat baseline harness", () => {
  it("records span timings for the empty-state control path", async () => {
    const records: Array<{ span: string; durationMs: number; meta?: Record<string, unknown> }> = [];
    const profiler = {
      record(span: string, durationMs: number, meta?: Record<string, unknown>) {
        records.push({ span, durationMs, meta });
      },
    };

    const { db } = createEmptyDbStub();
    const svc = heartbeatService(db as never, { profiler });

    await svc.reapOrphanedRuns();
    await svc.resumeQueuedRuns();
    await svc.tickTimers(new Date("2026-03-19T12:00:00.000Z"));

    expect(records.map((record) => record.span)).toEqual([
      "reapOrphanedRuns",
      "resumeQueuedRuns",
      "tickTimers",
    ]);
    expect(records.every((record) => record.durationMs >= 0)).toBe(true);
    expect(records[2]?.meta).toEqual({ now: "2026-03-19T12:00:00.000Z" });
  });
});
