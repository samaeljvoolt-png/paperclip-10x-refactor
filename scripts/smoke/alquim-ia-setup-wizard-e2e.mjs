#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const REPO_ROOT = "/Users/tomasvallejo/Desktop/paperclip";
const SETUP_SCRIPT = path.join(REPO_ROOT, "scripts", "setup-alquim-ia.mjs");

function usage() {
  console.log(`Usage: node scripts/smoke/alquim-ia-setup-wizard-e2e.mjs [options]

Options:
  --provider <id>               Model provider for the wizard (default: deepseek)
  --api-key <key>               Provider API key (default from env)
  --keep-temp                   Keep the temporary installation directory
  --skip-openclaw-install       Pass through to the setup wizard
  --timeout-ms <ms>             End-to-end timeout (default: 300000)

Env fallbacks:
  DEEPSEEK_API_KEY
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function resolveApiKey(provider, explicit) {
  if (explicit) return explicit;
  if (provider === "deepseek") return process.env.DEEPSEEK_API_KEY?.trim();
  if (provider === "openai") return process.env.OPENAI_API_KEY?.trim();
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY?.trim();
  return process.env.DEEPSEEK_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim() ?? process.env.ANTHROPIC_API_KEY?.trim();
}

async function run(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (options.stream) process.stdout.write(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (options.stream) process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr, child }));
  });
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function waitForHealth(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const payload = await fetchJson(`${baseUrl}/api/health`);
      if (payload?.status === "ok") return payload;
    } catch {
      // service still booting
    }
    await delay(1500);
  }
  throw new Error(`Timed out waiting for health at ${baseUrl}/api/health`);
}

async function startGateway(openclawHome, port) {
  const openclawConfig = JSON.parse(
    await readFile(path.join(openclawHome, ".openclaw", "openclaw.json"), "utf8"),
  );
  const token = openclawConfig?.gateway?.auth?.token;
  if (!token) throw new Error("OpenClaw gateway token not found after setup");

  const child = spawn(
    "openclaw",
    ["gateway", "run", "--allow-unconfigured", "--port", String(port), "--bind", "loopback", "--auth", "token", "--token", token],
    {
      env: {
        ...process.env,
        OPENCLAW_HOME: openclawHome,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stderr = "";
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const start = Date.now();
  while (Date.now() - start < 20000) {
    if (stdout.includes("listening on ws://127.0.0.1:")) {
      return child;
    }
    if (child.exitCode !== null) {
      throw new Error(`Gateway exited early: ${stderr || stdout}`);
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for OpenClaw gateway to bind. Output:\n${stdout}\n${stderr}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const provider = String(args.provider ?? "deepseek");
  const apiKey = resolveApiKey(provider, typeof args["api-key"] === "string" ? args["api-key"] : "");
  if (!apiKey) {
    throw new Error(`Missing API key for provider ${provider}. Pass --api-key or set the matching env var.`);
  }

  const timeoutMs = Number(args["timeout-ms"] ?? 300000);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "alquim-setup-smoke-"));
  const paperclipPort = 3410;
  const gatewayPort = 19810;
  const companyName = `Alquim-IA Smoke ${Date.now()}`;
  const paperclipBase = `http://127.0.0.1:${paperclipPort}`;
  const privateConfigPath = path.join(tmpRoot, "private.json");
  const openclawHome = path.join(tmpRoot, "openclaw");
  const paperclipHome = path.join(tmpRoot, "paperclip");
  const requestedPath = path.join(tmpRoot, "deliverables", "single-owner-runbook.md");
  let gatewayChild = null;
  let heartbeatChild = null;

  const cleanup = async () => {
    heartbeatChild?.kill("SIGINT");
    gatewayChild?.kill("SIGINT");
    await delay(1000);
    heartbeatChild?.kill("SIGKILL");
    gatewayChild?.kill("SIGKILL");
    await run("bash", ["-lc", `lsof -tiTCP:${paperclipPort} -sTCP:LISTEN | xargs -r kill -9 || true`]);
    await run("bash", ["-lc", `lsof -tiTCP:${gatewayPort} -sTCP:LISTEN | xargs -r kill -9 || true`]);
    if (!args["keep-temp"]) {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  };

  try {
    const setupArgs = [
      SETUP_SCRIPT,
      "--yes",
      "--provider",
      provider,
      "--api-key",
      apiKey,
      "--private-config",
      privateConfigPath,
      "--paperclip-port",
      String(paperclipPort),
      "--paperclip-data-dir",
      paperclipHome,
      "--openclaw-home",
      openclawHome,
      "--openclaw-gateway-port",
      String(gatewayPort),
      "--skip-openclaw-daemon",
      "--company-name",
      companyName,
    ];
    if (args["skip-openclaw-install"]) {
      setupArgs.push("--skip-openclaw-install");
    }

    const setup = await run("node", setupArgs, { cwd: REPO_ROOT, stream: true });
    if (setup.code !== 0) {
      throw new Error(`Setup wizard failed:\n${setup.stderr || setup.stdout}`);
    }

    await waitForHealth(paperclipBase, timeoutMs);
    gatewayChild = await startGateway(openclawHome, gatewayPort);

    const companies = await fetchJson(`${paperclipBase}/api/companies`);
    const company = companies.find((entry) => entry.name === companyName);
    if (!company) throw new Error(`Bootstrapped company not found: ${companyName}`);

    const agents = await fetchJson(`${paperclipBase}/api/companies/${company.id}/agents`);
    const sammy = agents.find((entry) => entry.name === "Sammy");
    if (!sammy) throw new Error("Sammy agent not found after bootstrap");

    await mkdir(path.dirname(requestedPath), { recursive: true });
    const issue = await fetchJson(`${paperclipBase}/api/companies/${company.id}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: "Strict single-owner runbook smoke",
        description:
          `Single-owner execution. Write a short operational runbook in English. ` +
          `Save the file exactly at ${requestedPath}. ` +
          `Then register a document work product with provider=openclaw, ` +
          `a readable title, and metadata.path set to that same absolute path. ` +
          `Add a short summary comment in English and mark the issue as done.`,
        status: "todo",
        assigneeAgentId: sammy.id,
        priority: "medium",
      }),
    });

    heartbeatChild = spawn(
      "pnpm",
      [
        "-C",
        REPO_ROOT,
        "paperclipai",
        "heartbeat",
        "run",
        "-a",
        sammy.id,
        "--api-base",
        paperclipBase,
        "--source",
        "assignment",
        "--trigger",
        "manual",
        "--timeout-ms",
        "180000",
        "--json",
      ],
      {
        env: {
          ...process.env,
          OPENCLAW_HOME: openclawHome,
          PAPERCLIP_HOME: paperclipHome,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let heartbeatOutput = "";
    heartbeatChild.stdout.on("data", (chunk) => {
      heartbeatOutput += String(chunk);
    });
    heartbeatChild.stderr.on("data", (chunk) => {
      heartbeatOutput += String(chunk);
    });

    const startedAt = Date.now();
    let finalIssue = null;
    while (Date.now() - startedAt < timeoutMs) {
      finalIssue = await fetchJson(`${paperclipBase}/api/issues/${issue.id}`);
      if (finalIssue.status === "done") break;
      if (finalIssue.status === "blocked" || finalIssue.status === "canceled") {
        throw new Error(`Issue ended in unexpected status ${finalIssue.status}`);
      }
      await delay(2000);
    }

    if (!finalIssue || finalIssue.status !== "done") {
      throw new Error(`Smoke issue did not reach done within timeout. Heartbeat output:\n${heartbeatOutput}`);
    }

    const comments = await fetchJson(`${paperclipBase}/api/issues/${issue.id}/comments`);
    const matchingWorkProduct = (finalIssue.workProducts ?? []).find(
      (entry) => entry.metadata?.path === requestedPath,
    );
    if (!matchingWorkProduct) {
      throw new Error(
        `Expected a work product at ${requestedPath}, got ${JSON.stringify(finalIssue.workProducts ?? [], null, 2)}`,
      );
    }

    const artifactContent = await readFile(requestedPath, "utf8");
    console.log(
      JSON.stringify(
        {
          ok: true,
          tmpRoot,
          companyId: company.id,
          issueId: issue.id,
          issueIdentifier: finalIssue.identifier,
          issueStatus: finalIssue.status,
          requestedPath,
          workProductId: matchingWorkProduct.id,
          comments: comments.length,
          artifactPreview: artifactContent.slice(0, 600),
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
