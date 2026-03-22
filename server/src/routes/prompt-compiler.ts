import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createIssueFromCompiledBriefSchema,
  type PromptCompilerBrief,
  promptCompilerCompileRequestSchema,
  type PromptCompilerValidationResult,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { forbidden, unauthorized } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { accessService, agentService, documentService, heartbeatService, issueService, logActivity } from "../services/index.js";
import { canAssignTasksByRole } from "../services/agent-permissions.js";
import { logger } from "../middleware/logger.js";
import { compilePromptCompilerBrief, validateCompiledBrief } from "../services/prompt-compiler.js";

function buildRawIntentDocument(input: { rawRequest: string; additionalContext?: string | null; preferredLanguage?: string }) {
  const lines = [
    "# Prompt Intent",
    "",
    "## Raw Request",
    input.rawRequest.trim(),
  ];
  if (input.additionalContext?.trim()) {
    lines.push("", "## Additional Context", input.additionalContext.trim());
  }
  lines.push("", "## Preferred Language", input.preferredLanguage ?? "auto");
  return lines.join("\n");
}

function buildCompiledBriefDocument(input: {
  brief: PromptCompilerBrief;
  validation: PromptCompilerValidationResult;
}) {
  const { brief, validation } = input;
  const isSpanish = brief.language === "es";
  const labels = {
    objective: isSpanish ? "Objetivo" : "Objective",
    problemStatement: isSpanish ? "Problema" : "Problem Statement",
    context: isSpanish ? "Contexto" : "Context",
    inScope: isSpanish ? "Alcance" : "In Scope",
    outOfScope: isSpanish ? "Fuera de alcance" : "Out of Scope",
    constraints: isSpanish ? "Restricciones" : "Constraints",
    deliverables: isSpanish ? "Entregables" : "Deliverables",
    acceptanceCriteria: isSpanish ? "Criterios de aceptación" : "Acceptance Criteria",
    evidencePlan: isSpanish ? "Plan de evidencia" : "Evidence Plan",
    roleRouting: isSpanish ? "Routing" : "Role Routing",
    validation: isSpanish ? "Validación" : "Validation",
    orchestrator: isSpanish ? "Orchestrator" : "Orchestrator",
    executors: isSpanish ? "Executors" : "Executors",
    verification: isSpanish ? "Verification" : "Verification",
    noneSpecified: isSpanish ? "Ninguno especificado." : "None specified.",
    unassigned: isSpanish ? "Sin asignar" : "Unassigned",
    score: isSpanish ? "Score" : "Score",
    gate: isSpanish ? "Gate" : "Gate",
    hardFail: isSpanish ? "Fallo duro" : "Hard fail",
    warning: isSpanish ? "Advertencia" : "Warning",
    none: isSpanish ? "ninguno" : "none",
  };
  const lines = [
    `# ${brief.title}`,
    "",
    `## ${labels.objective}`,
    brief.objective,
    "",
    `## ${labels.problemStatement}`,
    brief.problemStatement,
    "",
    `## ${labels.context}`,
    brief.context,
    "",
    `## ${labels.inScope}`,
    ...brief.inScope.map((item: string) => `- ${item}`),
    "",
    `## ${labels.outOfScope}`,
    ...(brief.outOfScope.length > 0 ? brief.outOfScope.map((item: string) => `- ${item}`) : [`- ${labels.noneSpecified}`]),
    "",
    `## ${labels.constraints}`,
    ...(brief.constraints.length > 0 ? brief.constraints.map((item: string) => `- ${item}`) : [`- ${labels.noneSpecified}`]),
    "",
    `## ${labels.deliverables}`,
    ...brief.deliverables.map((item: string) => `- ${item}`),
    "",
    `## ${labels.acceptanceCriteria}`,
    ...brief.acceptanceCriteria.map((item: string) => `- ${item}`),
    "",
    `## ${labels.evidencePlan}`,
    ...brief.evidencePlan.map((item: string) => `- ${item}`),
    "",
    `## ${labels.roleRouting}`,
    `- ${labels.orchestrator}: ${brief.roleRouting.orchestrator ?? labels.unassigned}`,
    `- ${labels.executors}: ${brief.roleRouting.executors.join(", ") || labels.unassigned}`,
    `- ${labels.verification}: ${brief.roleRouting.verification.join(", ") || labels.unassigned}`,
    "",
    `## ${labels.validation}`,
    `- ${labels.score}: ${validation.score}`,
    `- ${labels.gate}: ${validation.gateStatus}`,
    ...(validation.hardFails.length > 0 ? validation.hardFails.map((item) => `- ${labels.hardFail}: ${item}`) : [`- ${labels.hardFail}: ${labels.none}`]),
    ...(validation.warnings.length > 0 ? validation.warnings.map((item) => `- ${labels.warning}: ${item}`) : []),
  ];
  return lines.join("\n");
}

export function promptCompilerRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const agentsSvc = agentService(db);
  const issuesSvc = issueService(db);
  const heartbeat = heartbeatService(db);
  const documentsSvc = documentService(db);

  async function assertCanAssignTasks(req: Parameters<typeof assertCompanyAccess>[0], companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      const allowed = await access.canUser(companyId, req.actor.userId, "tasks:assign");
      if (!allowed) throw forbidden("Missing permission: tasks:assign");
      return;
    }
    if (req.actor.type === "agent") {
      if (!req.actor.agentId) throw forbidden("Agent authentication required");
      const allowedByGrant = await access.hasPermission(companyId, "agent", req.actor.agentId, "tasks:assign");
      if (allowedByGrant) return;
      const actorAgent = await agentsSvc.getById(req.actor.agentId);
      if (actorAgent && actorAgent.companyId === companyId && canAssignTasksByRole(actorAgent.role, actorAgent.permissions, actorAgent.name, actorAgent.title)) {
        return;
      }
      throw forbidden("Missing permission: tasks:assign");
    }
    throw unauthorized();
  }

  router.post("/companies/:companyId/prompt-compiler/compile", validate(promptCompilerCompileRequestSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const agents = await agentsSvc.list(companyId);
    const result = await compilePromptCompilerBrief(req.body, agents);
    res.json(result);
  });

  router.post("/companies/:companyId/prompt-compiler/issues", validate(createIssueFromCompiledBriefSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.body.issue.assigneeAgentId || req.body.issue.assigneeUserId) {
      await assertCanAssignTasks(req, companyId);
    }

    const validation = validateCompiledBrief(req.body.brief);
    if (validation.gateStatus === "reject") {
      res.status(422).json({
        error: "Compiled brief failed validation",
        validation,
      });
      return;
    }

    const actor = getActorInfo(req);
    const createPayload = {
      ...req.body.issue,
      status:
        req.body.issue.status ??
        (req.body.issue.assigneeAgentId || req.body.issue.assigneeUserId ? "todo" : "backlog"),
    };

    const issue = await issuesSvc.create(companyId, {
      ...createPayload,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await Promise.all([
      documentsSvc.upsertIssueDocument({
        issueId: issue.id,
        key: "prompt_intent",
        title: "Prompt intent",
        format: "markdown",
        body: buildRawIntentDocument({
          rawRequest: req.body.rawRequest,
          additionalContext: req.body.additionalContext ?? null,
          preferredLanguage: req.body.preferredLanguage,
        }),
        baseRevisionId: null,
        createdByAgentId: actor.agentId,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      }),
      documentsSvc.upsertIssueDocument({
        issueId: issue.id,
        key: "compiled_brief",
        title: "Compiled brief",
        format: "markdown",
        body: buildCompiledBriefDocument({
          brief: req.body.brief,
          validation,
        }),
        baseRevisionId: null,
        createdByAgentId: actor.agentId,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      }),
    ]);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.created",
      entityType: "issue",
      entityId: issue.id,
      details: {
        title: issue.title,
        identifier: issue.identifier,
        source: "prompt_compiler",
        promptCompilerGate: validation.gateStatus,
      },
    });

    if (issue.assigneeAgentId && issue.status !== "backlog") {
      void heartbeat
        .wakeup(issue.assigneeAgentId, {
          source: "assignment",
          triggerDetail: "system",
          reason: "issue_assigned",
          payload: { issueId: issue.id, mutation: "create" },
          requestedByActorType: actor.actorType,
          requestedByActorId: actor.actorId,
          contextSnapshot: { issueId: issue.id, source: "prompt_compiler.create" },
        })
        .catch((err) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on prompt compiler issue create"));
    }

    const hydratedIssue = await issuesSvc.getById(issue.id);
    res.status(201).json({
      issue: hydratedIssue ?? issue,
      validation,
    });
  });

  return router;
}
