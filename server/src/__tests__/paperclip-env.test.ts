import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { buildPaperclipClaimIdentity, buildPaperclipEnv } from "../adapters/utils.js";

const ORIGINAL_PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL;
const ORIGINAL_PAPERCLIP_LISTEN_HOST = process.env.PAPERCLIP_LISTEN_HOST;
const ORIGINAL_PAPERCLIP_LISTEN_PORT = process.env.PAPERCLIP_LISTEN_PORT;
const ORIGINAL_HOST = process.env.HOST;
const ORIGINAL_PORT = process.env.PORT;
const EXPECTED_CLAIMS_ROOT = process.env.HOME
  ? path.join(process.env.HOME, ".openclaw", "workspace", "claims")
  : "~/.openclaw/workspace/claims";

afterEach(() => {
  if (ORIGINAL_PAPERCLIP_API_URL === undefined) delete process.env.PAPERCLIP_API_URL;
  else process.env.PAPERCLIP_API_URL = ORIGINAL_PAPERCLIP_API_URL;

  if (ORIGINAL_PAPERCLIP_LISTEN_HOST === undefined) delete process.env.PAPERCLIP_LISTEN_HOST;
  else process.env.PAPERCLIP_LISTEN_HOST = ORIGINAL_PAPERCLIP_LISTEN_HOST;

  if (ORIGINAL_PAPERCLIP_LISTEN_PORT === undefined) delete process.env.PAPERCLIP_LISTEN_PORT;
  else process.env.PAPERCLIP_LISTEN_PORT = ORIGINAL_PAPERCLIP_LISTEN_PORT;

  if (ORIGINAL_HOST === undefined) delete process.env.HOST;
  else process.env.HOST = ORIGINAL_HOST;

  if (ORIGINAL_PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL_PORT;
});

describe("buildPaperclipEnv", () => {
  it("prefers an explicit PAPERCLIP_API_URL", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:4100";
    process.env.PAPERCLIP_LISTEN_HOST = "127.0.0.1";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1", name: "CEO", role: "ceo" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:4100");
    expect(env.PAPERCLIP_CLAIM_FILE).toBe(path.join(EXPECTED_CLAIMS_ROOT, "ceo.json"));
    expect(env.PAPERCLIP_AGENT_KIND).toBe("supervisor");
    expect(env.PAPERCLIP_EXPECTED_CLAIM_AGENT_ID).toBe("agent-1");
    expect(env.PAPERCLIP_EXPECTED_CLAIM_ROLE).toBe("ceo");
  });

  it("strips trailing slashes from explicit PAPERCLIP_API_URL", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:4100/";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1", name: "CEO", role: "ceo" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:4100");
  });

  it("uses runtime listen host/port when explicit URL is not set", () => {
    delete process.env.PAPERCLIP_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "0.0.0.0";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";
    process.env.PORT = "3100";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1", name: "Dev Researcher" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:3101");
    expect(env.PAPERCLIP_CLAIM_FILE).toBe(path.join(EXPECTED_CLAIMS_ROOT, "dev-researcher.json"));
    expect(env.PAPERCLIP_AGENT_KIND).toBe("executor");
    expect(env.PAPERCLIP_EXPECTED_CLAIM_FILE).toBe(path.join(EXPECTED_CLAIMS_ROOT, "dev-researcher.json"));
  });

  it("formats IPv6 hosts safely in fallback URL generation", () => {
    delete process.env.PAPERCLIP_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "::1";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1", name: "Sammy" });

    expect(env.PAPERCLIP_API_URL).toBe("http://[::1]:3101");
    expect(env.PAPERCLIP_CLAIM_FILE).toBe(path.join(EXPECTED_CLAIMS_ROOT, "sammy.json"));
  });

  it("builds a claim identity that can be validated by launchers", () => {
    const identity = buildPaperclipClaimIdentity({
      id: "agent-1",
      companyId: "company-1",
      name: "Sammy",
      role: "general",
    });

    expect(identity).toEqual({
      agentId: "agent-1",
      companyId: "company-1",
      agentName: "Sammy",
      agentRole: "general",
      agentSlug: "sammy",
      agentKind: "executor",
      claimFilePath: path.join(EXPECTED_CLAIMS_ROOT, "sammy.json"),
    });
  });
});
