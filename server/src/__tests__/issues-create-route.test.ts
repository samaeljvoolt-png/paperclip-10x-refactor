import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  create: vi.fn(),
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
}));

const noopService = {
  getById: vi.fn(),
  list: vi.fn(),
  getByIdentifier: vi.fn(),
  getAncestors: vi.fn(),
  findMentionedProjectIds: vi.fn(),
  getCommentCursor: vi.fn(),
  getComment: vi.fn(),
  listForIssue: vi.fn(),
  getIssueDocumentPayload: vi.fn(),
  listIssueDocuments: vi.fn(),
  getIssueDocumentByKey: vi.fn(),
  upsertIssueDocument: vi.fn(),
  listIssueDocumentRevisions: vi.fn(),
  deleteIssueDocument: vi.fn(),
  markRead: vi.fn(),
  addComment: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  listAttachments: vi.fn(),
  listLabels: vi.fn(),
  createLabel: vi.fn(),
  getLabelById: vi.fn(),
  deleteLabel: vi.fn(),
  checkout: vi.fn(),
  assertCheckoutOwner: vi.fn(),
  listComments: vi.fn(),
  createAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentById: vi.fn(),
  linkLabel: vi.fn(),
  unlinkLabel: vi.fn(),
  findMentionedAgents: vi.fn(),
};

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  executionWorkspaceService: () => noopService,
  goalService: () => noopService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => noopService,
  issueService: () => mockIssueService,
  documentService: () => noopService,
  logActivity: vi.fn().mockResolvedValue(undefined),
  projectService: () => noopService,
  workProductService: () => noopService,
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
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccessService.canUser.mockResolvedValue(true);
    mockAccessService.hasPermission.mockResolvedValue(true);
    mockHeartbeatService.wakeup.mockResolvedValue(undefined);
  });

  it("promotes assigned issues without an explicit status to todo and wakes the assignee", async () => {
    mockIssueService.create.mockImplementation(async (_companyId: string, payload: Record<string, unknown>) => ({
      id: "issue-1",
      companyId: "company-1",
      identifier: "ALQ-99",
      title: payload.title,
      status: payload.status,
      assigneeAgentId: payload.assigneeAgentId,
    }));

    const res = await request(createApp())
      .post("/api/companies/company-1/issues")
      .send({
        title: "Delegated specialist task",
        assigneeAgentId: "11111111-1111-4111-8111-111111111111",
      });

    expect(res.status).toBe(201);
    expect(mockIssueService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        title: "Delegated specialist task",
        assigneeAgentId: "11111111-1111-4111-8111-111111111111",
        status: "todo",
      }),
    );
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        source: "assignment",
        reason: "issue_assigned",
        payload: { issueId: "issue-1", mutation: "create" },
      }),
    );
  });

  it("keeps unassigned issues in backlog by default", async () => {
    mockIssueService.create.mockImplementation(async (_companyId: string, payload: Record<string, unknown>) => ({
      id: "issue-2",
      companyId: "company-1",
      identifier: "ALQ-100",
      title: payload.title,
      status: payload.status,
      assigneeAgentId: null,
    }));

    const res = await request(createApp())
      .post("/api/companies/company-1/issues")
      .send({
        title: "Unassigned backlog task",
      });

    expect(res.status).toBe(201);
    expect(mockIssueService.create).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        title: "Unassigned backlog task",
        status: "backlog",
      }),
    );
    expect(mockHeartbeatService.wakeup).not.toHaveBeenCalled();
  });
});
