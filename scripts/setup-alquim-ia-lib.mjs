import os from "node:os";
import path from "node:path";

export const DEFAULT_OPENCLAW_GATEWAY_PORT = 18789;
export const DEFAULT_PAPERCLIP_API_URL = "http://127.0.0.1:3100";
export const DEFAULT_PRIVATE_CONFIG = path.join(
  os.homedir(),
  ".config",
  "paperclip-bootstrap",
  "alquim-ia.private.json",
);
export const DEFAULT_PRIVATE_BUNDLE_DIR = path.join(
  os.homedir(),
  ".config",
  "paperclip-bootstrap",
  "alquim-ia.bundle",
);

const PROVIDER_CATALOG = [
  {
    id: "openai",
    label: "OpenAI",
    authChoice: "openai-api-key",
    apiKeyFlag: "--openai-api-key",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    authChoice: null,
    apiKeyFlag: "--anthropic-api-key",
    envVar: "ANTHROPIC_API_KEY",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    authChoice: "gemini-api-key",
    apiKeyFlag: "--gemini-api-key",
    envVar: "GEMINI_API_KEY",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    authChoice: "openrouter-api-key",
    apiKeyFlag: "--openrouter-api-key",
    envVar: "OPENROUTER_API_KEY",
  },
  {
    id: "mistral",
    label: "Mistral",
    authChoice: "mistral-api-key",
    apiKeyFlag: "--mistral-api-key",
    envVar: "MISTRAL_API_KEY",
  },
  {
    id: "custom",
    label: "Proveedor OpenAI-compatible",
    authChoice: "custom-api-key",
    apiKeyFlag: "--custom-api-key",
    envVar: "CUSTOM_API_KEY",
    requiresBaseUrl: true,
    requiresModelId: true,
  },
];

export function getProviderCatalog() {
  return PROVIDER_CATALOG.map((provider) => ({ ...provider }));
}

export function ensureAbsoluteMaybeHome(inputPath, homedir = os.homedir()) {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith("~/")) {
    return path.join(homedir, inputPath.slice(2));
  }
  return path.resolve(inputPath);
}

export function deriveOpenClawHome(env = process.env, homedir = os.homedir()) {
  const explicit = env.OPENCLAW_HOME?.trim();
  if (explicit) {
    return ensureAbsoluteMaybeHome(explicit, homedir);
  }
  return path.join(homedir, ".openclaw");
}

export function getProviderById(providerId) {
  return PROVIDER_CATALOG.find((provider) => provider.id === providerId) ?? null;
}

export function buildOpenClawOnboardArgs(provider, options = {}) {
  if (!provider) {
    throw new Error("Provider definition is required");
  }
  const args = [
    "onboard",
    "--non-interactive",
    "--mode",
    "local",
    "--flow",
    "quickstart",
    "--gateway-port",
    String(options.gatewayPort ?? DEFAULT_OPENCLAW_GATEWAY_PORT),
    "--gateway-bind",
    "loopback",
    "--gateway-auth",
    "token",
    "--install-daemon",
    "--skip-skills",
    "--accept-risk",
  ];

  if (provider.authChoice) {
    args.push("--auth-choice", provider.authChoice);
  }

  if (typeof options.apiKey === "string" && options.apiKey.trim()) {
    args.push(provider.apiKeyFlag, options.apiKey.trim());
  }

  if (provider.requiresBaseUrl) {
    if (!options.customBaseUrl?.trim()) {
      throw new Error(`Provider ${provider.id} requires customBaseUrl`);
    }
    args.push("--custom-base-url", options.customBaseUrl.trim());
  }

  if (provider.requiresModelId) {
    if (!options.customModelId?.trim()) {
      throw new Error(`Provider ${provider.id} requires customModelId`);
    }
    args.push("--custom-model-id", options.customModelId.trim());
  }

  return args;
}

export function buildBootstrapPrivateConfig({
  companyName = "Alquim-IA",
  paperclipApiUrl = DEFAULT_PAPERCLIP_API_URL,
  paperclipAgentReachableApiUrl = DEFAULT_PAPERCLIP_API_URL,
  gatewayUrl = `ws://127.0.0.1:${DEFAULT_OPENCLAW_GATEWAY_PORT}`,
  gatewayToken,
  agentsSourceDir,
  installAgentsDir,
  claimsDir,
  skillsSourceDir,
  installSkillsDir,
}) {
  if (!gatewayToken?.trim()) {
    throw new Error("gatewayToken is required");
  }

  return {
    paperclip: {
      apiUrl: paperclipApiUrl,
      agentReachableApiUrl: paperclipAgentReachableApiUrl,
      companyName,
    },
    openclaw: {
      gatewayUrl,
      gatewayToken: gatewayToken.trim(),
      agentsSourceDir,
      installAgentsDir,
      claimsDir,
      skillsSourceDir,
      installSkillsDir,
    },
    agents: {
      ceo: { sessionKey: "ceo" },
      cto: { sessionKey: "cto" },
      cmo: { sessionKey: "cmo" },
      cfo: { sessionKey: "cfo" },
    },
  };
}

export function parseGatewayTokenOutput(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
      if (typeof parsed?.value === "string" && parsed.value.trim()) return parsed.value.trim();
      if (typeof parsed?.token === "string" && parsed.token.trim()) return parsed.token.trim();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function buildPrivateBundleLookup(privateBundleDir = DEFAULT_PRIVATE_BUNDLE_DIR) {
  const absoluteBundle = ensureAbsoluteMaybeHome(privateBundleDir);
  return {
    rootDir: absoluteBundle,
    agentsDir: path.join(absoluteBundle, "agents"),
    skillsDir: path.join(absoluteBundle, "skills"),
    docsDir: path.join(absoluteBundle, "docs"),
  };
}
