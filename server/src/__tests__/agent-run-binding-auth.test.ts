import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agentApiKeys, agents, heartbeatRuns } from "@paperclipai/db";
import { createLocalAgentJwt } from "../agent-auth-jwt.js";
import { actorMiddleware } from "../middleware/auth.js";

function createDbStub(input: {
  agent: { id: string; companyId: string; status?: string } | null;
  run: { id: string; agentId: string; companyId: string } | null;
}) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === agentApiKeys) return [];
          if (table === agents) {
            return input.agent
              ? [
                  {
                    id: input.agent.id,
                    companyId: input.agent.companyId,
                    status: input.agent.status ?? "active",
                  },
                ]
              : [];
          }
          if (table === heartbeatRuns) {
            return input.run
              ? [
                  {
                    id: input.run.id,
                    agentId: input.run.agentId,
                    companyId: input.run.companyId,
                  },
                ]
              : [];
          }
          return [];
        },
      }),
    }),
  };
}

function createApp(db: ReturnType<typeof createDbStub>) {
  const app = express();
  app.use(actorMiddleware(db as never, { deploymentMode: "authenticated" }));
  app.get("/api/agents/me", (req, res) => {
    if (req.actor.type !== "agent" || !req.actor.agentId) {
      res.status(401).json({ error: "Agent authentication required" });
      return;
    }
    res.json({ agentId: req.actor.agentId, companyId: req.actor.companyId, runId: req.actor.runId });
  });
  return app;
}

function createLocalTrustedApp(db: ReturnType<typeof createDbStub>) {
  const app = express();
  app.use(actorMiddleware(db as never, { deploymentMode: "local_trusted" }));
  app.get("/whoami", (req, res) => {
    res.json(req.actor);
  });
  return app;
}

describe("actor middleware run binding", () => {
  const secretEnv = "PAPERCLIP_AGENT_JWT_SECRET";
  const ttlEnv = "PAPERCLIP_AGENT_JWT_TTL_SECONDS";
  const originalSecret = process.env[secretEnv];
  const originalTtl = process.env[ttlEnv];

  beforeEach(() => {
    process.env[secretEnv] = "test-secret";
    process.env[ttlEnv] = "3600";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env[secretEnv];
    else process.env[secretEnv] = originalSecret;
    if (originalTtl === undefined) delete process.env[ttlEnv];
    else process.env[ttlEnv] = originalTtl;
  });

  it("allows an agent jwt when the run belongs to that same agent", async () => {
    const token = createLocalAgentJwt("agent-1", "company-1", "openclaw_gateway", "run-1");
    const app = createApp(
      createDbStub({
        agent: { id: "agent-1", companyId: "company-1" },
        run: { id: "run-1", agentId: "agent-1", companyId: "company-1" },
      }),
    );

    const res = await request(app)
      .get("/api/agents/me")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Paperclip-Run-Id", "run-1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
    });
  });

  it("rejects an agent jwt when the run belongs to a different agent", async () => {
    const token = createLocalAgentJwt("agent-1", "company-1", "openclaw_gateway", "run-1");
    const app = createApp(
      createDbStub({
        agent: { id: "agent-1", companyId: "company-1" },
        run: { id: "run-1", agentId: "agent-2", companyId: "company-1" },
      }),
    );

    const res = await request(app)
      .get("/api/agents/me")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Paperclip-Run-Id", "run-1");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Agent authentication required");
  });

  it("does not fall back to local board when a run-id header is present", async () => {
    const app = createLocalTrustedApp(
      createDbStub({
        agent: null,
        run: null,
      }),
    );

    const res = await request(app).get("/whoami").set("X-Paperclip-Run-Id", "run-1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ type: "none", source: "none" });
  });
});
