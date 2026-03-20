import { describe, expect, it } from "vitest";
import {
  buildDefaultAgentPermissionGrants,
  canAssignTasksByRole,
  normalizeAgentPermissions,
} from "../services/agent-permissions.js";

describe("agent permission policy", () => {
  it("allows supervisory roles to assign tasks even without legacy create permission", () => {
    expect(canAssignTasksByRole("ceo", null, "CEO", null)).toBe(true);
    expect(canAssignTasksByRole("cto", null, "CTO", null)).toBe(true);
    expect(canAssignTasksByRole("cmo", null, "CMO", null)).toBe(true);
    expect(canAssignTasksByRole("cfo", null, "CFO", null)).toBe(true);
    expect(canAssignTasksByRole("engineer", null)).toBe(false);
  });

  it("does not grant assign rights to specialists that reuse executive roles as taxonomy", () => {
    expect(canAssignTasksByRole("cmo", null, "Content Creator", null)).toBe(false);
    expect(canAssignTasksByRole("cmo", null, "Social Instagram", null)).toBe(false);
  });

  it("still honors explicit legacy canCreateAgents for non-supervisors", () => {
    expect(canAssignTasksByRole("general", { canCreateAgents: true })).toBe(true);
    expect(canAssignTasksByRole("general", { canCreateAgents: false })).toBe(false);
  });

  it("maps assign-capable agents to tasks:assign grants", () => {
    expect(buildDefaultAgentPermissionGrants("cto", null, "CTO", null)).toEqual([
      { permissionKey: "tasks:assign" },
    ]);
    expect(buildDefaultAgentPermissionGrants("engineer", null)).toEqual([]);
    expect(buildDefaultAgentPermissionGrants("general", { canCreateAgents: true })).toEqual([
      { permissionKey: "tasks:assign" },
    ]);
  });

  it("normalizes explicit boolean permissions", () => {
    expect(normalizeAgentPermissions({ canCreateAgents: true }, "engineer")).toEqual({
      canCreateAgents: true,
    });
  });
});
