import { describe, expect, it } from "vitest";
import path from "node:path";
import { buildOpenClawClaimApiKeyResponse } from "../routes/access.js";

const EXPECTED_CLAIM_PATH = process.env.HOME
  ? path.join(process.env.HOME, ".openclaw", "workspace", "claims", "ceo.json")
  : "~/.openclaw/workspace/claims/ceo.json";

describe("buildOpenClawClaimApiKeyResponse", () => {
  it("binds the claimed API key response to the specific agent identity", () => {
    const response = buildOpenClawClaimApiKeyResponse({
      agent: {
        id: "agent-123",
        companyId: "company-456",
        name: "CEO",
        role: "ceo",
      },
      key: {
        id: "key-789",
        token: "pcp_abc123",
        createdAt: new Date("2026-03-19T00:00:00.000Z"),
      },
    });

    expect(response).toMatchObject({
      keyId: "key-789",
      token: "pcp_abc123",
      agentId: "agent-123",
      companyId: "company-456",
      agentName: "CEO",
      agentRole: "ceo",
      agentSlug: "ceo",
      agentKind: "supervisor",
      claimFilePath: EXPECTED_CLAIM_PATH,
      claimIdentity: {
        agentId: "agent-123",
        companyId: "company-456",
        agentName: "CEO",
        agentRole: "ceo",
        agentSlug: "ceo",
        agentKind: "supervisor",
        claimFilePath: EXPECTED_CLAIM_PATH,
      },
    });
  });
});
