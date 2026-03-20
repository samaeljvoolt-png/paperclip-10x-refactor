export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
};

const SUPERVISOR_TASK_ASSIGN_KEYS = new Set(["ceo", "cto", "cmo", "cfo", "nexus"]);

type GrantInput = {
  permissionKey: "tasks:assign";
  scope?: Record<string, unknown> | null;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: role === "ceo",
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
  };
}

export function canAssignTasksByRole(
  role: string,
  permissions: unknown,
  name?: string | null,
  title?: string | null,
): boolean {
  const normalized = normalizeAgentPermissions(permissions, role);
  if (normalized.canCreateAgents) return true;
  const [roleKey, nameKey, titleKey] = [role, name ?? null, title ?? null]
    .map((value) =>
      typeof value === "string"
        ? value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "",
    )
    .filter(Boolean);
  if (roleKey === "ceo" || roleKey === "cto" || roleKey === "cfo") return true;
  if (roleKey === "cmo" && (nameKey === "cmo" || titleKey === "cmo")) return true;
  return [nameKey, titleKey].some((candidate) => SUPERVISOR_TASK_ASSIGN_KEYS.has(candidate));
}

export function buildDefaultAgentPermissionGrants(
  role: string,
  permissions: unknown,
  name?: string | null,
  title?: string | null,
): GrantInput[] {
  if (!canAssignTasksByRole(role, permissions, name, title)) return [];
  return [{ permissionKey: "tasks:assign" }];
}
