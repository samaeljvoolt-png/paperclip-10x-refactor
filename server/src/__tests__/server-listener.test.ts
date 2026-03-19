import { describe, expect, it, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { startServerListener } from "../bootstrap/server-listener.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startServerListener", () => {
  it("starts the server and emits startup banner wiring", async () => {
    const listen = vi.fn((port: number, host: string, cb: () => void) => {
      cb();
      return undefined as never;
    });
    const off = vi.fn();
    const once = vi.fn();
    const server = new EventEmitter() as never;
    (server as { listen: typeof listen; off: typeof off; once: typeof once }).listen = listen;
    (server as { listen: typeof listen; off: typeof off; once: typeof once }).off = off;
    (server as { listen: typeof listen; off: typeof off; once: typeof once }).once = once;
    const info = vi.fn();
    const warn = vi.fn();

    await startServerListener(
      {
        server,
        host: "127.0.0.1",
        listenPort: 3100,
        requestedPort: 3100,
        deploymentMode: "local_trusted",
        deploymentExposure: "private",
        authReady: true,
        uiMode: "static",
        db: { mode: "mock" },
        migrationSummary: "skipped",
        heartbeatSchedulerEnabled: true,
        heartbeatSchedulerIntervalMs: 30000,
        databaseBackupEnabled: true,
        databaseBackupIntervalMinutes: 60,
        databaseBackupRetentionDays: 30,
        databaseBackupDir: "/tmp/backups",
      },
      { logger: { info, warn } },
    );

    expect(listen).toHaveBeenCalledWith(3100, "127.0.0.1", expect.any(Function));
    expect(info).toHaveBeenCalledWith("Server listening on 127.0.0.1:3100");
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses injected openFn when open-on-listen is enabled", async () => {
    const original = process.env.PAPERCLIP_OPEN_ON_LISTEN;
    process.env.PAPERCLIP_OPEN_ON_LISTEN = "true";
    const listen = vi.fn((port: number, host: string, cb: () => void) => {
      cb();
      return undefined as never;
    });
    const off = vi.fn();
    const once = vi.fn();
    const server = new EventEmitter() as never;
    (server as { listen: typeof listen; off: typeof off; once: typeof once }).listen = listen;
    (server as { listen: typeof listen; off: typeof off; once: typeof once }).off = off;
    (server as { listen: typeof listen; off: typeof off; once: typeof once }).once = once;
    const openFn = vi.fn(async () => undefined);

    try {
      await startServerListener(
        {
          server,
          host: "0.0.0.0",
          listenPort: 3100,
          requestedPort: 3100,
          deploymentMode: "local_trusted",
          deploymentExposure: "private",
          authReady: true,
          uiMode: "static",
          db: { mode: "mock" },
          migrationSummary: "skipped",
          heartbeatSchedulerEnabled: true,
          heartbeatSchedulerIntervalMs: 30000,
          databaseBackupEnabled: true,
          databaseBackupIntervalMinutes: 60,
          databaseBackupRetentionDays: 30,
          databaseBackupDir: "/tmp/backups",
        },
        { openFn },
      );
    } finally {
      process.env.PAPERCLIP_OPEN_ON_LISTEN = original;
    }

    expect(openFn).toHaveBeenCalledWith("http://127.0.0.1:3100");
  });
});
