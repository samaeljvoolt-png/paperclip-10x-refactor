import { z } from "zod";
import { createIssueSchema } from "./issue.js";

export const promptCompilerIntentTypeSchema = z.enum([
  "audit",
  "bugfix",
  "feature",
  "web_app",
  "research",
  "content",
  "ops",
  "refactor",
  "automation",
  "general",
]);

export const promptCompilerLanguageSchema = z.enum(["es", "en"]);
export const promptCompilerLanguagePreferenceSchema = z.enum(["auto", "es", "en"]);
export const promptCompilerStatusSchema = z.enum(["ready", "blocked"]);
export const promptCompilerGateStatusSchema = z.enum(["pass", "revise", "reject"]);

export const promptCompilerRiskSchema = z.object({
  risk: z.string().trim().min(1).max(300),
  impact: z.enum(["low", "medium", "high"]),
  mitigation: z.string().trim().min(1).max(300),
});

export const promptCompilerRoleRoutingSchema = z.object({
  orchestrator: z.string().trim().min(1).nullable(),
  executors: z.array(z.string().trim().min(1)).default([]),
  verification: z.array(z.string().trim().min(1)).default([]),
});

export const promptCompilerBriefSchema = z.object({
  schemaVersion: z.literal("prompt_compiler.v1"),
  status: promptCompilerStatusSchema,
  intentType: promptCompilerIntentTypeSchema,
  language: promptCompilerLanguageSchema,
  title: z.string().trim().min(1).max(200),
  objective: z.string().trim().min(1).max(600),
  problemStatement: z.string().trim().min(1).max(2000),
  context: z.string().trim().min(1).max(4000),
  inScope: z.array(z.string().trim().min(1).max(300)).min(1),
  outOfScope: z.array(z.string().trim().min(1).max(300)).default([]),
  constraints: z.array(z.string().trim().min(1).max(300)).default([]),
  assumptions: z.array(z.string().trim().min(1).max(300)).default([]),
  deliverables: z.array(z.string().trim().min(1).max(300)).min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(400)).min(1),
  evidencePlan: z.array(z.string().trim().min(1).max(400)).min(1),
  roleRouting: promptCompilerRoleRoutingSchema,
  risks: z.array(promptCompilerRiskSchema).default([]),
  openQuestions: z.array(z.string().trim().min(1).max(300)).default([]),
});

export const promptCompilerValidationIssueSchema = z.object({
  field: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const promptCompilerValidationResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  gateStatus: promptCompilerGateStatusSchema,
  hardFails: z.array(z.string().trim().min(1)).default([]),
  warnings: z.array(z.string().trim().min(1)).default([]),
  fieldErrors: z.array(promptCompilerValidationIssueSchema).default([]),
  evidenceErrors: z.array(promptCompilerValidationIssueSchema).default([]),
  criteriaErrors: z.array(promptCompilerValidationIssueSchema).default([]),
  fixHints: z.array(z.string().trim().min(1)).default([]),
});

export const promptCompilerCompileRequestSchema = z.object({
  rawRequest: z.string().trim().min(1).max(12000),
  additionalContext: z.string().trim().max(12000).optional().nullable(),
  preferredLanguage: promptCompilerLanguagePreferenceSchema.optional().default("auto"),
});

export const promptCompilerIssueDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20000),
  suggestedAssigneeRole: z.string().trim().min(1).nullable(),
  suggestedAssigneeAgentId: z.string().uuid().nullable(),
});

export const createIssueFromCompiledBriefSchema = z.object({
  rawRequest: z.string().trim().min(1).max(12000),
  additionalContext: z.string().trim().max(12000).optional().nullable(),
  preferredLanguage: promptCompilerLanguagePreferenceSchema.optional().default("auto"),
  brief: promptCompilerBriefSchema,
  issueDraft: promptCompilerIssueDraftSchema,
  issue: createIssueSchema.extend({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(20000),
  }),
});

export type PromptCompilerCompileRequest = z.infer<typeof promptCompilerCompileRequestSchema>;
export type PromptCompilerBrief = z.infer<typeof promptCompilerBriefSchema>;
export type PromptCompilerValidationResult = z.infer<typeof promptCompilerValidationResultSchema>;
export type PromptCompilerIssueDraft = z.infer<typeof promptCompilerIssueDraftSchema>;
export type CreateIssueFromCompiledBrief = z.infer<typeof createIssueFromCompiledBriefSchema>;
