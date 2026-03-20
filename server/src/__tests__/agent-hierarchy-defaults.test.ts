import { describe, expect, it, vi } from "vitest";
import { agentService } from "../services/agents.ts";

function makeDbStub(selectResults: unknown[]) {
  const pendingSelects = [...selectResults];
  let capturedInsertValues: Record<string, unknown> | null = null;
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    then: vi.fn((resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(resolve(pendingSelects.shift() ?? [])),
    ),
  };
  const insertChain = {
    values: vi.fn((values: Record<string, unknown>) => {
      capturedInsertValues = values;
      return insertChain;
    }),
    returning: vi.fn(() => insertChain),
    then: vi.fn((resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(
        resolve([
          {
            id: "agent-created",
            companyId: "company-1",
            name: String(capturedInsertValues?.name ?? "New Agent"),
            role: String(capturedInsertValues?.role ?? "general"),
            title: (capturedInsertValues?.title as string | null | undefined) ?? null,
            reportsTo: (capturedInsertValues?.reportsTo as string | null | undefined) ?? null,
            capabilities: (capturedInsertValues?.capabilities as string | null | undefined) ?? null,
            adapterType: String(capturedInsertValues?.adapterType ?? "process"),
            adapterConfig: (capturedInsertValues?.adapterConfig as Record<string, unknown>) ?? {},
            runtimeConfig: (capturedInsertValues?.runtimeConfig as Record<string, unknown>) ?? {},
            budgetMonthlyCents: Number(capturedInsertValues?.budgetMonthlyCents ?? 0),
            metadata: (capturedInsertValues?.metadata as Record<string, unknown> | null) ?? null,
            permissions: (capturedInsertValues?.permissions as Record<string, unknown> | null) ?? null,
            status: String(capturedInsertValues?.status ?? "idle"),
            pauseReason: null,
            pausedAt: null,
            spentMonthlyCents: 0,
            lastHeartbeatAt: null,
            icon: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      ),
    ),
  };

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
    },
    get capturedInsertValues() {
      return capturedInsertValues;
    },
  };
}

describe("agent hierarchy defaults", () => {
  it("fills a default manager when reportsTo is omitted", async () => {
    const dbStub = makeDbStub([
      [
        {
          id: "ceo-1",
          companyId: "company-1",
          name: "CEO",
          role: "ceo",
          status: "idle",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      [],
    ]);

    const agents = agentService(dbStub.db as any);
    const created = await agents.create("company-1", {
      name: "Engineer One",
      role: "engineer",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
    });

    expect(dbStub.capturedInsertValues?.reportsTo).toBe("ceo-1");
    expect(created.reportsTo).toBe("ceo-1");
  });

  it("keeps an explicit root agent at the top", async () => {
    const dbStub = makeDbStub([
      [],
      [],
    ]);

    const agents = agentService(dbStub.db as any);
    const created = await agents.create("company-1", {
      name: "CEO",
      role: "ceo",
      reportsTo: null,
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
    });

    expect(dbStub.capturedInsertValues?.reportsTo).toBeNull();
    expect(created.reportsTo).toBeNull();
  });

  it("routes gateway controllers to the CEO instead of creating a parallel root", async () => {
    const dbStub = makeDbStub([
      [
        {
          id: "ceo-1",
          companyId: "company-1",
          name: "CEO",
          role: "ceo",
          status: "idle",
          title: "Chief Executive Officer",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      [],
    ]);

    const agents = agentService(dbStub.db as any);
    const created = await agents.create("company-1", {
      name: "Sammy",
      title: "Legacy Controller",
      role: "general",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
    });

    expect(dbStub.capturedInsertValues?.reportsTo).toBe("ceo-1");
    expect(created.reportsTo).toBe("ceo-1");
  });

  it("routes growth work through the CMO domain when a CMO exists", async () => {
    const dbStub = makeDbStub([
      [
        {
          id: "ceo-1",
          companyId: "company-1",
          name: "CEO",
          role: "ceo",
          status: "idle",
          title: "Chief Executive Officer",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "cmo-1",
          companyId: "company-1",
          name: "CMO",
          role: "cmo",
          status: "idle",
          title: "Chief Marketing Officer",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      [],
    ]);

    const agents = agentService(dbStub.db as any);
    const created = await agents.create("company-1", {
      name: "Growth Hacker",
      title: "Growth Lead",
      role: "general",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      budgetMonthlyCents: 0,
    });

    expect(dbStub.capturedInsertValues?.reportsTo).toBe("cmo-1");
    expect(created.reportsTo).toBe("cmo-1");
  });
});
