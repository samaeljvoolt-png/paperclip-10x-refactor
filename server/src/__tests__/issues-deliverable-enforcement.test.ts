import express from "express";
import os from "node:os";
import path from "node:path";
import { writeFileSync } from "node:fs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  update: vi.fn(),
  assertCheckoutOwner: vi.fn(),
  addComment: vi.fn(),
  findMentionedAgents: vi.fn(),
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

const mockWorkProductService = vi.hoisted(() => ({
  listForIssue: vi.fn(),
  createForIssue: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
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
  remove: vi.fn(),
  listAttachments: vi.fn(),
  listLabels: vi.fn(),
  createLabel: vi.fn(),
  getLabelById: vi.fn(),
  deleteLabel: vi.fn(),
  checkout: vi.fn(),
  listComments: vi.fn(),
  createAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentById: vi.fn(),
  linkLabel: vi.fn(),
  unlinkLabel: vi.fn(),
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
  workProductService: () => mockWorkProductService,
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

describe("issue deliverable enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getById.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      identifier: "ALQ-200",
      title: "Audit site and deliver HTML report",
      description: "Deliver a single HTML file with findings.",
      status: "in_progress",
      assigneeAgentId: null,
      assigneeUserId: null,
      createdByUserId: "user-1",
    });
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.update.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      identifier: "ALQ-200",
      title: "Audit site and deliver HTML report",
      description: "Deliver a single HTML file with findings.",
      status: "done",
      assigneeAgentId: null,
      assigneeUserId: null,
    });
    mockIssueService.addComment.mockResolvedValue(null);
    mockIssueService.findMentionedAgents.mockResolvedValue([]);
    mockWorkProductService.listForIssue.mockResolvedValue([]);
  });

  it("rejects closing a deliverable issue without a verifiable work product", async () => {
    const res = await request(createApp()).patch("/api/issues/issue-1").send({ status: "done" });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Deliverable evidence required");
    expect(mockIssueService.update).not.toHaveBeenCalled();
  });

  it("allows closing a deliverable issue when an artifact points to an existing absolute file", async () => {
    const reportPath = path.join(os.tmpdir(), `paperclip-audit-${Date.now()}.html`);
    writeFileSync(reportPath, "<!doctype html><title>audit</title>");
    mockWorkProductService.listForIssue.mockResolvedValue([
      {
        id: "wp-1",
        companyId: "company-1",
        projectId: null,
        issueId: "issue-1",
        executionWorkspaceId: null,
        runtimeServiceId: null,
        type: "artifact",
        provider: "paperclip",
        externalId: null,
        title: "academy audit report",
        url: null,
        status: "ready_for_review",
        reviewState: "none",
        isPrimary: true,
        healthStatus: "healthy",
        summary: null,
        metadata: { path: reportPath },
        createdByRunId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await request(createApp()).patch("/api/issues/issue-1").send({ status: "done" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("issue-1", { status: "done" });
  });
});
