import { existsSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { assertCompanyAccess } from "./authz.js";

export function resolveOracleHealthDashboardDir(cwd = process.cwd()): string {
  const configured = process.env.PAPERCLIP_ORACLE_HEALTH_DASHBOARD_DIR?.trim();
  const candidates = [
    configured || null,
    path.resolve(cwd, "ops/dashboard"),
    path.resolve(cwd, "../ops/dashboard"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "latest.html")) || existsSync(path.join(candidate, "latest.json"))) {
      return candidate;
    }
  }

  return candidates[0]!;
}

export function oracleHealthDashboardRoutes() {
  const router = Router();

  router.get("/companies/:companyId/oracle-health-dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const dashboardDir = resolveOracleHealthDashboardDir();
    const htmlPath = path.join(dashboardDir, "latest.html");
    if (!existsSync(htmlPath)) {
      res.status(404).json({ error: "Oracle health dashboard not found" });
      return;
    }

    res.sendFile(htmlPath);
  });

  router.get("/companies/:companyId/oracle-health-dashboard.json", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const dashboardDir = resolveOracleHealthDashboardDir();
    const jsonPath = path.join(dashboardDir, "latest.json");
    if (!existsSync(jsonPath)) {
      res.status(404).json({ error: "Oracle health dashboard not found" });
      return;
    }

    res.sendFile(jsonPath);
  });

  return router;
}
