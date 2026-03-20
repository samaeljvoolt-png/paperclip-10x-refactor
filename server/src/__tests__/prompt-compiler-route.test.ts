import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptCompilerRoutes } from "../routes/prompt-compiler.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn().mockResolvedValue(undefined),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockResolvedValue(true),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  list: vi.fn(),
}));

const mockDocumentService = vi.hoisted(() => ({
  upsertIssueDocument: vi.fn().mockResolvedValue({ id: "doc-1" }),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  documentService: () => mockDocumentService,
  heartbeatService: () => mockHeartbeatService,
  issueService: () => mockIssueService,
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", promptCompilerRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("prompt compiler routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.list.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        companyId: "company-1",
        name: "CEO",
        role: "ceo",
        status: "active",
        title: "CEO",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        companyId: "company-1",
        name: "CTO",
        role: "cto",
        status: "active",
        title: "CTO",
      },
    ]);
  });

  it("compiles a request into a brief and issue draft", async () => {
    const res = await request(createApp())
      .post("/api/companies/company-1/prompt-compiler/compile")
      .send({
        rawRequest: "Create a benchmark sandbox app and keep the final report in Spanish.",
        additionalContext: "This should compare several models and produce evidence.",
      });

    expect(res.status).toBe(200);
    expect(res.body.brief.schemaVersion).toBe("prompt_compiler.v1");
    expect(res.body.issueDraft.title).toBeTruthy();
    expect(res.body.validation.gateStatus).toBeDefined();
  });

  it("creates an issue from a passing compiled brief and persists documents", async () => {
    mockIssueService.create.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      identifier: "ALQ-200",
      title: "Benchmark sandbox",
      status: "todo",
      assigneeAgentId: "11111111-1111-4111-8111-111111111111",
    });
    mockIssueService.getById.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      identifier: "ALQ-200",
      title: "Benchmark sandbox",
      status: "todo",
      assigneeAgentId: "11111111-1111-4111-8111-111111111111",
      description: "Compiled description",
    });

    const compile = await request(createApp())
      .post("/api/companies/company-1/prompt-compiler/compile")
      .send({
        rawRequest: "Build a benchmark sandbox for comparing models.",
        additionalContext: "The issue should be executable and verified.",
        preferredLanguage: "en",
      });

    const res = await request(createApp())
      .post("/api/companies/company-1/prompt-compiler/issues")
      .send({
        rawRequest: "Build a benchmark sandbox for comparing models.",
        additionalContext: "The issue should be executable and verified.",
        preferredLanguage: "en",
        brief: compile.body.brief,
        issueDraft: compile.body.issueDraft,
        issue: {
          title: compile.body.issueDraft.title,
          description: compile.body.issueDraft.description,
          priority: "high",
          assigneeAgentId: "11111111-1111-4111-8111-111111111111",
        },
      });

    expect(res.status).toBe(201);
    expect(mockIssueService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        title: compile.body.issueDraft.title,
        assigneeAgentId: "11111111-1111-4111-8111-111111111111",
        status: "todo",
      }),
    );
    expect(mockDocumentService.upsertIssueDocument).toHaveBeenCalledTimes(2);
    expect(mockHeartbeatService.wakeup).toHaveBeenCalled();
  });
});
