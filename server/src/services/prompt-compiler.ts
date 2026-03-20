import type {
  PromptCompilerCompileRequest,
  PromptCompilerIssueDraft,
  PromptCompilerIntentType,
  PromptCompilerLanguage,
  PromptCompilerBrief,
  PromptCompilerValidationResult,
} from "@paperclipai/shared";

type CompilerAgent = {
  id: string;
  name: string;
  role: string;
  status: string;
};

const ROLE_ALIASES: Record<string, string[]> = {
  "dev-verifier": ["qa"],
  qa: ["dev-verifier"],
  "dev-debugger": ["qa"],
  sammy: ["general"],
};

const ROLE_NAME_HINTS: Record<string, string[]> = {
  "dev-verifier": ["verifier"],
  "dev-debugger": ["debugger"],
  sammy: ["sammy"],
  cfo: ["cfo"],
  cto: ["cto"],
  cmo: ["cmo"],
  ceo: ["ceo"],
};

function normalizeWhitespace(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitLines(input: string): string[] {
  return normalizeWhitespace(input)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function splitSentences(input: string): string[] {
  return normalizeWhitespace(input)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function firstNonEmptyLine(input: string) {
  return splitLines(input)[0] ?? "";
}

function trimSentence(input: string, max = 180) {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function detectLanguage(input: string, preferred: PromptCompilerCompileRequest["preferredLanguage"]): PromptCompilerLanguage {
  if (preferred === "es" || preferred === "en") return preferred;
  const sample = input.toLowerCase();
  const spanishSignals = [
    " para ",
    " con ",
    " y ",
    " que ",
    " necesito ",
    " quiero ",
    " informe ",
    " mejora ",
    " auditor",
    " español",
  ];
  const englishSignals = [
    " the ",
    " and ",
    " with ",
    " need ",
    " want ",
    " report ",
    " improve ",
    " audit ",
  ];
  const esScore = spanishSignals.reduce((count, signal) => count + (sample.includes(signal) ? 1 : 0), 0);
  const enScore = englishSignals.reduce((count, signal) => count + (sample.includes(signal) ? 1 : 0), 0);
  return esScore >= enScore ? "es" : "en";
}

function classifyIntent(input: string): PromptCompilerIntentType {
  const sample = input.toLowerCase();
  if (/\b(audit|auditor|benchmark|compare|comparison|evaluate|evaluation|measure|medir|medición|research|investigación)\b/.test(sample)) {
    return sample.includes("app") || sample.includes("web app") || sample.includes("sandbox") ? "web_app" : "audit";
  }
  if (/\b(bug|fix|error|falla|fallo|broken|rompe|rompió)\b/.test(sample)) return "bugfix";
  if (/\b(refactor|cleanup|hardening|modularize|modularizar)\b/.test(sample)) return "refactor";
  if (/\b(automation|automatiz|cron|workflow|watchdog)\b/.test(sample)) return "automation";
  if (/\b(article|post|copy|content|contenido|newsletter|social|seo|landing)\b/.test(sample)) return "content";
  if (/\b(infra|deploy|oracle|server|hosting|ops|permissions|auth|ssh)\b/.test(sample)) return "ops";
  if (/\b(web app|application|aplicación|dashboard|panel|tool|herramienta|sandbox)\b/.test(sample)) return "web_app";
  if (/\b(investigate|research|analyze|analiza|investiga)\b/.test(sample)) return "research";
  if (/\b(feature|implement|build|crear|construir|implementar|plan de mejora|mejora)\b/.test(sample)) return "feature";
  return "general";
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function buildRouting(intentType: PromptCompilerIntentType, rawRequest: string, additionalContext?: string | null) {
  const sample = `${rawRequest}\n${additionalContext ?? ""}`.toLowerCase();
  const isExecutivePackage =
    /\b(consolida|consolidate|paquete final|final package|resumen ejecutivo|executive summary|próximos pasos|next steps)\b/.test(sample);
  const isFinance =
    /\b(cfo|finance|financial|financiero|financiera|costo|beneficio|roi|margen|pricing|presupuesto|budget|risk register|registro de riesgos)\b/.test(
      sample,
    );
  const isQaChecklist =
    /\b(qa|checklist|smoke|verification|verificación|validación|test plan|plan de pruebas|end-to-end|e2e)\b/.test(sample);
  const isOperationalRunbook =
    /\b(runbook|playbook|operator guide|guía operativa|manual operativo|procedimiento operativo)\b/.test(sample);

  if (isFinance) {
    return { orchestrator: "cfo", executors: [], verification: ["dev-verifier"] };
  }
  if (isExecutivePackage) {
    return { orchestrator: "sammy", executors: [], verification: ["dev-verifier"] };
  }
  if (isQaChecklist) {
    return { orchestrator: "dev-verifier", executors: [], verification: ["dev-verifier"] };
  }
  if (isOperationalRunbook) {
    return { orchestrator: "sammy", executors: [], verification: ["dev-verifier"] };
  }

  switch (intentType) {
    case "audit":
      return { orchestrator: "ceo", executors: ["cto", "dev-verifier"], verification: ["dev-verifier"] };
    case "content":
      return { orchestrator: "cmo", executors: ["content_creator", "content_editor"], verification: ["brand_guardian", "content_editor"] };
    case "ops":
      return { orchestrator: "cto", executors: ["dev-architect", "dev-debugger"], verification: ["dev-verifier"] };
    case "research":
      return { orchestrator: "ceo", executors: ["dev-researcher"], verification: ["dev-verifier"] };
    case "web_app":
      return { orchestrator: "cto", executors: ["dev-coder", "dev-architect"], verification: ["dev-verifier"] };
    case "bugfix":
      return { orchestrator: "cto", executors: ["dev-debugger", "dev-coder"], verification: ["dev-verifier"] };
    case "refactor":
      return { orchestrator: "cto", executors: ["dev-architect", "dev-coder"], verification: ["dev-verifier"] };
    case "automation":
      return { orchestrator: "cto", executors: ["sammy", "nexo-worker"], verification: ["dev-verifier"] };
    case "feature":
      return { orchestrator: "ceo", executors: ["cto"], verification: ["dev-verifier"] };
    default:
      return { orchestrator: "ceo", executors: ["cto"], verification: ["dev-verifier"] };
  }
}

function inferConstraints(rawRequest: string, additionalContext: string | null | undefined, language: PromptCompilerLanguage) {
  const source = `${rawRequest}\n${additionalContext ?? ""}`.toLowerCase();
  const constraints: string[] = [];
  if (/\b(spanish|español|en español)\b/.test(source)) {
    constraints.push(language === "es"
      ? "Todos los reportes finales y resúmenes dirigidos al usuario deben escribirse en español."
      : "All final user-facing reports and summaries must be written in Spanish.");
  }
  if (/\b(no cambies|do not change|sin cambiar producción|without changing production)\b/.test(source)) {
    constraints.push(language === "es" ? "No cambiar producción sin instrucción explícita." : "Do not change production without explicit instruction.");
  }
  if (/\bartifact|work product|evidence|evidencia|reporte|report|html|preview|commit|branch\b/.test(source)) {
    constraints.push(language === "es"
      ? "No marcar la tarea como terminada sin evidencia verificable y work product registrado."
      : "Do not mark the task done without verifiable evidence and a registered work product.");
  }
  return unique(constraints);
}

function buildDeliverables(intentType: PromptCompilerIntentType, language: PromptCompilerLanguage) {
  const es = language === "es";
  switch (intentType) {
    case "audit":
      return es
        ? ["Informe estructurado con hallazgos priorizados", "Evidencia verificable por hallazgo", "Plan de remediación por fases"]
        : ["Structured report with prioritized findings", "Verifiable evidence per finding", "Phased remediation plan"];
    case "web_app":
      return es
        ? ["Issue brief ejecutable", "Implementación funcional", "Evidencia de validación y preview"]
        : ["Executable issue brief", "Functional implementation", "Validation evidence and preview"];
    case "research":
      return es
        ? ["Resumen de investigación", "Comparativa con criterios explícitos", "Conclusión accionable"]
        : ["Research summary", "Comparison with explicit criteria", "Actionable conclusion"];
    case "content":
      return es
        ? ["Activo de contenido final", "Checklist editorial", "Prueba de revisión de marca"]
        : ["Final content asset", "Editorial checklist", "Brand review evidence"];
    default:
      return es
        ? ["Plan de trabajo por fases", "Implementación o ejecución", "Evidencia verificable de cierre"]
        : ["Phased work plan", "Implementation or execution", "Verifiable completion evidence"];
  }
}

function buildEvidencePlan(intentType: PromptCompilerIntentType, language: PromptCompilerLanguage) {
  const es = language === "es";
  switch (intentType) {
    case "audit":
      return es
        ? ["Registrar el informe final como artifact o document.", "Incluir pasos de reproducción, severidad y evidencia por hallazgo."]
        : ["Register the final report as an artifact or document.", "Include reproduction steps, severity, and evidence for each finding."];
    case "web_app":
      return es
        ? ["Registrar preview URL, branch, commit o runtime service.", "Adjuntar pruebas o validación visible del flujo principal."]
        : ["Register a preview URL, branch, commit, or runtime service.", "Attach tests or visible validation of the primary flow."];
    case "research":
      return es
        ? ["Citar fuentes o evidencias verificables.", "Registrar el resumen final como document o artifact."]
        : ["Cite verifiable sources or evidence.", "Register the final summary as a document or artifact."];
    default:
      return es
        ? ["Cada entregable debe mapearse a una evidencia verificable.", "No cerrar la issue sin work product, URL, commit, archivo o prueba visible."]
        : ["Each deliverable must map to verifiable evidence.", "Do not close the issue without a work product, URL, commit, file, or visible proof."];
  }
}

function buildAcceptanceCriteria(intentType: PromptCompilerIntentType, deliverables: string[], language: PromptCompilerLanguage) {
  const es = language === "es";
  const criteria = deliverables.map((deliverable) =>
    es
      ? `Existe una evidencia verificable para "${deliverable}".`
      : `Verifiable evidence exists for "${deliverable}".`,
  );

  if (intentType === "audit") {
    criteria.push(es
      ? "Los hallazgos están agrupados por severidad con pasos de reproducción claros."
      : "Findings are grouped by severity with clear reproduction steps.");
  }
  if (intentType === "web_app") {
    criteria.push(es
      ? "El flujo principal puede ejecutarse sin depender del contexto implícito del autor."
      : "The primary flow can be executed without relying on the author's implicit context.");
  }
  criteria.push(es
    ? "La issue puede ejecutarse sin volver al pedido original para entender el objetivo."
    : "The issue can be executed without revisiting the original request to understand the goal.");
  return criteria;
}

function buildRisks(intentType: PromptCompilerIntentType, language: PromptCompilerLanguage): PromptCompilerBrief["risks"] {
  const es = language === "es";
  const generic = {
    risk: es ? "Ambigüedad en alcance o entregables." : "Ambiguity in scope or deliverables.",
    impact: "medium" as const,
    mitigation: es ? "Hacer explícitos alcance, evidencia y criterio de cierre antes de crear la issue." : "Make scope, evidence, and closure criteria explicit before creating the issue.",
  };
  if (intentType === "audit") {
    return [
      generic,
      {
        risk: es ? "La auditoría puede cerrarse sin artefacto durable." : "The audit may be closed without a durable artifact.",
        impact: "high",
        mitigation: es ? "Exigir artifact/document y ruta verificable antes del cierre." : "Require an artifact/document and verifiable path before closing.",
      },
    ];
  }
  return [generic];
}

function resolveSuggestedAssignee(agents: CompilerAgent[], role: string | null) {
  if (!role) return null;
  const normalizedRole = role.toLowerCase();
  const acceptedRoles = new Set([normalizedRole, ...(ROLE_ALIASES[normalizedRole] ?? [])]);
  const candidates = agents.filter(
    (agent) => agent.status !== "terminated" && acceptedRoles.has((agent.role ?? "").toLowerCase()),
  );
  if (candidates.length <= 1) return candidates[0] ?? null;

  const preferredHints = ROLE_NAME_HINTS[normalizedRole] ?? [];
  const exactNameMatch = candidates.find((agent) => preferredHints.includes((agent.name ?? "").toLowerCase()));
  if (exactNameMatch) return exactNameMatch;

  const hintedNameMatch = candidates.find((agent) => {
    const name = (agent.name ?? "").toLowerCase();
    return preferredHints.some((hint) => name.includes(hint));
  });
  if (hintedNameMatch) return hintedNameMatch;

  return candidates[0] ?? null;
}

function buildMarkdownBrief(brief: PromptCompilerBrief, rawRequest: string, additionalContext: string | null | undefined) {
  const es = brief.language === "es";
  const labels = es
    ? {
        objective: "Objetivo",
        problemStatement: "Problema",
        context: "Contexto",
        inScope: "Alcance",
        outOfScope: "Fuera de alcance",
        constraints: "Restricciones",
        assumptions: "Supuestos",
        deliverables: "Entregables",
        acceptance: "Criterios de aceptación",
        evidence: "Plan de evidencia",
        routing: "Routing",
        risks: "Riesgos",
        questions: "Preguntas abiertas",
        source: "Pedido original",
        extra: "Contexto adicional",
        none: "Ninguno especificado.",
      }
    : {
        objective: "Objective",
        problemStatement: "Problem Statement",
        context: "Context",
        inScope: "In Scope",
        outOfScope: "Out of Scope",
        constraints: "Constraints",
        assumptions: "Assumptions",
        deliverables: "Deliverables",
        acceptance: "Acceptance Criteria",
        evidence: "Evidence Plan",
        routing: "Role Routing",
        risks: "Risks",
        questions: "Open Questions",
        source: "Source Intent",
        extra: "Additional Context",
        none: "None specified.",
      };
  const lines: string[] = [
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
    ...brief.inScope.map((item) => `- ${item}`),
    "",
    `## ${labels.outOfScope}`,
    ...(brief.outOfScope.length > 0 ? brief.outOfScope.map((item) => `- ${item}`) : [`- ${labels.none}`]),
    "",
    `## ${labels.constraints}`,
    ...(brief.constraints.length > 0 ? brief.constraints.map((item) => `- ${item}`) : [`- ${labels.none}`]),
    "",
    `## ${labels.assumptions}`,
    ...(brief.assumptions.length > 0 ? brief.assumptions.map((item) => `- ${item}`) : [`- ${labels.none}`]),
    "",
    `## ${labels.deliverables}`,
    ...brief.deliverables.map((item) => `- ${item}`),
    "",
    `## ${labels.acceptance}`,
    ...brief.acceptanceCriteria.map((item) => `- ${item}`),
    "",
    `## ${labels.evidence}`,
    ...brief.evidencePlan.map((item) => `- ${item}`),
    "",
    `## ${labels.routing}`,
    `- Orchestrator: ${brief.roleRouting.orchestrator ?? "Unassigned"}`,
    `- Executors: ${brief.roleRouting.executors.join(", ") || "Unassigned"}`,
    `- Verification: ${brief.roleRouting.verification.join(", ") || "Unassigned"}`,
    "",
    `## ${labels.risks}`,
    ...brief.risks.map((entry) => `- ${entry.risk} Impact: ${entry.impact}. Mitigation: ${entry.mitigation}`),
  ];
  if (brief.openQuestions.length > 0) {
    lines.push("", `## ${labels.questions}`, ...brief.openQuestions.map((item) => `- ${item}`));
  }
  lines.push("", `## ${labels.source}`, rawRequest.trim());
  if (additionalContext?.trim()) {
    lines.push("", `## ${labels.extra}`, additionalContext.trim());
  }
  return lines.join("\n");
}

export function validateCompiledBrief(brief: PromptCompilerBrief): PromptCompilerValidationResult {
  const fieldErrors: PromptCompilerValidationResult["fieldErrors"] = [];
  const evidenceErrors: PromptCompilerValidationResult["evidenceErrors"] = [];
  const criteriaErrors: PromptCompilerValidationResult["criteriaErrors"] = [];
  const hardFails: string[] = [];
  const warnings: string[] = [];
  const fixHints: string[] = [];

  if (!brief.title.trim()) fieldErrors.push({ field: "title", message: "Title is required." });
  if (!brief.problemStatement.trim()) fieldErrors.push({ field: "problemStatement", message: "Problem statement is required." });
  if (brief.deliverables.length === 0) fieldErrors.push({ field: "deliverables", message: "At least one deliverable is required." });
  if (brief.acceptanceCriteria.length === 0) fieldErrors.push({ field: "acceptanceCriteria", message: "At least one acceptance criterion is required." });
  if (brief.evidencePlan.length === 0) fieldErrors.push({ field: "evidencePlan", message: "At least one evidence rule is required." });

  for (const deliverable of brief.deliverables) {
    const matched = brief.evidencePlan.some((entry) => entry.toLowerCase().includes("artifact")
      || entry.toLowerCase().includes("document")
      || entry.toLowerCase().includes("preview")
      || entry.toLowerCase().includes("commit")
      || entry.toLowerCase().includes("work product")
      || entry.toLowerCase().includes("evidencia")
      || entry.toLowerCase().includes("archivo")
      || entry.toLowerCase().includes("url"));
    if (!matched) {
      evidenceErrors.push({ field: "evidencePlan", message: `No verifiable evidence mapped for deliverable: ${deliverable}` });
    }
  }

  for (const criterion of brief.acceptanceCriteria) {
    const sample = criterion.toLowerCase();
    const looksWeak = ["better", "good", "mejor", "nice", "solid", "robust"].some((token) => sample.includes(token));
    const looksTestable = /\b(exists|serve|register|include|can|must|debe|puede|existe|incluye|registra)\b/.test(sample);
    if (looksWeak || !looksTestable) {
      criteriaErrors.push({ field: "acceptanceCriteria", message: `Acceptance criterion is not testable enough: ${criterion}` });
    }
  }

  if (brief.status === "blocked") {
    warnings.push("Brief is blocked and should not create an issue until open questions are resolved.");
  }

  if (fieldErrors.length > 0) hardFails.push("Missing required fields.");
  if (evidenceErrors.length > 0) hardFails.push("Deliverables do not have a verifiable evidence plan.");
  if (criteriaErrors.length > 0) hardFails.push("Acceptance criteria are not testable enough.");
  if (brief.openQuestions.length > 0 && brief.status !== "blocked") {
    warnings.push("There are open questions even though the brief is marked ready.");
  }
  if (brief.language === "es" && brief.acceptanceCriteria.some((item) => /\bthe|must|should\b/i.test(item) && !/\bdebe|puede|existe\b/i.test(item))) {
    warnings.push("The brief mixes English acceptance criteria with a Spanish brief.");
  }
  if (brief.language === "en" && brief.acceptanceCriteria.some((item) => /\bdebe|puede|existe\b/i.test(item) && !/\bmust|can|exists\b/i.test(item))) {
    warnings.push("The brief mixes Spanish acceptance criteria with an English brief.");
  }

  const completenessScore = fieldErrors.length === 0 ? 25 : Math.max(0, 25 - fieldErrors.length * 8);
  const evidenceScore = evidenceErrors.length === 0 ? 30 : Math.max(0, 30 - evidenceErrors.length * 10);
  const criteriaScore = criteriaErrors.length === 0 ? 25 : Math.max(0, 25 - criteriaErrors.length * 8);
  const languageScore = warnings.some((entry) => entry.includes("mixes")) ? 5 : 10;
  const scopeScore = brief.inScope.length > 0 && brief.outOfScope.length > 0 ? 10 : 6;
  const score = Math.max(0, Math.min(100, completenessScore + evidenceScore + criteriaScore + languageScore + scopeScore));

  const gateStatus =
    hardFails.length > 0 || score < 70 ? "reject"
      : score < 85 ? "revise"
      : "pass";

  if (gateStatus !== "pass") {
    fixHints.push("Tighten acceptance criteria so each one has a clear pass/fail signal.");
  }
  if (evidenceErrors.length > 0) {
    fixHints.push("Map each deliverable to a concrete file, URL, work product, commit, preview, or test artifact.");
  }
  if (fieldErrors.length > 0) {
    fixHints.push("Fill the missing required sections before creating the issue.");
  }

  return {
    score,
    gateStatus,
    hardFails,
    warnings,
    fieldErrors,
    evidenceErrors,
    criteriaErrors,
    fixHints,
  };
}

export function compilePromptCompilerBrief(
  input: PromptCompilerCompileRequest,
  agents: CompilerAgent[],
): { brief: PromptCompilerBrief; validation: PromptCompilerValidationResult; issueDraft: PromptCompilerIssueDraft } {
  const rawRequest = normalizeWhitespace(input.rawRequest);
  const additionalContext = normalizeWhitespace(input.additionalContext ?? "");
  const combined = [rawRequest, additionalContext].filter(Boolean).join("\n\n");
  const language = detectLanguage(combined || rawRequest, input.preferredLanguage);
  const intentType = classifyIntent(combined || rawRequest);
  const routing = buildRouting(intentType, rawRequest, input.additionalContext);
  const lines = splitLines(rawRequest);
  const sentences = splitSentences(combined || rawRequest);
  const firstLine = firstNonEmptyLine(rawRequest);
  const title =
    trimSentence(
      firstLine
        .replace(/^(please|por favor|puedes|can you|quiero|necesito)\s+/i, "")
        .replace(/[.:;]+$/, ""),
      90,
    ) || (language === "es" ? "Nuevo encargo compilado" : "New compiled request");
  const problemStatement = trimSentence(sentences[0] ?? rawRequest, 320);
  const context = additionalContext
    ? trimSentence(additionalContext, 800)
    : (language === "es"
      ? "El brief fue compilado a partir de una necesidad de negocio expresada en lenguaje informal."
      : "The brief was compiled from a business request expressed in informal language.");
  const inScope = unique([
    ...lines.slice(0, 4),
    intentType === "audit"
      ? (language === "es" ? "Inspeccionar el comportamiento real y registrar hallazgos verificables." : "Inspect real behavior and register verifiable findings.")
      : language === "es"
        ? "Convertir la necesidad en una ejecución verificable."
        : "Turn the request into a verifiable execution.",
  ]).slice(0, 5);
  const outOfScope = unique([
    language === "es"
      ? "Trabajo no solicitado explícitamente por el pedido original."
      : "Work not explicitly requested by the original request.",
    language === "es"
      ? "Cierre sin evidencia verificable."
      : "Closure without verifiable evidence.",
  ]);
  const constraints = inferConstraints(rawRequest, additionalContext, language);
  if (routing.executors.length === 0) {
    constraints.push(
      language === "es"
        ? "Ejecución de owner único: no crear child issues ni delegar; completar el entregable directamente y registrar la evidencia."
        : "Single-owner execution: do not create child issues or delegate; complete the deliverable directly and register the evidence.",
    );
  }
  const assumptions = unique([
    language === "es"
      ? "Existe una compañía activa en Paperclip para ejecutar la issue."
      : "An active Paperclip company exists to execute the issue.",
    routing.orchestrator
      ? (language === "es"
          ? `El primer owner esperado es ${routing.orchestrator}.`
          : `The expected first owner is ${routing.orchestrator}.`)
      : "",
  ]);
  const deliverables = buildDeliverables(intentType, language);
  const evidencePlan = buildEvidencePlan(intentType, language);
  const acceptanceCriteria = buildAcceptanceCriteria(intentType, deliverables, language);
  const openQuestions = /(\?|\bpendiente\b|\bunknown\b|\bnot sure\b)/i.test(rawRequest)
    ? [language === "es" ? "Confirmar cualquier dependencia o restricción no resuelta antes de ejecutar." : "Confirm unresolved dependencies or constraints before execution."]
    : [];

  const brief: PromptCompilerBrief = {
    schemaVersion: "prompt_compiler.v1",
    status: openQuestions.length > 0 ? "blocked" : "ready",
    intentType,
    language,
    title,
    objective: language === "es"
      ? `Convertir este pedido en una issue ejecutable y verificable de tipo ${intentType}.`
      : `Turn this request into an executable and verifiable ${intentType} issue.`,
    problemStatement,
    context,
    inScope,
    outOfScope,
    constraints,
    assumptions,
    deliverables,
    acceptanceCriteria,
    evidencePlan,
    roleRouting: routing,
    risks: buildRisks(intentType, language),
    openQuestions,
  };

  const validation = validateCompiledBrief(brief);
  const suggestedAssignee = resolveSuggestedAssignee(agents, routing.orchestrator);
  const issueDraft: PromptCompilerIssueDraft = {
    title: brief.title,
    description: buildMarkdownBrief(brief, rawRequest, additionalContext || null),
    suggestedAssigneeRole: routing.orchestrator,
    suggestedAssigneeAgentId: suggestedAssignee?.id ?? null,
  };

  return { brief, validation, issueDraft };
}
