import fs from "node:fs";
import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { desc, eq } from "drizzle-orm";
import {
  applyPendingMigrations,
  createDb,
  ensurePostgresDatabase,
  type Db,
  agents,
  companies,
  issues,
  projects,
  heartbeatRuns,
  projectWorkspaces,
} from "@paperclipai/db";
import { heartbeatService } from "../services/heartbeat.js";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

const tempPaths: string[] = [];
const runningInstances: EmbeddedPostgresInstance[] = [];

async function getEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const mod = await import("embedded-postgres");
  return mod.default as EmbeddedPostgresCtor;
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function createTempDatabase(): Promise<string> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-heartbeat-baseline-"));
  tempPaths.push(dataDir);
  const port = await getAvailablePort();
  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await instance.initialise();
  await instance.start();
  runningInstances.push(instance);

  const adminUrl = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
  await ensurePostgresDatabase(adminUrl, "paperclip");
  const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  await applyPendingMigrations(connectionString);
  return connectionString;
}

afterEach(async () => {
  while (runningInstances.length > 0) {
    const instance = runningInstances.pop();
    if (!instance) continue;
    await instance.stop();
  }
  while (tempPaths.length > 0) {
    const tempPath = tempPaths.pop();
    if (!tempPath) continue;
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
});

async function waitForRunState(db: Db, runId: string, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId))
      .then((rows) => rows[0] ?? null);
    if (result && ["succeeded", "failed", "cancelled", "timed_out"].includes(result.status)) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for heartbeat run ${runId}`);
}

async function createProcessAgent(
  db: Db,
  companyId: string,
  name: string,
  command: string,
  extra?: Partial<typeof agents.$inferInsert>,
) {
  const [agent] = await db
    .insert(agents)
    .values({
      companyId,
      name,
      role: "engineer",
      title: "Engineer",
      status: "idle",
      adapterType: "process",
      adapterConfig: { command: "bash", args: ["-lc", command] },
      runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
      budgetMonthlyCents: 10_000,
      ...extra,
    })
    .returning();
  return agent!;
}

describe("heartbeat live baseline", () => {
  it(
    "captures a real run baseline on the process adapter",
    async () => {
      const connectionString = await createTempDatabase();
      const db = createDb(connectionString);

      const [company] = await db
        .insert(companies)
        .values({
          name: "Heartbeat Baseline Co",
          description: "baseline",
          status: "active",
          budgetMonthlyCents: 50_000,
        })
        .returning();

      const [agent] = await db
        .insert(agents)
        .values({
          companyId: company!.id,
          name: "Heartbeat Baseline Agent",
          role: "engineer",
          title: "Engineer",
          status: "idle",
          adapterType: "process",
          adapterConfig: { command: "bash", args: ["-lc", "printf 'baseline run\\n'"] },
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
          budgetMonthlyCents: 10_000,
        })
        .returning();

      const records: Array<{ span: string; durationMs: number; meta?: Record<string, unknown> }> = [];
      const profiler = {
        record(span: string, durationMs: number, meta?: Record<string, unknown>) {
          records.push({ span, durationMs, meta });
        },
      };

      const svc = heartbeatService(db as never, { profiler });
      const run = await svc.invoke(agent!.id, "on_demand", {}, "manual");
      expect(run).not.toBeNull();

      const finalRun = await waitForRunState(db, run!.id);
      expect(finalRun.status).toBe("succeeded");

      const profiledSpans = records.map((record) => record.span);
      expect(profiledSpans).toContain("startNextQueuedRunForAgent");
      expect(profiledSpans).toContain("resolveWorkspaceForRun");
      expect(records.every((record) => record.durationMs >= 0)).toBe(true);

      const summary = {
        runId: run!.id,
        status: finalRun.status,
        spans: records,
      };

      console.info(JSON.stringify(summary, null, 2));
    },
    120_000,
  );

  it(
    "captures a project-scoped baseline on the process adapter",
    async () => {
      const connectionString = await createTempDatabase();
      const db = createDb(connectionString);

      const [company] = await db
        .insert(companies)
        .values({
          name: "Heartbeat Project Baseline Co",
          description: "baseline",
          status: "active",
          budgetMonthlyCents: 50_000,
        })
        .returning();

      const [agent] = await db
        .insert(agents)
        .values({
          companyId: company!.id,
          name: "Heartbeat Project Agent",
          role: "engineer",
          title: "Engineer",
          status: "idle",
          adapterType: "process",
          adapterConfig: { command: "bash", args: ["-lc", "printf 'project baseline run\\n'"] },
          runtimeConfig: { heartbeat: { enabled: true, intervalSec: 30 } },
          budgetMonthlyCents: 10_000,
        })
        .returning();

      const projectWorkspaceDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "paperclip-heartbeat-project-workspace-"),
      );
      tempPaths.push(projectWorkspaceDir);
      fs.writeFileSync(path.join(projectWorkspaceDir, "README.md"), "project baseline\n", "utf8");
      const gitInit = (args: string[]) => {
        const result = spawnSync("git", args, {
          cwd: projectWorkspaceDir,
          stdio: "pipe",
        });
        if (result.status !== 0) {
          throw new Error(
            `Failed to run git ${args.join(" ")}: ${String(result.stderr ?? result.stdout ?? "")}`,
          );
        }
      };
      gitInit(["init", "-b", "main"]);
      gitInit(["config", "user.name", "Heartbeat Baseline"]);
      gitInit(["config", "user.email", "heartbeat-baseline@example.com"]);
      gitInit(["add", "README.md"]);
      gitInit(["commit", "-m", "Initial project baseline"]);

      const [project] = await db
        .insert(projects)
        .values({
          companyId: company!.id,
          name: "Heartbeat Project",
          description: "baseline project",
          status: "in_progress",
          leadAgentId: agent!.id,
        })
        .returning();

      const [projectWorkspace] = await db
        .insert(projectWorkspaces)
        .values({
          companyId: company!.id,
          projectId: project!.id,
          name: "Heartbeat Project Workspace",
          cwd: projectWorkspaceDir,
          isPrimary: true,
        })
        .returning();

      const [issue] = await db
        .insert(issues)
        .values({
          companyId: company!.id,
          projectId: project!.id,
          projectWorkspaceId: projectWorkspace!.id,
          title: "Measure project-scoped heartbeat",
          description: "baseline",
          status: "todo",
          priority: "high",
          identifier: "HB-PROJECT-1",
          createdByAgentId: agent!.id,
          executionWorkspaceSettings: { mode: "shared_workspace" },
        })
        .returning();

      const records: Array<{ span: string; durationMs: number; meta?: Record<string, unknown> }> = [];
      const profiler = {
        record(span: string, durationMs: number, meta?: Record<string, unknown>) {
          records.push({ span, durationMs, meta });
        },
      };

      const svc = heartbeatService(db as never, { profiler });
      const run = await svc.invoke(agent!.id, "on_demand", { issueId: issue!.id }, "manual");
      expect(run).not.toBeNull();

      const finalRun = await waitForRunState(db, run!.id);
      expect(finalRun.status).toBe("succeeded");

      const profiledSpans = records.map((record) => record.span);
      expect(profiledSpans).toContain("startNextQueuedRunForAgent");
      expect(profiledSpans).toContain("resolveWorkspaceForRun");
      expect(profiledSpans).toContain("executeRun");
      expect(records.every((record) => record.durationMs >= 0)).toBe(true);

      console.info(
        JSON.stringify(
          {
            runId: run!.id,
            status: finalRun.status,
            projectWorkspaceId: projectWorkspace!.id,
            issueId: issue!.id,
            spans: records,
          },
          null,
          2,
        ),
      );
    },
    120_000,
  );

  it(
    "captures maintenance baselines for reaping, resuming, and timer ticks",
    async () => {
      const connectionString = await createTempDatabase();
      const db = createDb(connectionString);
      const now = new Date();

      const [company] = await db
        .insert(companies)
        .values({
          name: "Heartbeat Maintenance Co",
          description: "baseline",
          status: "active",
          budgetMonthlyCents: 50_000,
        })
        .returning();

      const reaperAgent = await createProcessAgent(db, company!.id, "Heartbeat Reaper Agent", "printf 'reaped run\\n'");
      const resumerAgent = await createProcessAgent(db, company!.id, "Heartbeat Resumer Agent", "printf 'resumed run\\n'");
      const timerAgent = await createProcessAgent(db, company!.id, "Heartbeat Timer Agent", "printf 'timer run\\n'");

      await db
        .insert(heartbeatRuns)
        .values({
          companyId: company!.id,
          agentId: reaperAgent.id,
          invocationSource: "timer",
          triggerDetail: "manual",
          status: "running",
          startedAt: new Date(now.getTime() - 120_000),
          updatedAt: new Date(now.getTime() - 120_000),
          contextSnapshot: { maintenance: "reap" },
        })
        .returning();

      const [queuedRun] = await db
        .insert(heartbeatRuns)
        .values({
          companyId: company!.id,
          agentId: resumerAgent.id,
          invocationSource: "on_demand",
          triggerDetail: "manual",
          status: "queued",
          contextSnapshot: { maintenance: "resume" },
        })
        .returning();

      await db
        .update(agents)
        .set({ lastHeartbeatAt: new Date(now.getTime() - 120_000) })
        .where(eq(agents.id, timerAgent.id));

      const records: Array<{ span: string; durationMs: number; meta?: Record<string, unknown> }> = [];
      const profiler = {
        record(span: string, durationMs: number, meta?: Record<string, unknown>) {
          records.push({ span, durationMs, meta });
        },
      };

      const svc = heartbeatService(db as never, { profiler });

      await svc.reapOrphanedRuns();
      const reapedRun = await waitForRunState(
        db,
        (
          await db
            .select()
            .from(heartbeatRuns)
            .where(eq(heartbeatRuns.agentId, reaperAgent.id))
            .then((rows) => rows[0] ?? null)
        )!.id,
      );
      expect(reapedRun.status).toBe("failed");

      await svc.resumeQueuedRuns();
      const resumedRun = await waitForRunState(db, queuedRun!.id);
      expect(resumedRun.status).toBe("succeeded");

      const tickResult = await svc.tickTimers(now);
      expect(tickResult.enqueued).toBeGreaterThanOrEqual(1);
      const [timerRun] = await db
        .select()
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.agentId, timerAgent.id))
        .orderBy(desc(heartbeatRuns.createdAt))
        .limit(1);
      const timerFinal = await waitForRunState(db, timerRun!.id);
      expect(timerFinal.status).toBe("succeeded");

      const profiledSpans = records.map((record) => record.span);
      expect(profiledSpans).toContain("reapOrphanedRuns");
      expect(profiledSpans).toContain("resumeQueuedRuns");
      expect(profiledSpans).toContain("tickTimers");
      expect(profiledSpans).toContain("startNextQueuedRunForAgent");
      expect(records.every((record) => record.durationMs >= 0)).toBe(true);

      console.info(
        JSON.stringify(
          {
            reaperRunId: reapedRun.id,
            resumedRunId: resumedRun.id,
            timerRunId: timerFinal.id,
            tickResult,
            spans: records,
          },
          null,
          2,
        ),
      );
    },
    120_000,
  );

  it(
    "captures queued-run contention for a single agent",
    async () => {
      const connectionString = await createTempDatabase();
      const db = createDb(connectionString);

      const [company] = await db
        .insert(companies)
        .values({
          name: "Heartbeat Contention Co",
          description: "baseline",
          status: "active",
          budgetMonthlyCents: 50_000,
        })
        .returning();

      const agent = await createProcessAgent(
        db,
        company!.id,
        "Heartbeat Contention Agent",
        "sleep 0.15; printf 'contention run\\n'",
      );

      const queuedRuns = await db
        .insert(heartbeatRuns)
        .values([
          {
            companyId: company!.id,
            agentId: agent.id,
            invocationSource: "on_demand",
            triggerDetail: "manual",
            status: "queued",
            contextSnapshot: { contention: 1 },
          },
          {
            companyId: company!.id,
            agentId: agent.id,
            invocationSource: "on_demand",
            triggerDetail: "manual",
            status: "queued",
            contextSnapshot: { contention: 2 },
          },
          {
            companyId: company!.id,
            agentId: agent.id,
            invocationSource: "on_demand",
            triggerDetail: "manual",
            status: "queued",
            contextSnapshot: { contention: 3 },
          },
        ])
        .returning();

      const records: Array<{ span: string; durationMs: number; meta?: Record<string, unknown> }> = [];
      const profiler = {
        record(span: string, durationMs: number, meta?: Record<string, unknown>) {
          records.push({ span, durationMs, meta });
        },
      };

      const svc = heartbeatService(db as never, { profiler });
      await svc.resumeQueuedRuns();

      const finalRuns = await Promise.all(
        queuedRuns.map(async (run) => {
          const finalRun = await waitForRunState(db, run.id);
          expect(finalRun.status).toBe("succeeded");
          return finalRun;
        }),
      );

      const profiledSpans = records.map((record) => record.span);
      expect(profiledSpans.filter((span) => span === "executeRun").length).toBeGreaterThanOrEqual(3);
      expect(profiledSpans.filter((span) => span === "startNextQueuedRunForAgent").length).toBeGreaterThanOrEqual(3);
      expect(profiledSpans).toContain("resumeQueuedRuns");
      expect(records.every((record) => record.durationMs >= 0)).toBe(true);

      console.info(
        JSON.stringify(
          {
            runIds: finalRuns.map((run) => run.id),
            spans: records,
          },
          null,
          2,
        ),
      );
    },
    120_000,
  );
});
