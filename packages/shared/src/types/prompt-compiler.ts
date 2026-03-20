export type PromptCompilerIntentType =
  | "audit"
  | "bugfix"
  | "feature"
  | "web_app"
  | "research"
  | "content"
  | "ops"
  | "refactor"
  | "automation"
  | "general";

export type PromptCompilerLanguage = "es" | "en";
export type PromptCompilerLanguagePreference = "auto" | PromptCompilerLanguage;
export type PromptCompilerStatus = "ready" | "blocked";
export type PromptCompilerGateStatus = "pass" | "revise" | "reject";

export interface PromptCompilerRisk {
  risk: string;
  impact: "low" | "medium" | "high";
  mitigation: string;
}

export interface PromptCompilerRoleRouting {
  orchestrator: string | null;
  executors: string[];
  verification: string[];
}

export interface PromptCompilerBrief {
  schemaVersion: "prompt_compiler.v1";
  status: PromptCompilerStatus;
  intentType: PromptCompilerIntentType;
  language: PromptCompilerLanguage;
  title: string;
  objective: string;
  problemStatement: string;
  context: string;
  inScope: string[];
  outOfScope: string[];
  constraints: string[];
  assumptions: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  evidencePlan: string[];
  roleRouting: PromptCompilerRoleRouting;
  risks: PromptCompilerRisk[];
  openQuestions: string[];
}

export interface PromptCompilerIssueDraft {
  title: string;
  description: string;
  suggestedAssigneeRole: string | null;
  suggestedAssigneeAgentId: string | null;
}

export interface PromptCompilerValidationIssue {
  field: string;
  message: string;
}

export interface PromptCompilerValidationResult {
  score: number;
  gateStatus: PromptCompilerGateStatus;
  hardFails: string[];
  warnings: string[];
  fieldErrors: PromptCompilerValidationIssue[];
  evidenceErrors: PromptCompilerValidationIssue[];
  criteriaErrors: PromptCompilerValidationIssue[];
  fixHints: string[];
}

export interface PromptCompilerCompileResponse {
  brief: PromptCompilerBrief;
  validation: PromptCompilerValidationResult;
  issueDraft: PromptCompilerIssueDraft;
}
