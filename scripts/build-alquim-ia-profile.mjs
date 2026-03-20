import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const EXCLUDED_AGENT_SLUGS = new Set([
  "hierarchy-flow-engineer",
  "qa-flow-engineer",
]);

function usage() {
  console.error(
    "Usage: node scripts/build-alquim-ia-profile.mjs --source <raw-export-dir> --out <public-profile-dir>",
  );
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

function ensureAbsolute(inputPath) {
  return path.resolve(inputPath);
}

function normalizeOpenClawAdapterConfig(agent) {
  const metadata = agent.metadata && typeof agent.metadata === "object" ? agent.metadata : {};
  const sourceAgentId =
    typeof metadata.sourceAgentId === "string" && metadata.sourceAgentId.trim().length > 0
      ? metadata.sourceAgentId.trim()
      : agent.slug.replace(/-/g, "_");
  return {
    url: "{{OPENCLAW_GATEWAY_URL}}",
    headers: {
      "x-openclaw-token": "{{OPENCLAW_GATEWAY_TOKEN}}",
    },
    paperclipApiUrl: "{{PAPERCLIP_API_URL}}",
    waitTimeoutMs: 600000,
    sessionKeyStrategy: "run",
    sessionKey: sourceAgentId,
    role: "operator",
    scopes: ["operator.admin"],
  };
}

function sanitizeAgent(agent) {
  const next = clone(agent);
  if (next.adapterType === "openclaw_gateway") {
    next.adapterConfig = normalizeOpenClawAdapterConfig(next);
  }
  if (next.metadata && typeof next.metadata === "object") {
    delete next.metadata.sourceWorkspace;
  }
  return next;
}

async function copyDirFiltered(sourceDir, targetDir, allowedRelativeFiles) {
  await mkdir(targetDir, { recursive: true });
  for (const relativeFile of allowedRelativeFiles) {
    const sourceFile = path.join(sourceDir, relativeFile);
    const targetFile = path.join(targetDir, relativeFile);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await copyFile(sourceFile, targetFile);
  }
}

function stripFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return normalized.trim();
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) return normalized.trim();
  return normalized.slice(closing + 5).trim();
}

function renderYamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function renderFrontmatter(frontmatter) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }
      lines.push(`${key}:`);
      for (const entry of value) {
        lines.push(`  - ${renderYamlScalar(entry)}`);
      }
      continue;
    }
    lines.push(`${key}: ${renderYamlScalar(value)}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

function buildSanitizedAgentMarkdown(agent, rawMarkdown) {
  const body = stripFrontmatter(rawMarkdown);
  const frontmatter = {
    name: agent.name,
    slug: agent.slug,
    role: agent.role,
    adapterType: agent.adapterType,
    kind: "agent",
    title: agent.title ?? null,
    icon: agent.icon ?? null,
    capabilities: agent.capabilities ?? null,
    reportsTo: agent.reportsToSlug ?? null,
    requiredSecrets: ["OPENCLAW_GATEWAY_URL", "OPENCLAW_GATEWAY_TOKEN", "PAPERCLIP_API_URL"],
  };
  return `${renderFrontmatter(frontmatter)}\n${body}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  const sourceDir = typeof args.source === "string" ? ensureAbsolute(args.source) : null;
  const outDir = typeof args.out === "string" ? ensureAbsolute(args.out) : null;
  const docsSourceDir = typeof args["docs-source"] === "string" ? ensureAbsolute(args["docs-source"]) : null;
  if (!sourceDir || !outDir) {
    usage();
    process.exit(1);
  }

  const manifestPath = path.join(sourceDir, "paperclip.manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const publicManifest = clone(manifest);

  publicManifest.generatedAt = new Date().toISOString();
  publicManifest.source = null;
  publicManifest.agents = (publicManifest.agents ?? [])
    .filter((agent) => !EXCLUDED_AGENT_SLUGS.has(agent.slug))
    .map((agent) => sanitizeAgent(agent));
  publicManifest.requiredSecrets = [
    {
      key: "OPENCLAW_GATEWAY_URL",
      description: "WebSocket URL of your OpenClaw gateway.",
      agentSlug: null,
      providerHint: "openclaw",
    },
    {
      key: "OPENCLAW_GATEWAY_TOKEN",
      description: "Shared OpenClaw gateway token used by imported agents.",
      agentSlug: null,
      providerHint: "openclaw",
    },
    {
      key: "PAPERCLIP_API_URL",
      description: "Reachable Paperclip base URL for your OpenClaw agents.",
      agentSlug: null,
      providerHint: "paperclip",
    },
  ];

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await copyDirFiltered(sourceDir, outDir, ["COMPANY.md"]);
  for (const agent of publicManifest.agents) {
    const sourceMarkdown = await readFile(path.join(sourceDir, agent.path), "utf8");
    const targetFile = path.join(outDir, agent.path);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(targetFile, buildSanitizedAgentMarkdown(agent, sourceMarkdown), "utf8");
  }
  if (docsSourceDir) {
    await mkdir(path.join(outDir, "docs"), { recursive: true });
    for (const docName of ["ORGANIZATION.md", "SKILLS.md"]) {
      const sourceDoc = path.join(docsSourceDir, docName);
      try {
        await copyFile(sourceDoc, path.join(outDir, "docs", docName));
      } catch {
        // optional docs
      }
    }
  }
  await writeFile(
    path.join(outDir, "paperclip.manifest.json"),
    JSON.stringify(publicManifest, null, 2),
    "utf8",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
