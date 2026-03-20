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
  {
    id: "33333333-3333-4333-8333-333333333333",
    companyId: "company-1",
    name: "CFO",
    role: "cfo",
    status: "active",
    title: "CFO",
    reportsTo: null,
    capabilities: null,
    adapterType: "openclaw_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    metadata: null,
    permissions: null,
    urlKey: "cfo",
    currentMonthlySpendCents: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    companyId: "company-1",
    name: "Sammy",
    role: "sammy",
    status: "active",
    title: "Sammy",
    reportsTo: null,
    capabilities: null,
    adapterType: "openclaw_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    metadata: null,
    permissions: null,
    urlKey: "sammy",
    currentMonthlySpendCents: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    companyId: "company-1",
    name: "Dev Verifier",
    role: "qa",
    status: "active",
    title: "Dev Verifier",
    reportsTo: null,
    capabilities: null,
    adapterType: "openclaw_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    metadata: null,
    permissions: null,
    urlKey: "dev-verifier",
    currentMonthlySpendCents: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    companyId: "company-1",
    name: "Dev Debugger",
    role: "qa",
    status: "active",
    title: "Dev Debugger",
    reportsTo: null,
    capabilities: null,
    adapterType: "openclaw_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    metadata: null,
    permissions: null,
    urlKey: "dev-debugger",
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

  it("routes finance requests to CFO instead of generic CEO/CTO lanes", () => {
    const result = compilePromptCompilerBrief(
      {
        rawRequest:
          "Crea un registro de riesgos y una nota de costo/beneficio para adoptar Prompt Compiler en producción, con informe final en español.",
        additionalContext:
          "Debe incluir riesgos operativos, mitigaciones, impactos y una recomendación ejecutiva.",
        preferredLanguage: "es",
      },
      agents,
    );

    expect(result.brief.roleRouting.orchestrator).toBe("cfo");
    expect(result.issueDraft.suggestedAssigneeRole).toBe("cfo");
    expect(result.issueDraft.suggestedAssigneeAgentId).toBe("33333333-3333-4333-8333-333333333333");
    expect(result.brief.constraints.join("\n")).toContain("owner único");
  });

  it("routes operational runbooks to Sammy and QA checklists to Dev Verifier", () => {
    const runbook = compilePromptCompilerBrief(
      {
        rawRequest:
          "Redacta un runbook operativo corto para usar Prompt Compiler en Paperclip y entrega el informe final en español.",
        additionalContext:
          "Debe incluir pasos, riesgos, evidencia requerida y criterios de cierre.",
        preferredLanguage: "es",
      },
      agents,
    );
    const qaChecklist = compilePromptCompilerBrief(
      {
        rawRequest:
          "Crea un checklist end-to-end de QA para Prompt Compiler en Paperclip y entrega el informe final en español.",
        additionalContext:
          "Debe cubrir smoke, regresión, evidencias y criterios de aprobación.",
        preferredLanguage: "es",
      },
      agents,
    );

    expect(runbook.brief.roleRouting.orchestrator).toBe("sammy");
    expect(runbook.issueDraft.suggestedAssigneeAgentId).toBe("44444444-4444-4444-8444-444444444444");
    expect(runbook.brief.constraints.join("\n")).toContain("owner único");
    expect(qaChecklist.brief.roleRouting.orchestrator).toBe("dev-verifier");
    expect(qaChecklist.issueDraft.suggestedAssigneeAgentId).toBe("55555555-5555-4555-8555-555555555555");
    expect(qaChecklist.brief.constraints.join("\n")).toContain("owner único");
  });

  it("routes executive consolidation packages to Sammy even when they mention validation status", () => {
    const result = compilePromptCompilerBrief(
      {
        rawRequest:
          "Consolida los entregables reales del Prompt Compiler en un paquete final en español con resumen ejecutivo, artefactos producidos, estado de validación y próximos pasos.",
        additionalContext:
          "Debe usar artefactos verificables existentes, no delegar, y registrar un único work product final.",
        preferredLanguage: "es",
      },
      agents,
    );

    expect(result.brief.roleRouting.orchestrator).toBe("sammy");
    expect(result.issueDraft.suggestedAssigneeAgentId).toBe("44444444-4444-4444-8444-444444444444");
    expect(result.brief.constraints.join("\n")).toContain("owner único");
  });
});
