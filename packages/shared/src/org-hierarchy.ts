import { normalizeAgentUrlKey } from "./agent-url-key.js";

export type OrgRoleBand = "executive" | "functional_lead" | "operator" | "support";

const EXECUTIVE_ROLE_RANK = new Map<string, number>([
  ["ceo", 0],
  ["cto", 1],
  ["cmo", 2],
  ["cfo", 3],
]);

const FUNCTIONAL_LEAD_ROLE_RANK = new Map<string, number>([
  ["engineer", 10],
  ["devops", 11],
  ["qa", 12],
  ["researcher", 13],
  ["designer", 14],
  ["pm", 15],
]);

const ROLE_MANAGER_CANDIDATES = new Map<string, string[]>([
  ["ceo", []],
  ["cto", ["ceo"]],
  ["cmo", ["ceo"]],
  ["cfo", ["ceo"]],
  ["engineer", ["cto", "ceo"]],
  ["devops", ["cto", "ceo"]],
  ["qa", ["cto", "ceo"]],
  ["researcher", ["cto", "ceo"]],
  ["designer", ["cmo", "cto", "ceo"]],
  ["pm", ["cto", "ceo"]],
  ["general", ["cto", "ceo"]],
]);

export function getOrgRoleBand(role: string | null | undefined): OrgRoleBand {
  const key = normalizeAgentUrlKey(role);
  if (!key) return "support";
  if (EXECUTIVE_ROLE_RANK.has(key)) return "executive";
  if (FUNCTIONAL_LEAD_ROLE_RANK.has(key)) return "functional_lead";
  return "operator";
}

function titleLooksExecutive(title: string | null | undefined): boolean {
  const key = normalizeAgentUrlKey(title);
  if (!key) return false;
  return key.startsWith("chief") || key.includes("ceo") || key.includes("cto") || key.includes("cmo") || key.includes("cfo");
}

function titleLooksLead(title: string | null | undefined): boolean {
  const key = normalizeAgentUrlKey(title);
  if (!key) return false;
  return (
    key.includes("lead") ||
    key.includes("director") ||
    key.includes("architecture") ||
    key.includes("growth") ||
    key.includes("marketing")
  );
}

function titleLooksGrowthMarketing(title: string | null | undefined): boolean {
  const key = normalizeAgentUrlKey(title);
  if (!key) return false;
  return key.includes("growth") || key.includes("marketing") || key.includes("social") || key.includes("brand") || key.includes("content") || key.includes("creative") || key.includes("visual");
}

function nameLooksLead(name: string | null | undefined): boolean {
  const key = normalizeAgentUrlKey(name);
  if (!key) return false;
  return key === "nexus" || key === "creative-director" || key === "growth-hacker";
}

function nameLooksGateway(name: string | null | undefined): boolean {
  const key = normalizeAgentUrlKey(name);
  if (!key) return false;
  return (
    key === "sammy" ||
    key === "laura-agency-bot" ||
    key === "codex-bridge" ||
    key.includes("gateway") ||
    key.includes("legacy-controller")
  );
}

function titleLooksGateway(title: string | null | undefined): boolean {
  const key = normalizeAgentUrlKey(title);
  if (!key) return false;
  return key.includes("gateway") || key.includes("legacy-controller");
}

export function getOrgRoleBandForAgent(
  role: string | null | undefined,
  name?: string | null | undefined,
  title?: string | null | undefined,
): OrgRoleBand {
  if (titleLooksExecutive(title)) return "executive";
  if (nameLooksGateway(name) || titleLooksGateway(title)) return "support";
  if (titleLooksLead(title) || nameLooksLead(name)) return "functional_lead";
  const key = normalizeAgentUrlKey(role);
  if (!key) return "support";
  if (key === "ceo") return "executive";
  if (key === "cto" || key === "cmo" || key === "cfo") return "functional_lead";
  if (key === "engineer" || key === "devops" || key === "qa" || key === "researcher" || key === "designer" || key === "pm" || key === "general") {
    return "functional_lead";
  }
  return getOrgRoleBand(role);
}

export function getOrgManagerRoleForAgent(
  role: string | null | undefined,
  name?: string | null | undefined,
  title?: string | null | undefined,
): string | null {
  if (nameLooksGateway(name) || titleLooksGateway(title)) return "ceo";

  const key = normalizeAgentUrlKey(role);
  if (!key) return "cto";

  if (key === "ceo") return null;
  if (key === "cto" || key === "cmo" || key === "cfo") return key;

  if (titleLooksGrowthMarketing(title) || normalizeAgentUrlKey(name)?.includes("growth")) {
    return "cmo";
  }

  if (normalizeAgentUrlKey(title)?.includes("finance") || normalizeAgentUrlKey(title)?.includes("budget") || normalizeAgentUrlKey(title)?.includes("pricing") || normalizeAgentUrlKey(title)?.includes("margin")) {
    return "cfo";
  }

  if (key === "designer") return "cmo";
  if (key === "engineer" || key === "devops" || key === "qa" || key === "researcher" || key === "pm" || key === "general") {
    return "cto";
  }

  if (titleLooksLead(title) || nameLooksLead(name)) return "cto";
  if (titleLooksGrowthMarketing(title)) {
    return "cmo";
  }
  return "cto";
}

export function getOrgRoleRank(role: string | null | undefined): number {
  const key = normalizeAgentUrlKey(role);
  if (!key) return 50;
  if (EXECUTIVE_ROLE_RANK.has(key)) return EXECUTIVE_ROLE_RANK.get(key) ?? 50;
  if (FUNCTIONAL_LEAD_ROLE_RANK.has(key)) return FUNCTIONAL_LEAD_ROLE_RANK.get(key) ?? 50;
  return 50;
}

export function getOrgRoleFlowLabel(
  role: string | null | undefined,
  name?: string | null | undefined,
  title?: string | null | undefined,
): string {
  switch (getOrgRoleBandForAgent(role, name, title)) {
    case "executive":
      return "Executive";
    case "functional_lead":
      return "Functional lead";
    case "operator":
      return "Operator";
    case "support":
    default:
      return "Support";
  }
}

export function getOrgManagerRoleCandidates(role: string | null | undefined): string[] {
  const key = normalizeAgentUrlKey(role);
  if (!key) return ["cto", "ceo"];
  return ROLE_MANAGER_CANDIDATES.get(key) ?? ["cto", "ceo"];
}
