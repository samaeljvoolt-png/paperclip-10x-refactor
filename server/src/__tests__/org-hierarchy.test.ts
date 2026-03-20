import { describe, expect, it } from "vitest";
import {
  getOrgManagerRoleCandidates,
  getOrgManagerRoleForAgent,
  getOrgRoleBand,
  getOrgRoleBandForAgent,
  getOrgRoleFlowLabel,
} from "../../../packages/shared/src/org-hierarchy.ts";

describe("org hierarchy helpers", () => {
  it("returns the expected manager chain for functional roles", () => {
    expect(getOrgManagerRoleCandidates("designer")).toEqual(["cmo", "cto", "ceo"]);
    expect(getOrgManagerRoleCandidates("general")).toEqual(["cto", "ceo"]);
  });

  it("classifies roles into readable command bands", () => {
    expect(getOrgRoleBand("ceo")).toBe("executive");
    expect(getOrgRoleBand("engineer")).toBe("functional_lead");
    expect(getOrgRoleBand("general")).toBe("operator");
    expect(getOrgRoleFlowLabel("ceo")).toBe("Executive");
  });

  it("classifies gateway controllers as support and routes them to CEO", () => {
    expect(getOrgRoleBandForAgent("general", "Sammy", "Legacy Controller")).toBe("support");
    expect(getOrgRoleFlowLabel("general", "Sammy", "Legacy Controller")).toBe("Support");
    expect(getOrgManagerRoleForAgent("general", "Sammy", "Legacy Controller")).toBe("ceo");
  });

  it("routes growth and creative leads through the CMO domain", () => {
    expect(getOrgManagerRoleForAgent("general", "Growth Hacker", "Growth Lead")).toBe("cmo");
    expect(getOrgManagerRoleForAgent("general", "Creative Director", "Creative Director")).toBe("cmo");
    expect(getOrgRoleBandForAgent("cmo", "Brand Guardian", null)).toBe("functional_lead");
    expect(getOrgManagerRoleForAgent("cmo", "Brand Guardian", null)).toBe("cmo");
  });
});
