import { describe, expect, it } from "vitest";
import type { Agent } from "@paperclipai/shared";
import { compilePromptCompilerBrief, validateCompiledBrief } from "../services/prompt-compiler.js";

const agents: Agent[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    name: "CEO",
    role: "ceo",
    status: "active",
    title: "CEO",
    reportsTo: null,
    capabilities: null,
    adapterType: "openclaw_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    metadata: null,
    permissions: null,
    urlKey: "ceo",
    currentMonthlySpendCents: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    companyId: "company-1",
    name: "CTO",
    role: "cto",
    status: "active",
    title: "CTO",
    reportsTo: null,
    capabilities: null,
    adapterType: "openclaw_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    metadata: null,
    permissions: null,
    urlKey: "cto",
    currentMonthlySpendCents: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("prompt compiler service", () => {
  it("compiles a Spanish improvement request into a verifiable brief", () => {
    const result = compilePromptCompilerBrief(
      {
        rawRequest:
          "puedes decirle ahora que implementen un plan de mejora con esos findings y que cuando me entreguen un informe siempre sea en español",
        additionalContext:
          "Findings verificados: missing security headers, robots.txt y sitemap.xml mal configurados, imagen de marca sobredimensionada y metadata SEO incompleta.",
        preferredLanguage: "auto",
      },
      agents,
    );

    expect(result.brief.language).toBe("es");
    expect(result.brief.intentType).toBe("content");
    expect(result.brief.constraints.join("\n")).toContain("español");
    expect(result.brief.deliverables.length).toBeGreaterThan(0);
    expect(result.validation.gateStatus).not.toBe("reject");
    expect(result.issueDraft.suggestedAssigneeRole).toBe("cmo");
    expect(result.issueDraft.description).toContain("## Criterios de aceptación");
  });

  it("rejects a weak brief that lacks evidence and testable criteria", () => {
    const validation = validateCompiledBrief({
      schemaVersion: "prompt_compiler.v1",
      status: "ready",
      intentType: "general",
      language: "en",
      title: "Do a thing",
      objective: "Do a thing",
      problemStatement: "Do a thing better",
      context: "None",
      inScope: ["Do it"],
      outOfScope: [],
      constraints: [],
      assumptions: [],
      deliverables: ["Something good"],
      acceptanceCriteria: ["It should be better"],
      evidencePlan: ["Validate manually"],
      roleRouting: { orchestrator: "ceo", executors: [], verification: [] },
      risks: [],
      openQuestions: [],
    });

    expect(validation.gateStatus).toBe("reject");
    expect(validation.hardFails.length).toBeGreaterThan(0);
    expect(validation.evidenceErrors.length).toBeGreaterThan(0);
    expect(validation.criteriaErrors.length).toBeGreaterThan(0);
  });
});
