import { describe, expect, it } from "vitest";

import {
  DEFAULT_OPENCLAW_GATEWAY_PORT,
  buildBootstrapPrivateConfig,
  buildOpenClawOnboardArgs,
  buildPrivateBundleLookup,
  deriveOpenClawHome,
  getProviderById,
  parseGatewayTokenOutput,
} from "../../../scripts/setup-alquim-ia-lib.mjs";

describe("alquim-ia setup wizard helpers", () => {
  it("builds openclaw onboard args for openai", () => {
    const provider = getProviderById("openai");
    expect(provider).toBeTruthy();

    const args = buildOpenClawOnboardArgs(provider, {
      apiKey: "sk-test",
      gatewayPort: DEFAULT_OPENCLAW_GATEWAY_PORT,
    });

    expect(args).toContain("onboard");
    expect(args).toContain("--non-interactive");
    expect(args).toContain("--install-daemon");
    expect(args).toContain("--gateway-auth");
    expect(args).toContain("token");
    expect(args).toContain("--auth-choice");
    expect(args).toContain("openai-api-key");
    expect(args).toContain("--openai-api-key");
    expect(args).toContain("sk-test");
  });

  it("requires custom provider fields when building onboard args", () => {
    const provider = getProviderById("custom");
    expect(provider).toBeTruthy();

    expect(() =>
      buildOpenClawOnboardArgs(provider, {
        apiKey: "custom-secret",
      }),
    ).toThrow(/customBaseUrl/);
  });

  it("supports deepseek via preconfigured custom provider defaults", () => {
    const provider = getProviderById("deepseek");
    expect(provider).toBeTruthy();

    const args = buildOpenClawOnboardArgs(provider, {
      apiKey: "deepseek-secret",
      customBaseUrl: "https://api.deepseek.com/v1",
      customModelId: "deepseek-chat",
    });

    expect(args).toContain("--auth-choice");
    expect(args).toContain("custom-api-key");
    expect(args).toContain("--custom-base-url");
    expect(args).toContain("https://api.deepseek.com/v1");
    expect(args).toContain("--custom-model-id");
    expect(args).toContain("deepseek-chat");
  });

  it("builds bootstrap private config with skills and claims paths", () => {
    const config = buildBootstrapPrivateConfig({
      companyName: "Alquim-IA",
      paperclipApiUrl: "http://127.0.0.1:3100",
      paperclipAgentReachableApiUrl: "http://127.0.0.1:3100",
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayToken: "gateway-secret",
      agentsSourceDir: "/tmp/alquim-agents",
      installAgentsDir: "/home/user/.openclaw/agents",
      claimsDir: "/home/user/.openclaw/workspace/claims",
      skillsSourceDir: "/tmp/alquim-skills",
      installSkillsDir: "/home/user/.openclaw/skills",
    });

    expect(config.openclaw.gatewayToken).toBe("gateway-secret");
    expect(config.openclaw.skillsSourceDir).toBe("/tmp/alquim-skills");
    expect(config.openclaw.installSkillsDir).toBe("/home/user/.openclaw/skills");
    expect(config.agents.ceo.sessionKey).toBe("ceo");
  });

  it("derives openclaw home and bundle paths from env/home", () => {
    expect(deriveOpenClawHome({ OPENCLAW_HOME: "~/svc-openclaw" }, "/home/tester")).toBe(
      "/home/tester/svc-openclaw",
    );

    const bundle = buildPrivateBundleLookup("~/bundle");
    expect(bundle.rootDir).toContain("/bundle");
    expect(bundle.agentsDir.endsWith("/bundle/agents")).toBe(true);
    expect(bundle.skillsDir.endsWith("/bundle/skills")).toBe(true);
  });

  it("parses gateway token outputs from plain text and json payloads", () => {
    expect(parseGatewayTokenOutput("secret-token\n")).toBe("secret-token");
    expect(parseGatewayTokenOutput(JSON.stringify({ value: "json-secret" }))).toBe("json-secret");
  });
});
