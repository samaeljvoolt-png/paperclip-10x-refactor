import type {
  CreateIssueFromCompiledBrief,
  PromptCompilerCompileRequest,
  PromptCompilerCompileResponse,
} from "@paperclipai/shared";
import { api } from "./client";

export const promptCompilerApi = {
  compile: (companyId: string, data: PromptCompilerCompileRequest) =>
    api.post<PromptCompilerCompileResponse>(`/companies/${companyId}/prompt-compiler/compile`, data),
  createIssue: (companyId: string, data: CreateIssueFromCompiledBrief) =>
    api.post<{ issue: unknown; validation: unknown }>(`/companies/${companyId}/prompt-compiler/issues`, data),
};
