import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOracleHealthDashboardDir } from "../routes/oracle-health-dashboard.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.PAPERCLIP_ORACLE_HEALTH_DASHBOARD_DIR;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("oracle health dashboard route helpers", () => {
  it("prefers a configured dashboard directory", () => {
    const dir = makeTempDir("oracle-dashboard-env-");
    writeFileSync(path.join(dir, "latest.html"), "<html></html>", "utf8");
    process.env.PAPERCLIP_ORACLE_HEALTH_DASHBOARD_DIR = dir;

    expect(resolveOracleHealthDashboardDir("/does/not/matter")).toBe(dir);
  });

  it("falls back to ../ops/dashboard from a server cwd", () => {
    const repoDir = makeTempDir("oracle-dashboard-repo-");
    const serverDir = path.join(repoDir, "server");
    const dashboardDir = path.join(repoDir, "ops", "dashboard");
    mkdirSync(serverDir, { recursive: true });
    mkdirSync(dashboardDir, { recursive: true });
    writeFileSync(path.join(dashboardDir, "latest.json"), "{}", "utf8");

    expect(resolveOracleHealthDashboardDir(serverDir)).toBe(dashboardDir);
  });
});
