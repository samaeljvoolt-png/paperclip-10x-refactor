#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { tmpdir } from "node:os";

import {
  DEFAULT_OPENCLAW_GATEWAY_PORT,
  DEFAULT_PAPERCLIP_API_URL,
  DEFAULT_PRIVATE_BUNDLE_DIR,
  DEFAULT_PRIVATE_CONFIG,
  buildBootstrapPrivateConfig,
  buildOpenClawOnboardArgs,
  buildPrivateBundleLookup,
  deriveOpenClawHome,
  ensureAbsoluteMaybeHome,
  getProviderById,
  getProviderCatalog,
  parseGatewayTokenOutput,
} from "./setup-alquim-ia-lib.mjs";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PUBLIC_PROFILE_DIR = path.join(REPO_ROOT, "bootstrap", "alquim-ia", "public");
const PUBLIC_SKILLS_DIR = path.join(REPO_ROOT, "skills");
const DEFAULT_SETUP_STATE_DIR = path.join(
  os.homedir(),
  ".config",
  "paperclip-bootstrap",
  "alquim-ia",
);

function buildSetupStatePaths({ paperclipHome, privateConfigPath }) {
  const stateRoot = paperclipHome
    ? path.join(paperclipHome, ".bootstrap-state")
    : path.join(path.dirname(privateConfigPath), ".bootstrap-state");
  const absoluteStateRoot = ensureAbsoluteMaybeHome(stateRoot);
  return {
    stateDir: absoluteStateRoot,
    logDir: path.join(absoluteStateRoot, "logs"),
    pidFile: path.join(absoluteStateRoot, "paperclip.pid"),
    paperclipLog: path.join(absoluteStateRoot, "logs", "paperclip.log"),
  };
}

function usage() {
  console.log(`Usage: pnpm setup:alquim-ia [options]

Interactive beginner setup for:
- public OpenClaw install + onboarding
- Alquim-IA agent tree + skills sync
- local Paperclip start
- Alquim-IA company bootstrap

Options:
  --yes                       Accept sensible defaults where possible
  --provider <id>             Model provider id (${getProviderCatalog().map((x) => x.id).join(", ")})
  --api-key <key>             Provider API key (otherwise prompted securely)
  --custom-base-url <url>     Custom provider base URL
  --custom-model-id <id>      Custom provider model id
  --company-name <name>       Company name override (default: Alquim-IA)
  --paperclip-api-url <url>   Local Paperclip API URL (default: http://127.0.0.1:3100)
  --paperclip-public-url <u>  Reachable Paperclip URL for OpenClaw agents
  --paperclip-port <port>     Local Paperclip port override
  --paperclip-data-dir <dir>  Isolated Paperclip home/data dir
  --openclaw-gateway-port <n> OpenClaw gateway port override (default: 18789)
  --openclaw-home <dir>       Override OPENCLAW_HOME
  --private-config <file>     Output private config path
  --private-bundle <dir>      Optional private bundle root with agents/skills/docs
  --skip-openclaw-install     Do not install/update OpenClaw CLI
  --skip-openclaw-onboard     Do not run OpenClaw onboarding
  --skip-openclaw-daemon      Do not install the OpenClaw daemon during onboarding
  --skip-paperclip-start      Do not start local Paperclip automatically
  --skip-bootstrap            Stop after preparing OpenClaw/private config
  --dry-run                   Print planned actions, do not mutate
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

function toError(error, context = "Unexpected setup error") {
  if (error instanceof Error) return error;
  return new Error(`${context}: ${String(error)}`);
}

async function pathExists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

function shellQuote(value) {
  return JSON.stringify(value);
}

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return result.status === 0;
}

function execCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPO_ROOT,
      env: options.env ?? process.env,
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      shell: options.shell ?? false,
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    child.stdout?.on("data", (chunk) => {
      stdoutBuffer += String(chunk);
      if (options.stream) process.stdout.write(String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      stderrBuffer += String(chunk);
      if (options.stream) process.stderr.write(String(chunk));
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        code: code ?? 0,
        signal,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
      });
    });
  });
}

function buildInstallGuidance(platform) {
  if (platform === "darwin") {
    return [
      "Instala Git y curl si faltan.",
      "Instala Node 24+ con el instalador oficial o Homebrew.",
      "Luego vuelve a ejecutar ./scripts/setup-alquim-ia.sh",
    ].join(" ");
  }
  if (platform === "linux") {
    return [
      "Instala curl y git con tu gestor de paquetes.",
      "Luego vuelve a ejecutar ./scripts/setup-alquim-ia.sh; el instalador oficial de OpenClaw resuelve Node si falta.",
    ].join(" ");
  }
  return "Usa macOS o Linux para este setup.";
}

async function checkPrerequisites() {
  const platform = process.platform;
  if (!["darwin", "linux"].includes(platform)) {
    throw new Error(`Unsupported OS: ${platform}. This setup currently supports macOS and Linux only.`);
  }

  const missing = [];
  for (const command of ["curl", "git"]) {
    if (!commandExists(command)) missing.push(command);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required command(s): ${missing.join(", ")}. ${buildInstallGuidance(platform)}`);
  }
}

function createPromptInterface() {
  return readline.createInterface({ input: stdin, output: stdout });
}

async function promptText(rl, message, defaultValue = "") {
  const prompt = defaultValue ? `${message} [${defaultValue}]: ` : `${message}: `;
  const answer = (await rl.question(prompt)).trim();
  return answer || defaultValue;
}

async function promptConfirm(rl, message, defaultValue = true) {
  const suffix = defaultValue ? " [Y/n]: " : " [y/N]: ";
  const answer = (await rl.question(`${message}${suffix}`)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === "y" || answer === "yes";
}

async function promptChoice(rl, message, choices, defaultId = null) {
  stdout.write(`${message}\n`);
  for (const [index, choice] of choices.entries()) {
    const marker = choice.id === defaultId ? " (default)" : "";
    stdout.write(`  ${index + 1}. ${choice.label}${marker}\n`);
  }
  while (true) {
    const answer = (await rl.question("Selecciona una opción: ")).trim();
    if (!answer && defaultId) {
      return choices.find((choice) => choice.id === defaultId) ?? choices[0];
    }
    const numeric = Number(answer);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) {
      return choices[numeric - 1];
    }
    const byId = choices.find((choice) => choice.id === answer);
    if (byId) return byId;
    stdout.write("Opción inválida.\n");
  }
}

async function promptSecret(message) {
  if (!stdin.isTTY || !stdout.isTTY) {
    const rl = createPromptInterface();
    try {
      return (await rl.question(`${message}: `)).trim();
    } finally {
      rl.close();
    }
  }

  const wasRaw = stdin.isRaw;
  const previousListeners = stdin.listeners("data");
  for (const listener of previousListeners) {
    stdin.off("data", listener);
  }

  return await new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      const text = String(chunk);
      if (text === "\r" || text === "\n") {
        stdout.write("\n");
        cleanup();
        resolve(value.trim());
        return;
      }
      if (text === "\u0003") {
        cleanup();
        reject(new Error("Prompt cancelled by user"));
        return;
      }
      if (text === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };

    const cleanup = () => {
      stdin.off("data", onData);
      for (const listener of previousListeners) {
        stdin.on("data", listener);
      }
      if (!wasRaw) stdin.setRawMode(false);
    };

    stdout.write(`${message}: `);
    if (!wasRaw) stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function installOrUpdateOpenClaw({ dryRun = false }) {
  const installCommand = "curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard";
  if (dryRun) {
    return { action: "dry-run", command: installCommand };
  }

  const result = await execCapture("bash", ["-lc", installCommand], { stream: true });
  if (result.code !== 0) {
    throw new Error(`OpenClaw installer failed: ${result.stderr || result.stdout}`);
  }
  return { action: "installed", command: installCommand };
}

async function ensurePnpmAvailable({ dryRun = false }) {
  if (commandExists("pnpm")) return { action: "already-present" };

  const corepackAvailable = commandExists("corepack");
  if (dryRun) {
    return {
      action: "dry-run",
      command: corepackAvailable
        ? "corepack enable && corepack prepare pnpm@9.15.4 --activate"
        : "npm install -g pnpm@9.15.4",
    };
  }

  if (corepackAvailable) {
    const enable = await execCapture("corepack", ["enable"], { stream: true });
    if (enable.code !== 0) {
      throw new Error(`corepack enable failed: ${enable.stderr || enable.stdout}`);
    }
    const prepare = await execCapture("corepack", ["prepare", "pnpm@9.15.4", "--activate"], {
      stream: true,
    });
    if (prepare.code !== 0) {
      throw new Error(`corepack prepare pnpm failed: ${prepare.stderr || prepare.stdout}`);
    }
  } else {
    const install = await execCapture("npm", ["install", "-g", "pnpm@9.15.4"], { stream: true });
    if (install.code !== 0) {
      throw new Error(`npm install -g pnpm failed: ${install.stderr || install.stdout}`);
    }
  }

  return { action: "installed" };
}

async function ensureRepoDependencies({ dryRun = false }) {
  const nodeModulesDir = path.join(REPO_ROOT, "node_modules");
  if (await pathExists(nodeModulesDir)) {
    return { action: "already-present" };
  }
  if (dryRun) {
    return { action: "dry-run", command: "pnpm install" };
  }
  const install = await execCapture("pnpm", ["install"], { cwd: REPO_ROOT, stream: true });
  if (install.code !== 0) {
    throw new Error(`pnpm install failed: ${install.stderr || install.stdout}`);
  }
  return { action: "installed" };
}

async function collectProviderSetup(args) {
  const detected = getProviderCatalog().filter(
    (provider) => typeof process.env[provider.envVar] === "string" && process.env[provider.envVar].trim(),
  );
  const defaultProviderId = args.provider ?? detected[0]?.id ?? "openai";
  const provider = getProviderById(defaultProviderId);
  if (!provider) {
    throw new Error(`Unsupported provider: ${args.provider}`);
  }

  const interactive = !args.yes;
  let selectedProvider = provider;
  let apiKey = args["api-key"] ?? process.env[provider.envVar] ?? "";
  let customBaseUrl = args["custom-base-url"] ?? "";
  let customModelId = args["custom-model-id"] ?? "";

  if (interactive) {
    const rl = createPromptInterface();
    try {
      selectedProvider = await promptChoice(
        rl,
        "Selecciona el proveedor principal de modelos para OpenClaw:",
        getProviderCatalog().map((entry) => ({ id: entry.id, label: entry.label })),
        defaultProviderId,
      );
    } finally {
      rl.close();
    }
  }

  const fullProvider = getProviderById(selectedProvider.id);
  if (!fullProvider) {
    throw new Error(`Provider not found: ${selectedProvider.id}`);
  }

  apiKey = args["api-key"] ?? process.env[fullProvider.envVar] ?? "";
  if (!apiKey && !args.yes) {
    apiKey = await promptSecret(`Pega tu ${fullProvider.label} API key`);
  }
  if (!apiKey && fullProvider.id !== "custom") {
    throw new Error(`Missing API key for ${fullProvider.label}`);
  }
  if (fullProvider.requiresBaseUrl && !customBaseUrl && fullProvider.defaultBaseUrl) {
    customBaseUrl = fullProvider.defaultBaseUrl;
  }
  if (fullProvider.requiresModelId && !customModelId && fullProvider.defaultModelId) {
    customModelId = fullProvider.defaultModelId;
  }
  if (fullProvider.requiresBaseUrl && !customBaseUrl) {
    const rl = createPromptInterface();
    try {
      customBaseUrl = await promptText(
        rl,
        "Base URL compatible con OpenAI",
        fullProvider.defaultBaseUrl ?? "https://api.openai.com/v1",
      );
      customModelId = await promptText(
        rl,
        "Model ID por defecto",
        fullProvider.defaultModelId ?? "gpt-5.4",
      );
    } finally {
      rl.close();
    }
  }

  return {
    provider: fullProvider,
    apiKey,
    customBaseUrl,
    customModelId,
  };
}

async function runOpenClawOnboard({ providerSetup, openclawHome, gatewayPort, dryRun = false }) {
  const args = buildOpenClawOnboardArgs(providerSetup.provider, {
    apiKey: providerSetup.apiKey,
    gatewayPort,
    customBaseUrl: providerSetup.customBaseUrl,
    customModelId: providerSetup.customModelId,
    installDaemon: !providerSetup.skipDaemonInstall,
  });

  if (dryRun) {
    return { args };
  }

  const env = {
    ...process.env,
    OPENCLAW_HOME: openclawHome,
  };
  if (providerSetup.apiKey) {
    env[providerSetup.provider.envVar] = providerSetup.apiKey;
  }
  const result = await execCapture("openclaw", args, { env, stream: true });
  if (result.code !== 0) {
    throw new Error(`OpenClaw onboarding failed: ${result.stderr || result.stdout}`);
  }
  return { args };
}

async function ensureGatewayToken({ openclawHome, dryRun = false }) {
  const env = { ...process.env, OPENCLAW_HOME: openclawHome };
  const openclawConfigPath = path.join(openclawHome, ".openclaw", "openclaw.json");
  const readConfigToken = async () => {
    try {
      const parsed = JSON.parse(await readFile(openclawConfigPath, "utf8"));
      const token = parsed?.gateway?.auth?.token;
      return typeof token === "string" && token.trim() ? token.trim() : null;
    } catch {
      return null;
    }
  };

  if (!dryRun) {
    const configToken = await readConfigToken();
    if (configToken) return configToken;
  }

  if (!dryRun) {
    const getResult = await execCapture("openclaw", ["config", "get", "gateway.auth.token"], { env });
    const existing = parseGatewayTokenOutput(getResult.stdout);
    if (existing && !existing.startsWith("__OPENCLAW_")) return existing;
  }

  if (dryRun) return "dry-run-gateway-token";

  const doctor = await execCapture(
    "openclaw",
    ["doctor", "--repair", "--generate-gateway-token", "--non-interactive", "--yes"],
    { env, stream: true },
  );
  if (doctor.code !== 0) {
    throw new Error(`OpenClaw doctor failed while generating gateway token: ${doctor.stderr || doctor.stdout}`);
  }

  const getResult = await execCapture("openclaw", ["config", "get", "gateway.auth.token"], { env });
  const token = parseGatewayTokenOutput(getResult.stdout);
  if (token && !token.startsWith("__OPENCLAW_")) {
    return token;
  }

  const configToken = await readConfigToken();
  if (!configToken) {
    throw new Error("Unable to read gateway.auth.token from the OpenClaw install.");
  }
  return configToken;
}

async function createMergedAgentsBundle({ privateBundleDir, dryRun = false }) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "alquim-openclaw-agents-"));
  const publicDocsDir = path.join(PUBLIC_PROFILE_DIR, "docs");
  const publicAgentsDir = path.join(PUBLIC_PROFILE_DIR, "agents");
  const bundle = buildPrivateBundleLookup(privateBundleDir);

  const cleanup = async () => {
    await rm(tempRoot, { recursive: true, force: true });
  };

  if (dryRun) {
    return { rootDir: tempRoot, cleanup, usedPrivateBundle: false };
  }

  for (const docName of ["ORGANIZATION.md", "SKILLS.md"]) {
    const publicDoc = path.join(publicDocsDir, docName);
    if (await pathExists(publicDoc)) {
      await cp(publicDoc, path.join(tempRoot, docName), { force: true });
    }
  }

  const publicAgentSlugs = await stat(publicAgentsDir).then(() => true).catch(() => false);
  if (!publicAgentSlugs) {
    throw new Error(`Public agent profile missing: ${publicAgentsDir}`);
  }

  const publicEntries = await readdir(publicAgentsDir, { withFileTypes: true });
  for (const entry of publicEntries) {
    if (!entry.isDirectory()) continue;
    await cp(path.join(publicAgentsDir, entry.name), path.join(tempRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }

  let usedPrivateBundle = false;
  if (await pathExists(bundle.agentsDir)) {
    const privateEntries = await readdir(bundle.agentsDir, { withFileTypes: true });
    for (const entry of privateEntries) {
      if (!entry.isDirectory()) continue;
      await cp(path.join(bundle.agentsDir, entry.name), path.join(tempRoot, entry.name), {
        recursive: true,
        force: true,
      });
      usedPrivateBundle = true;
    }
  }
  if (await pathExists(bundle.docsDir)) {
    for (const docName of ["ORGANIZATION.md", "SKILLS.md"]) {
      const privateDoc = path.join(bundle.docsDir, docName);
      if (await pathExists(privateDoc)) {
        await cp(privateDoc, path.join(tempRoot, docName), { force: true });
        usedPrivateBundle = true;
      }
    }
  }

  return { rootDir: tempRoot, cleanup, usedPrivateBundle };
}

async function createMergedSkillsBundle({ privateBundleDir, openclawHome, dryRun = false }) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "alquim-openclaw-skills-"));
  const bundle = buildPrivateBundleLookup(privateBundleDir);

  const cleanup = async () => {
    await rm(tempRoot, { recursive: true, force: true });
  };

  if (dryRun) {
    return {
      rootDir: tempRoot,
      targetDir: path.join(openclawHome, "skills"),
      cleanup,
      usedPrivateBundle: false,
    };
  }

  if (await pathExists(PUBLIC_SKILLS_DIR)) {
    const publicEntries = await readdir(PUBLIC_SKILLS_DIR, { withFileTypes: true });
    for (const entry of publicEntries) {
      if (!entry.isDirectory()) continue;
      await cp(path.join(PUBLIC_SKILLS_DIR, entry.name), path.join(tempRoot, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }

  let usedPrivateBundle = false;
  if (await pathExists(bundle.skillsDir)) {
    const privateEntries = await readdir(bundle.skillsDir, { withFileTypes: true });
    for (const entry of privateEntries) {
      if (!entry.isDirectory()) continue;
      await cp(path.join(bundle.skillsDir, entry.name), path.join(tempRoot, entry.name), {
        recursive: true,
        force: true,
      });
      usedPrivateBundle = true;
    }
  }

  return {
    rootDir: tempRoot,
    targetDir: path.join(openclawHome, "skills"),
    cleanup,
    usedPrivateBundle,
  };
}

async function waitForHealth(url, timeoutMs = 180000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url.replace(/\/+$/, "")}/api/health`);
      if (response.ok) {
        const payload = await response.json();
        if (payload?.status === "ok") return payload;
      }
    } catch {
      // service still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Timed out waiting for Paperclip health at ${url}/api/health`);
}

async function ensurePaperclipRunning({
  apiUrl,
  paperclipHome,
  paperclipPort,
  openclawHome,
  statePaths,
  dryRun = false,
}) {
  try {
    await waitForHealth(apiUrl, 2500);
    return { action: "already-running", logPath: statePaths.paperclipLog };
  } catch {
    // boot it
  }

  await ensureDir(statePaths.logDir);
  if (dryRun) {
    return { action: "dry-run", logPath: statePaths.paperclipLog };
  }

  const outFd = spawnSync("bash", ["-lc", `mkdir -p ${shellQuote(path.dirname(statePaths.paperclipLog))}`], {
    cwd: REPO_ROOT,
  });
  if (outFd.status !== 0) {
    throw new Error("Unable to prepare Paperclip log directory");
  }

  const logHandle = await (await import("node:fs/promises")).open(statePaths.paperclipLog, "a");
  const child = spawn("pnpm", ["dev:once"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PAPERCLIP_MIGRATION_PROMPT: "never",
      PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
      ...(paperclipHome ? { PAPERCLIP_HOME: paperclipHome } : {}),
      ...(paperclipPort ? { PORT: String(paperclipPort) } : {}),
      ...(openclawHome ? { OPENCLAW_HOME: openclawHome } : {}),
    },
    detached: true,
    stdio: ["ignore", logHandle.fd, logHandle.fd],
  });
  child.unref();
  await writeFile(statePaths.pidFile, String(child.pid), "utf8");
  await waitForHealth(apiUrl, 180000);
  await logHandle.close();
  return { action: "started", logPath: statePaths.paperclipLog, pid: child.pid };
}

async function writePrivateConfig(privateConfigPath, config, dryRun = false) {
  if (dryRun) return;
  await ensureDir(path.dirname(privateConfigPath));
  await writeFile(privateConfigPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function runBootstrap({ privateConfigPath, companyName, dryRun = false }) {
  const args = ["scripts/bootstrap-alquim-ia.mjs", "--private-config", privateConfigPath];
  if (companyName?.trim()) {
    args.push("--company-name", companyName.trim());
  }
  if (dryRun) return { args };
  const privateConfig = JSON.parse(await readFile(privateConfigPath, "utf8"));
  if (privateConfig?.paperclip?.apiUrl) {
    args.push("--api-url", privateConfig.paperclip.apiUrl);
  }

  const result = await execCapture("node", args, { cwd: REPO_ROOT, stream: true });
  if (result.code !== 0) {
    throw new Error(`bootstrap:alquim-ia failed: ${result.stderr || result.stdout}`);
  }
  return { args };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  await checkPrerequisites();

  const openclawHome = ensureAbsoluteMaybeHome(args["openclaw-home"] ?? deriveOpenClawHome());
  const privateConfigPath = ensureAbsoluteMaybeHome(args["private-config"] ?? DEFAULT_PRIVATE_CONFIG);
  const privateBundleDir = ensureAbsoluteMaybeHome(args["private-bundle"] ?? DEFAULT_PRIVATE_BUNDLE_DIR);
  const companyName = args["company-name"] ?? "Alquim-IA";
  const openclawGatewayPort =
    args["openclaw-gateway-port"] !== undefined
      ? Number(args["openclaw-gateway-port"])
      : DEFAULT_OPENCLAW_GATEWAY_PORT;
  const defaultPaperclipPort = Number(new URL(DEFAULT_PAPERCLIP_API_URL).port || "3100");
  const paperclipPort =
    args["paperclip-port"] !== undefined ? Number(args["paperclip-port"]) : defaultPaperclipPort;
  const paperclipApiUrl = (
    args["paperclip-api-url"] ?? `http://127.0.0.1:${paperclipPort || 3100}`
  ).replace(/\/+$/, "");
  const paperclipPublicUrl = (args["paperclip-public-url"] ?? paperclipApiUrl).replace(/\/+$/, "");
  const paperclipHome = args["paperclip-data-dir"]
    ? ensureAbsoluteMaybeHome(args["paperclip-data-dir"])
    : null;
  const statePaths = buildSetupStatePaths({ paperclipHome, privateConfigPath });
  const dryRun = Boolean(args["dry-run"]);

  const providerSetup = await collectProviderSetup(args);
  providerSetup.skipDaemonInstall = Boolean(args["skip-openclaw-daemon"]);

  if (!args["skip-openclaw-install"] && !commandExists("openclaw")) {
    await installOrUpdateOpenClaw({ dryRun });
  } else if (!args["skip-openclaw-install"]) {
    const rl = !args.yes ? createPromptInterface() : null;
    try {
      const shouldUpdate = args.yes
        ? false
        : await promptConfirm(rl, "OpenClaw ya existe. ¿Quieres actualizarlo a la versión pública más reciente?", false);
      if (shouldUpdate) {
        await installOrUpdateOpenClaw({ dryRun });
      }
    } finally {
      rl?.close();
    }
  }
  if (!commandExists("openclaw") && !dryRun) {
    throw new Error("OpenClaw CLI is still unavailable after the install step.");
  }

  await ensurePnpmAvailable({ dryRun });
  await ensureRepoDependencies({ dryRun });

  if (!args["skip-openclaw-onboard"]) {
    await runOpenClawOnboard({ providerSetup, openclawHome, gatewayPort: openclawGatewayPort, dryRun });
  }

  const gatewayToken = await ensureGatewayToken({ openclawHome, dryRun });
  const mergedAgents = await createMergedAgentsBundle({ privateBundleDir, dryRun });
  const mergedSkills = await createMergedSkillsBundle({ privateBundleDir, openclawHome, dryRun });

  const privateConfig = buildBootstrapPrivateConfig({
    companyName,
    paperclipApiUrl,
    paperclipAgentReachableApiUrl: paperclipPublicUrl,
    gatewayUrl: `ws://127.0.0.1:${openclawGatewayPort}`,
    gatewayToken,
    agentsSourceDir: mergedAgents.rootDir,
    installAgentsDir: path.join(openclawHome, "agents"),
    claimsDir: path.join(openclawHome, ".openclaw", "workspace", "claims"),
    skillsSourceDir: mergedSkills.rootDir,
    installSkillsDir: mergedSkills.targetDir,
  });

  await writePrivateConfig(privateConfigPath, privateConfig, dryRun);

  try {
    if (!args["skip-paperclip-start"]) {
      await ensurePaperclipRunning({
        apiUrl: paperclipApiUrl,
        paperclipHome,
        paperclipPort,
        openclawHome,
        statePaths,
        dryRun,
      });
    }

    if (!args["skip-bootstrap"]) {
      await runBootstrap({ privateConfigPath, companyName, dryRun });
    }
  } finally {
    await mergedAgents.cleanup();
    await mergedSkills.cleanup();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        companyName,
        openclawHome,
        privateConfigPath,
        privateBundleDir,
        paperclipApiUrl,
        paperclipPublicUrl,
        paperclipHome,
        provider: providerSetup.provider.id,
        installedPublicSkillsFrom: PUBLIC_SKILLS_DIR,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const err = toError(error);
  console.error(err.stack ?? err.message);
  process.exit(1);
});
