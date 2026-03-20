#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const apiBase = process.env.API_BASE ?? "http://127.0.0.1:3100";
const companyId = process.env.COMPANY_ID ?? "05100f6d-b0a4-4a15-b785-61949b90c6df";
const repoDir = process.env.REPO_DIR ?? process.cwd();
const dashboardDir = process.env.DASHBOARD_DIR ?? path.join(repoDir, "ops", "dashboard");
const watchdogDir = process.env.WATCHDOG_DIR ?? path.join(repoDir, "ops", "watchdog");
const now = new Date();
const timestamp = now.toISOString();

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

function ageMinutes(isoString) {
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) return null;
  return Math.round((Date.now() - parsed) / 60000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizeIssues(issues) {
  const counts = new Map();
  for (const issue of issues) {
    counts.set(issue.status, (counts.get(issue.status) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function recentIssues(issues, predicate, limit = 12) {
  return issues
    .filter(predicate)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit)
    .map((issue) => ({
      identifier: issue.identifier,
      title: issue.title,
      status: issue.status,
      assigneeAgentId: issue.assigneeAgentId,
      executionRunId: issue.executionRunId,
      parentId: issue.parentId,
      updatedAt: issue.updatedAt,
      ageMinutes: ageMinutes(issue.updatedAt),
    }));
}

async function latestWatchdogLogSummary() {
  try {
    const files = (await fs.readdir(watchdogDir))
      .filter((file) => file.endsWith(".log"))
      .sort()
      .reverse();
    const latest = files[0];
    if (!latest) return null;
    const logPath = path.join(watchdogDir, latest);
    const raw = await fs.readFile(logPath, "utf8");
    const lines = raw.trim().split("\n");
    const tail = lines.slice(-20);
    const passedLine = tail.find((line) => line.includes("Test Files"));
    const complete = tail.some((line) => line.includes("watchdog complete"));
    return {
      file: latest,
      complete,
      tail,
      passedLine: passedLine ?? null,
    };
  } catch {
    return null;
  }
}

function renderTable(rows, columns) {
  const head = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(row[column.key] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="' + columns.length + '">No rows</td></tr>'}</tbody></table>`;
}

async function main() {
  await fs.mkdir(dashboardDir, { recursive: true });

  const [health, issues] = await Promise.all([
    getJson(`${apiBase}/api/health`),
    getJson(`${apiBase}/api/companies/${companyId}/issues?limit=250`),
  ]);

  const statusCounts = summarizeIssues(issues);
  const activeIssues = recentIssues(
    issues,
    (issue) =>
      issue.status === "in_progress" ||
      issue.status === "blocked" ||
      issue.executionRunId != null,
  );
  const blockedIssues = recentIssues(issues, (issue) => issue.status === "blocked");
  const staleInProgress = recentIssues(
    issues,
    (issue) =>
      issue.status === "in_progress" &&
      issue.executionRunId == null &&
      (ageMinutes(issue.updatedAt) ?? 0) >= 30,
  );
  const queuedWithRunId = recentIssues(
    issues,
    (issue) => issue.status === "todo" && issue.executionRunId != null,
  );
  const watchdog = await latestWatchdogLogSummary();

  const summary = {
    generatedAt: timestamp,
    apiBase,
    companyId,
    health,
    totalIssues: issues.length,
    statusCounts,
    activeIssueCount: activeIssues.length,
    blockedIssueCount: blockedIssues.length,
    staleInProgressCount: staleInProgress.length,
    queuedWithRunIdCount: queuedWithRunId.length,
    watchdog,
  };

  const jsonPath = path.join(dashboardDir, "latest.json");
  const htmlPath = path.join(dashboardDir, "latest.html");

  await fs.writeFile(jsonPath, JSON.stringify({ summary, activeIssues, blockedIssues, staleInProgress, queuedWithRunId }, null, 2));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Paperclip Oracle Health Dashboard</title>
  <style>
    :root {
      --bg: #09111f;
      --panel: #111c31;
      --panel-alt: #15233d;
      --text: #edf3ff;
      --muted: #9fb0cf;
      --ok: #3ddc97;
      --warn: #ffbf69;
      --bad: #ff6b6b;
      --line: #233252;
      --accent: #79b8ff;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(180deg, #08101d 0%, #0d1730 100%); color: var(--text); }
    .wrap { max-width: 1280px; margin: 0 auto; padding: 32px 20px 48px; }
    h1, h2 { margin: 0 0 12px; }
    p, li { color: var(--muted); }
    .meta { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0 24px; }
    .chip { border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--text); border-radius: 999px; padding: 8px 12px; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
    .card strong { display: block; font-size: 28px; margin-top: 4px; }
    .section { margin-top: 18px; background: var(--panel-alt); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }
    .status-ok { color: var(--ok); }
    .status-warn { color: var(--warn); }
    .status-bad { color: var(--bad); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--accent); font-weight: 700; }
    pre { white-space: pre-wrap; background: #09111f; border: 1px solid var(--line); border-radius: 14px; padding: 14px; color: #dce8ff; overflow: auto; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    @media (max-width: 960px) { .grid, .two { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Paperclip Oracle Health Dashboard</h1>
    <p>Operational snapshot for the live company. Generated automatically from the Oracle instance and watchdog output.</p>
    <div class="meta">
      <div class="chip">Generated: ${escapeHtml(timestamp)}</div>
      <div class="chip">API: ${escapeHtml(apiBase)}</div>
      <div class="chip">Company: ${escapeHtml(companyId)}</div>
      <div class="chip ${health.status === "ok" ? "status-ok" : "status-bad"}">Health: ${escapeHtml(health.status)}</div>
      <div class="chip">Mode: ${escapeHtml(health.deploymentMode ?? "unknown")}</div>
      <div class="chip">Bootstrap: ${escapeHtml(health.bootstrapStatus ?? "unknown")}</div>
    </div>

    <div class="grid">
      <div class="card"><span>Total issues</span><strong>${issues.length}</strong></div>
      <div class="card"><span>Active / blocked / with run</span><strong>${activeIssues.length}</strong></div>
      <div class="card"><span>Blocked issues</span><strong class="${blockedIssues.length ? "status-warn" : "status-ok"}">${blockedIssues.length}</strong></div>
      <div class="card"><span>Stale in progress (30m+)</span><strong class="${staleInProgress.length ? "status-bad" : "status-ok"}">${staleInProgress.length}</strong></div>
    </div>

    <div class="section">
      <h2>Status Distribution</h2>
      <pre>${escapeHtml(JSON.stringify(statusCounts, null, 2))}</pre>
    </div>

    <div class="two">
      <div class="section">
        <h2>Active Issues</h2>
        ${renderTable(activeIssues, [
          { key: "identifier", label: "Issue" },
          { key: "status", label: "Status" },
          { key: "ageMinutes", label: "Age (m)" },
          { key: "executionRunId", label: "Run" },
        ])}
      </div>
      <div class="section">
        <h2>Queued With Run ID</h2>
        ${renderTable(queuedWithRunId, [
          { key: "identifier", label: "Issue" },
          { key: "status", label: "Status" },
          { key: "ageMinutes", label: "Age (m)" },
          { key: "executionRunId", label: "Run" },
        ])}
      </div>
    </div>

    <div class="two">
      <div class="section">
        <h2>Blocked Issues</h2>
        ${renderTable(blockedIssues, [
          { key: "identifier", label: "Issue" },
          { key: "title", label: "Title" },
          { key: "ageMinutes", label: "Age (m)" },
        ])}
      </div>
      <div class="section">
        <h2>Stale In Progress</h2>
        ${renderTable(staleInProgress, [
          { key: "identifier", label: "Issue" },
          { key: "title", label: "Title" },
          { key: "ageMinutes", label: "Age (m)" },
        ])}
      </div>
    </div>

    <div class="section">
      <h2>Watchdog</h2>
      <p>Latest watchdog log: ${escapeHtml(watchdog?.file ?? "none")}</p>
      <p class="${watchdog?.complete ? "status-ok" : "status-warn"}">Complete: ${escapeHtml(String(watchdog?.complete ?? false))}</p>
      <pre>${escapeHtml((watchdog?.tail ?? ["No watchdog log available"]).join("\n"))}</pre>
    </div>
  </div>
</body>
</html>`;

  await fs.writeFile(htmlPath, html);
  console.log(JSON.stringify({ htmlPath, jsonPath, generatedAt: timestamp }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
