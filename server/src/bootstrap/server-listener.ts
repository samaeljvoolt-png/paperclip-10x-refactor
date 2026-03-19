import type { Server } from "node:http";
import { getBoardClaimWarningUrl } from "../board-claim.js";
import { logger } from "../middleware/logger.js";
import { printStartupBanner } from "../startup-banner.js";

type StartupBannerOptions = Parameters<typeof printStartupBanner>[0];

type ServerListenerDeps = {
  logger?: Pick<typeof logger, "info" | "warn">;
  openFn?: (url: string) => Promise<void>;
};

export async function startServerListener(
  input: {
    server: Server;
    host: string;
    listenPort: number;
    requestedPort: number;
    deploymentMode: StartupBannerOptions["deploymentMode"];
    deploymentExposure: StartupBannerOptions["deploymentExposure"];
    authReady: boolean;
    uiMode: StartupBannerOptions["uiMode"];
    db: StartupBannerOptions["db"];
    migrationSummary: StartupBannerOptions["migrationSummary"];
    heartbeatSchedulerEnabled: boolean;
    heartbeatSchedulerIntervalMs: number;
    databaseBackupEnabled: boolean;
    databaseBackupIntervalMinutes: number;
    databaseBackupRetentionDays: number;
    databaseBackupDir: string;
  },
  deps: ServerListenerDeps = {},
): Promise<void> {
  const log = deps.logger ?? logger;

  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (err: Error) => {
      input.server.off("error", onError);
      rejectListen(err);
    };

    input.server.once("error", onError);
    input.server.listen(input.listenPort, input.host, () => {
      input.server.off("error", onError);
      log.info(`Server listening on ${input.host}:${input.listenPort}`);
      if (process.env.PAPERCLIP_OPEN_ON_LISTEN === "true") {
        const openHost = input.host === "0.0.0.0" || input.host === "::" ? "127.0.0.1" : input.host;
        const url = `http://${openHost}:${input.listenPort}`;
        const openFn =
          deps.openFn ??
          (async (openUrl: string) => import("open").then((mod) => mod.default(openUrl)));
        void openFn(url)
          .then(() => {
            log.info(`Opened browser at ${url}`);
          })
          .catch((err) => {
            log.warn({ err, url }, "Failed to open browser on startup");
          });
      }
      printStartupBanner({
        host: input.host,
        deploymentMode: input.deploymentMode,
        deploymentExposure: input.deploymentExposure,
        authReady: input.authReady,
        requestedPort: input.requestedPort,
        listenPort: input.listenPort,
        uiMode: input.uiMode,
        db: input.db,
        migrationSummary: input.migrationSummary,
        heartbeatSchedulerEnabled: input.heartbeatSchedulerEnabled,
        heartbeatSchedulerIntervalMs: input.heartbeatSchedulerIntervalMs,
        databaseBackupEnabled: input.databaseBackupEnabled,
        databaseBackupIntervalMinutes: input.databaseBackupIntervalMinutes,
        databaseBackupRetentionDays: input.databaseBackupRetentionDays,
        databaseBackupDir: input.databaseBackupDir,
      });

      const boardClaimUrl = getBoardClaimWarningUrl(input.host, input.listenPort);
      if (boardClaimUrl) {
        const red = "\x1b[41m\x1b[30m";
        const yellow = "\x1b[33m";
        const reset = "\x1b[0m";
        console.log(
          [
            `${red}  BOARD CLAIM REQUIRED  ${reset}`,
            `${yellow}This instance was previously local_trusted and still has local-board as the only admin.${reset}`,
            `${yellow}Sign in with a real user and open this one-time URL to claim ownership:${reset}`,
            `${yellow}${boardClaimUrl}${reset}`,
            `${yellow}If you are connecting over Tailscale, replace the host in this URL with your Tailscale IP/MagicDNS name.${reset}`,
          ].join("\n"),
        );
      }

      resolveListen();
    });
  });
}
