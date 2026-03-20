import { generateKeyPairSync } from "node:crypto";
import http from "node:http";
import { mkdir, mkdtemp, readFile, writeFile, cp, stat, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { tmpdir } from "node:os";

const DEFAULT_PROFILE_DIR = path.resolve("bootstrap/alquim-ia/public");
const DEFAULT_PRIVATE_CONFIG = path.join(os.homedir(), ".config", "paperclip-bootstrap", "alquim-ia.private.json");
const SUPERVISOR_KEYS = new Set(["ceo", "cto", "cmo", "cfo"]);

function usage() {
  console.log(`Usage: pnpm bootstrap:alquim-ia [options]

Options:
  --profile <dir>         Public profile directory (default: bootstrap/alquim-ia/public)
  --private-config <file> Private config JSON (default: ~/.config/paperclip-bootstrap/alquim-ia.private.json)
  --api-url <url>         Paperclip API base URL override
  --company-name <name>   Override target company name
  --dry-run               Preview only, do not import
  --skip-agent-sync       Do not copy OpenClaw private agent directories
  --skip-skill-sync       Do not copy OpenClaw skills directories
  --skip-claims           Do not create claim files
  --skip-verify           Skip post-install verification
`);
}

function parseArgs(argv) {
  const out = {};
  for (let idx = 2; idx < argv.length; idx += 1) {
    const part = argv[idx];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const value = argv[idx + 1];
    if (!value || value.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = value;
    idx += 1;
  }
  return out;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureAbsoluteMaybeHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return path.resolve(inputPath);
}

function normalizeApiBase(input) {
  return input.replace(/\/+$/, "");
}

function normalizeAgentKey(value) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function deriveAgentSlug(agent) {
  return (
    normalizeAgentKey(agent.slug) ??
    normalizeAgentKey(agent.urlKey) ??
    normalizeAgentKey(agent.name) ??
    normalizeAgentKey(agent.role) ??
    agent.id
  );
}

function resolveClaimsDir(rootInput) {
  return ensureAbsoluteMaybeHome(rootInput ?? "~/.openclaw/workspace/claims");
}

function buildClaimIdentity(agent, claimsDir) {
  const agentSlug =
    normalizeAgentKey(agent.name) ??
    normalizeAgentKey(agent.role) ??
    normalizeAgentKey(agent.id) ??
    agent.id;
  const roleKey = normalizeAgentKey(agent.role);
  const nameKey = normalizeAgentKey(agent.name);
  const agentKind =
    (roleKey && SUPERVISOR_KEYS.has(roleKey)) || (nameKey && SUPERVISOR_KEYS.has(nameKey))
      ? "supervisor"
      : "executor";
  return {
    agentId: agent.id,
    companyId: agent.companyId,
    agentName: agent.name?.trim() ? agent.name.trim() : null,
    agentRole: roleKey,
    agentSlug,
    agentKind,
    claimFilePath: path.join(claimsDir, `${agentSlug}.json`),
  };
}

function createEd25519PrivateKeyPem() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function pathExists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function apiFetchJson(apiBase, pathname, init = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function loadPublicFiles(profileDir, manifest) {
  const files = {};
  if (manifest.company?.path) {
    files[manifest.company.path] = path.join(profileDir, manifest.company.path);
  }
  for (const agent of manifest.agents ?? []) {
    files[agent.path] = path.join(profileDir, agent.path);
  }
  return files;
}

function buildRenderedManifest(manifest, privateConfig, apiBase, companyNameOverride) {
  const nextManifest = clone(manifest);
  if (nextManifest.company && typeof companyNameOverride === "string" && companyNameOverride.trim()) {
    nextManifest.company.name = companyNameOverride.trim();
  }
  for (const agent of nextManifest.agents ?? []) {
    if (agent.adapterType !== "openclaw_gateway") continue;
    const agentOverride = privateConfig.agents?.[agent.slug] ?? {};
    agent.adapterConfig = {
      ...agent.adapterConfig,
      url: privateConfig.openclaw.gatewayUrl,
      headers: {
        "x-openclaw-token": privateConfig.openclaw.gatewayToken,
      },
      paperclipApiUrl:
        privateConfig.paperclip.agentReachableApiUrl ??
        privateConfig.paperclip.apiUrl ??
        apiBase,
      devicePrivateKeyPem: agentOverride.devicePrivateKeyPem ?? createEd25519PrivateKeyPem(),
      sessionKey: agentOverride.sessionKey ?? agent.adapterConfig?.sessionKey ?? agent.slug.replace(/-/g, "_"),
      sessionKeyStrategy: agentOverride.sessionKeyStrategy ?? agent.adapterConfig?.sessionKeyStrategy ?? "run",
      waitTimeoutMs: agentOverride.waitTimeoutMs ?? agent.adapterConfig?.waitTimeoutMs ?? 600000,
      role: agentOverride.role ?? agent.adapterConfig?.role ?? "operator",
      scopes: agentOverride.scopes ?? agent.adapterConfig?.scopes ?? ["operator.admin"],
    };
  }
  return {
    manifest: nextManifest,
  };
}

async function findOrCreateTargetCompany(apiBase, companyName) {
  const companies = await apiFetchJson(apiBase, "/api/companies");
  const existing = companies.find((company) => company.name === companyName) ?? null;
  if (existing) {
    return {
      target: { mode: "existing_company", companyId: existing.id },
      existingCompanyId: existing.id,
    };
  }
  return {
    target: { mode: "new_company", newCompanyName: companyName },
    existingCompanyId: null,
  };
}

async function writeClaimFiles(apiBase, companyId, privateConfig) {
  const claimsDir = resolveClaimsDir(privateConfig.openclaw.claimsDir);
  await mkdir(claimsDir, { recursive: true });
  const agents = await apiFetchJson(apiBase, `/api/companies/${companyId}/agents`);
  const results = [];
  for (const agent of agents) {
    if (agent.adapterType !== "openclaw_gateway") continue;

    const existingKeys = await apiFetchJson(apiBase, `/api/agents/${agent.id}/keys`);
    for (const key of existingKeys) {
      if (key.name === "bootstrap-default" && !key.revokedAt) {
        await apiFetchJson(apiBase, `/api/agents/${agent.id}/keys/${key.id}`, { method: "DELETE" });
      }
    }

    const createdKey = await apiFetchJson(apiBase, `/api/agents/${agent.id}/keys`, {
      method: "POST",
      body: JSON.stringify({ name: "bootstrap-default" }),
    });
    const claimIdentity = buildClaimIdentity(agent, claimsDir);
    const claimPayload = {
      keyId: createdKey.id,
      token: createdKey.token,
      createdAt: createdKey.createdAt,
      agentId: claimIdentity.agentId,
      companyId: claimIdentity.companyId,
      agentName: claimIdentity.agentName,
      agentRole: claimIdentity.agentRole,
      agentSlug: claimIdentity.agentSlug,
      agentKind: claimIdentity.agentKind,
      claimFilePath: claimIdentity.claimFilePath,
      claimIdentity,
    };
    const targetPath = path.join(claimsDir, `${claimIdentity.agentSlug}.json`);
    await writeFile(targetPath, JSON.stringify(claimPayload, null, 2), "utf8");
    results.push({ agent: agent.name, path: targetPath });
  }
  return results;
}

function candidateAgentDirNames(agent) {
  const names = new Set();
  if (typeof agent.metadata?.sourceAgentId === "string" && agent.metadata.sourceAgentId.trim()) {
    names.add(agent.metadata.sourceAgentId.trim());
  }
  const slug = deriveAgentSlug(agent);
  names.add(slug);
  names.add(slug.replace(/-/g, "_"));
  return [...names];
}

async function syncOpenClawAgents(apiBase, companyId, privateConfig) {
  const sourceDir = ensureAbsoluteMaybeHome(privateConfig.openclaw.agentsSourceDir);
  const targetDir = ensureAbsoluteMaybeHome(privateConfig.openclaw.installAgentsDir ?? "~/.openclaw/agents");
  if (!sourceDir) {
    return { copied: [], skipped: ["No openclaw.agentsSourceDir configured"] };
  }
  await mkdir(targetDir, { recursive: true });
  for (const docName of ["SKILLS.md", "ORGANIZATION.md"]) {
    const sourceDoc = path.join(sourceDir, docName);
    if (await pathExists(sourceDoc)) {
      await cp(sourceDoc, path.join(targetDir, docName), { force: true });
    }
  }
  const agents = await apiFetchJson(apiBase, `/api/companies/${companyId}/agents`);
  const copied = [];
  const skipped = [];
  for (const agent of agents) {
    if (agent.adapterType !== "openclaw_gateway") continue;
    let matched = null;
    for (const candidate of candidateAgentDirNames(agent)) {
      const sourceCandidate = path.join(sourceDir, candidate);
      if (await pathExists(sourceCandidate)) {
        matched = { sourceCandidate, candidate };
        break;
      }
    }
    if (!matched) {
      skipped.push(agent.name);
      continue;
    }
    const targetCandidate = path.join(targetDir, matched.candidate);
    await cp(matched.sourceCandidate, targetCandidate, { recursive: true, force: true });
    copied.push({ agent: agent.name, source: matched.sourceCandidate, target: targetCandidate });
  }
  return { copied, skipped };
}

async function syncOpenClawSkills(privateConfig) {
  const sourceDir = ensureAbsoluteMaybeHome(privateConfig.openclaw.skillsSourceDir);
  const targetDir = ensureAbsoluteMaybeHome(privateConfig.openclaw.installSkillsDir ?? "~/.openclaw/skills");
  if (!sourceDir) {
    return { copied: [], skipped: ["No openclaw.skillsSourceDir configured"] };
  }
  if (!(await pathExists(sourceDir))) {
    return { copied: [], skipped: [`Skills source not found: ${sourceDir}`] };
  }

  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const copied = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourceCandidate = path.join(sourceDir, entry.name);
    const targetCandidate = path.join(targetDir, entry.name);
    await cp(sourceCandidate, targetCandidate, { recursive: true, force: true });
    copied.push({ skill: entry.name, source: sourceCandidate, target: targetCandidate });
  }

  return { copied, skipped: [] };
}

async function verifyInstall(apiBase, companyId, expectedAgentCount) {
  const health = await apiFetchJson(apiBase, "/api/health");
  const org = await apiFetchJson(apiBase, `/api/companies/${companyId}/org`);
  const agents = await apiFetchJson(apiBase, `/api/companies/${companyId}/agents`);
  const ceoRoots = org.filter((node) => node.role === "ceo");
  return {
    healthStatus: health.status,
    agentCount: agents.length,
    expectedAgentCount,
    ceoRootCount: ceoRoots.length,
  };
}

async function createRenderedProfile(profileDir, manifest, privateConfig, apiBase, companyNameOverride) {
  const rendered = buildRenderedManifest(manifest, privateConfig, apiBase, companyNameOverride).manifest;
  const tempRoot = await mkdtemp(path.join(tmpdir(), "paperclip-alquim-ia-"));
  await cp(profileDir, tempRoot, { recursive: true, force: true });
  await writeFile(
    path.join(tempRoot, "paperclip.manifest.json"),
    JSON.stringify(rendered, null, 2),
    "utf8",
  );
  return tempRoot;
}

function startStaticProfileServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
      const safeRelative = requestPath === "/" ? "/paperclip.manifest.json" : requestPath;
      const targetPath = path.resolve(rootDir, `.${safeRelative}`);
      if (!targetPath.startsWith(rootDir)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const body = await readFile(targetPath);
      const contentType = targetPath.endsWith(".json")
        ? "application/json"
        : targetPath.endsWith(".md")
          ? "text/markdown; charset=utf-8"
          : "application/octet-stream";
      res.writeHead(200, { "content-type": contentType });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind temporary profile server"));
        return;
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  const profileDir = ensureAbsoluteMaybeHome(args.profile ?? DEFAULT_PROFILE_DIR);
  const privateConfigPath = ensureAbsoluteMaybeHome(args["private-config"] ?? DEFAULT_PRIVATE_CONFIG);
  const manifest = await readJson(path.join(profileDir, "paperclip.manifest.json"));
  const privateConfig = await readJson(privateConfigPath);
  const apiBase = normalizeApiBase(
    args["api-url"] ??
      privateConfig.paperclip?.apiUrl ??
      process.env.PAPERCLIP_API_URL ??
      "http://127.0.0.1:3100",
  );
  const companyName =
    args["company-name"] ??
    privateConfig.paperclip?.companyName ??
    manifest.company?.name ??
    "Alquim-IA";

  await apiFetchJson(apiBase, "/api/health");
  const target = await findOrCreateTargetCompany(apiBase, companyName);
  const renderedProfileDir = await createRenderedProfile(profileDir, manifest, privateConfig, apiBase, companyName);
  const hosted = await startStaticProfileServer(renderedProfileDir);
  try {
    const payload = {
      source: {
        type: "url",
        url: `${hosted.baseUrl}/paperclip.manifest.json`,
      },
      include: { company: true, agents: true },
      target: target.target,
      agents: "all",
      collisionStrategy: "replace",
    };

    const preview = await apiFetchJson(apiBase, "/api/companies/import/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (args["dry-run"]) {
      console.log(JSON.stringify(preview, null, 2));
      return;
    }
    if (Array.isArray(preview.errors) && preview.errors.length > 0) {
      throw new Error(`Import preview failed: ${preview.errors.join("; ")}`);
    }

    const imported = await apiFetchJson(apiBase, "/api/companies/import", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const companyId = imported.company.id;

    const claimSummary =
      args["skip-claims"] ? [] : await writeClaimFiles(apiBase, companyId, privateConfig);
    const syncSummary =
      args["skip-agent-sync"] ? { copied: [], skipped: ["Agent sync skipped"] } : await syncOpenClawAgents(apiBase, companyId, privateConfig);
    const skillsSummary =
      args["skip-skill-sync"] ? { copied: [], skipped: ["Skill sync skipped"] } : await syncOpenClawSkills(privateConfig);
    const verifySummary =
      args["skip-verify"] ? null : await verifyInstall(apiBase, companyId, manifest.agents.length);

    console.log(
      JSON.stringify(
        {
          ok: true,
          company: imported.company,
          importedAgents: imported.agents.length,
          claimFiles: claimSummary.length,
          claims: claimSummary,
          agentSync: syncSummary,
          skillSync: skillsSummary,
          verify: verifySummary,
        },
        null,
        2,
      ),
    );
  } finally {
    await new Promise((resolve) => hosted.server.close(resolve));
    await rm(renderedProfileDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
