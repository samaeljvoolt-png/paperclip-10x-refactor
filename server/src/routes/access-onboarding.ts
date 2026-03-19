import { createHash, generateKeyPairSync } from "node:crypto";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, invites, joinRequests } from "@paperclipai/db";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import { PERMISSION_KEYS } from "@paperclipai/shared";
import type { JoinDiagnostic } from "./access-types.js";
import { buildPublicUrl, requestBaseUrl } from "../utils/public-url.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHostname(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end > 1 ? trimmed.slice(1, end).toLowerCase() : trimmed.toLowerCase();
  }
  const firstColon = trimmed.indexOf(":");
  if (firstColon > -1) return trimmed.slice(0, firstColon).toLowerCase();
  return trimmed.toLowerCase();
}

function isLoopbackHost(hostname: string): boolean {
  const value = hostname.trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function extractInviteMessage(invite: typeof invites.$inferSelect): string | null {
  const rawDefaults = invite.defaultsPayload;
  if (!rawDefaults || typeof rawDefaults !== "object" || Array.isArray(rawDefaults)) {
    return null;
  }
  const rawMessage = (rawDefaults as Record<string, unknown>).agentMessage;
  if (typeof rawMessage !== "string") return null;
  const trimmed = rawMessage.trim();
  return trimmed.length ? trimmed : null;
}

export function toInviteSummaryResponse(req: Request, token: string, invite: typeof invites.$inferSelect) {
  const onboardingPath = `/api/invites/${token}/onboarding`;
  const onboardingTextPath = `/api/invites/${token}/onboarding.txt`;
  const inviteMessage = extractInviteMessage(invite);
  return {
    id: invite.id,
    companyId: invite.companyId,
    inviteType: invite.inviteType,
    allowedJoinTypes: invite.allowedJoinTypes,
    expiresAt: invite.expiresAt,
    onboardingPath,
    onboardingUrl: buildPublicUrl(onboardingPath, req),
    onboardingTextPath,
    onboardingTextUrl: buildPublicUrl(onboardingTextPath, req),
    skillIndexPath: "/api/skills/index",
    skillIndexUrl: buildPublicUrl("/api/skills/index", req),
    inviteMessage,
  };
}

function normalizeHeaderValue(value: unknown, depth = 0): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!isPlainObject(value) || depth >= 3) return null;

  const candidateKeys = [
    "value",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "auth",
    "authToken",
    "auth_token",
    "accessToken",
    "access_token",
    "authorization",
    "bearer",
    "header",
    "raw",
    "text",
    "string",
  ];
  for (const key of candidateKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const normalized = normalizeHeaderValue((value as Record<string, unknown>)[key], depth + 1);
    if (normalized) return normalized;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 1) {
    const [singleKey, singleValue] = entries[0];
    const normalizedKey = singleKey.trim().toLowerCase();
    if (normalizedKey !== "type" && normalizedKey !== "version" && normalizedKey !== "secretid" && normalizedKey !== "secret_id") {
      const normalized = normalizeHeaderValue(singleValue, depth + 1);
      if (normalized) return normalized;
    }
  }

  return null;
}

function extractHeaderEntries(input: unknown): Array<[string, unknown]> {
  if (isPlainObject(input)) return Object.entries(input);
  if (!Array.isArray(input)) return [];

  const entries: Array<[string, unknown]> = [];
  for (const item of input) {
    if (Array.isArray(item)) {
      const key = nonEmptyTrimmedString(item[0]);
      if (!key) continue;
      entries.push([key, item[1]]);
      continue;
    }
    if (!isPlainObject(item)) continue;

    const mapped = item as Record<string, unknown>;
    const explicitKey =
      nonEmptyTrimmedString(mapped.key) ??
      nonEmptyTrimmedString(mapped.name) ??
      nonEmptyTrimmedString(mapped.header);
    if (explicitKey) {
      const explicitValue = Object.prototype.hasOwnProperty.call(mapped, "value")
        ? mapped.value
        : Object.prototype.hasOwnProperty.call(mapped, "token")
          ? mapped.token
          : Object.prototype.hasOwnProperty.call(mapped, "secret")
            ? mapped.secret
            : mapped;
      entries.push([explicitKey, explicitValue]);
      continue;
    }

    const singleEntry = Object.entries(mapped);
    if (singleEntry.length === 1) {
      entries.push(singleEntry[0] as [string, unknown]);
    }
  }

  return entries;
}

function normalizeHeaderMap(input: unknown): Record<string, string> | undefined {
  const entries = extractHeaderEntries(input);
  if (entries.length === 0) return undefined;

  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    const normalizedValue = normalizeHeaderValue(value);
    if (!normalizedValue) continue;
    const trimmedKey = key.trim();
    const trimmedValue = normalizedValue.trim();
    if (!trimmedKey || !trimmedValue) continue;
    out[trimmedKey] = trimmedValue;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function headerMapHasKeyIgnoreCase(headers: Record<string, string>, targetKey: string): boolean {
  const normalizedTarget = targetKey.trim().toLowerCase();
  return Object.keys(headers).some((key) => key.trim().toLowerCase() === normalizedTarget);
}

function headerMapGetIgnoreCase(headers: Record<string, string>, targetKey: string): string | null {
  const normalizedTarget = targetKey.trim().toLowerCase();
  const key = Object.keys(headers).find((candidate) => candidate.trim().toLowerCase() === normalizedTarget);
  if (!key) return null;
  const value = headers[key];
  return typeof value === "string" ? value : null;
}

function tokenFromAuthorizationHeader(rawHeader: string | null): string | null {
  const trimmed = nonEmptyTrimmedString(rawHeader);
  if (!trimmed) return null;
  const bearerMatch = trimmed.match(/^bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) {
    return nonEmptyTrimmedString(bearerMatch[1]);
  }
  return trimmed;
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function generateEd25519PrivateKeyPem(): string {
  const generated = generateKeyPairSync("ed25519");
  return generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function summarizeSecretForLog(value: unknown): { present: true; length: number; sha256Prefix: string } | null {
  const trimmed = nonEmptyTrimmedString(value);
  if (!trimmed) return null;
  return {
    present: true,
    length: trimmed.length,
    sha256Prefix: hashToken(trimmed).slice(0, 12),
  };
}

export function summarizeOpenClawGatewayDefaultsForLog(defaultsPayload: unknown) {
  const defaults = isPlainObject(defaultsPayload) ? (defaultsPayload as Record<string, unknown>) : null;
  const headers = defaults ? normalizeHeaderMap(defaults.headers) : undefined;
  const gatewayTokenValue = headers
    ? headerMapGetIgnoreCase(headers, "x-openclaw-token") ??
      headerMapGetIgnoreCase(headers, "x-openclaw-auth") ??
      tokenFromAuthorizationHeader(headerMapGetIgnoreCase(headers, "authorization"))
    : null;
  return {
    present: Boolean(defaults),
    keys: defaults ? Object.keys(defaults).sort() : [],
    url: defaults ? nonEmptyTrimmedString(defaults.url) : null,
    paperclipApiUrl: defaults ? nonEmptyTrimmedString(defaults.paperclipApiUrl) : null,
    headerKeys: headers ? Object.keys(headers).sort() : [],
    sessionKeyStrategy: defaults ? nonEmptyTrimmedString(defaults.sessionKeyStrategy) : null,
    disableDeviceAuth: defaults ? parseBooleanLike(defaults.disableDeviceAuth) : null,
    waitTimeoutMs: defaults && typeof defaults.waitTimeoutMs === "number" ? defaults.waitTimeoutMs : null,
    devicePrivateKeyPem: defaults ? summarizeSecretForLog(defaults.devicePrivateKeyPem) : null,
    gatewayToken: summarizeSecretForLog(gatewayTokenValue),
  };
}

function buildOnboardingDiscoveryDiagnostics(input: {
  apiBaseUrl: string;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  bindHost: string;
  allowedHostnames: string[];
}): JoinDiagnostic[] {
  const diagnostics: JoinDiagnostic[] = [];
  let apiHost: string | null = null;
  if (input.apiBaseUrl) {
    try {
      apiHost = normalizeHostname(new URL(input.apiBaseUrl).hostname);
    } catch {
      apiHost = null;
    }
  }

  const bindHost = normalizeHostname(input.bindHost);
  const allowSet = new Set(
    input.allowedHostnames.map((entry) => normalizeHostname(entry)).filter((entry): entry is string => Boolean(entry)),
  );

  if (apiHost && isLoopbackHost(apiHost)) {
    diagnostics.push({
      code: "openclaw_onboarding_api_loopback",
      level: "warn",
      message:
        "Onboarding URL resolves to loopback hostname. Remote OpenClaw agents cannot reach localhost on your Paperclip host.",
      hint: "Use a reachable hostname/IP (for example Tailscale hostname, Docker host alias, or public domain).",
    });
  }

  if (
    input.deploymentMode === "authenticated" &&
    input.deploymentExposure === "private" &&
    (!bindHost || isLoopbackHost(bindHost))
  ) {
    diagnostics.push({
      code: "openclaw_onboarding_private_loopback_bind",
      level: "warn",
      message: "Paperclip is bound to loopback in authenticated/private mode.",
      hint: "Run with a reachable bind host or use pnpm dev --tailscale-auth for private-network onboarding.",
    });
  }

  if (
    input.deploymentMode === "authenticated" &&
    input.deploymentExposure === "private" &&
    apiHost &&
    !isLoopbackHost(apiHost) &&
    allowSet.size > 0 &&
    !allowSet.has(apiHost)
  ) {
    diagnostics.push({
      code: "openclaw_onboarding_private_host_not_allowed",
      level: "warn",
      message: `Onboarding host "${apiHost}" is not in allowed hostnames for authenticated/private mode.`,
      hint: `Run pnpm paperclipai allowed-hostname ${apiHost}`,
    });
  }

  return diagnostics;
}

function buildOnboardingConnectionCandidates(input: {
  apiBaseUrl: string;
  bindHost: string;
  allowedHostnames: string[];
}): string[] {
  const candidates = new Set<string>();
  if (input.apiBaseUrl) candidates.add(input.apiBaseUrl);
  if (input.bindHost && input.bindHost !== "0.0.0.0") {
    candidates.add(`http://${input.bindHost}:3100`);
  }
  for (const host of input.allowedHostnames) {
    candidates.add(`http://${host}:3100`);
  }
  return [...candidates].filter(Boolean);
}

export function buildJoinDefaultsPayloadForAccept(input: {
  adapterType: string | null;
  defaultsPayload: unknown;
  paperclipApiUrl?: unknown;
  inboundOpenClawAuthHeader?: string | null;
  inboundOpenClawTokenHeader?: string | null;
}): unknown {
  if (input.adapterType !== "openclaw_gateway") {
    return input.defaultsPayload;
  }

  const merged = isPlainObject(input.defaultsPayload)
    ? { ...(input.defaultsPayload as Record<string, unknown>) }
    : ({} as Record<string, unknown>);

  if (!nonEmptyTrimmedString(merged.paperclipApiUrl)) {
    const legacyPaperclipApiUrl = nonEmptyTrimmedString(input.paperclipApiUrl);
    if (legacyPaperclipApiUrl) merged.paperclipApiUrl = legacyPaperclipApiUrl;
  }
  const mergedHeaders = normalizeHeaderMap(merged.headers) ?? {};

  const inboundOpenClawAuthHeader = nonEmptyTrimmedString(input.inboundOpenClawAuthHeader);
  const inboundOpenClawTokenHeader = nonEmptyTrimmedString(input.inboundOpenClawTokenHeader);
  if (inboundOpenClawTokenHeader && !headerMapHasKeyIgnoreCase(mergedHeaders, "x-openclaw-token")) {
    mergedHeaders["x-openclaw-token"] = inboundOpenClawTokenHeader;
  }
  if (inboundOpenClawAuthHeader && !headerMapHasKeyIgnoreCase(mergedHeaders, "x-openclaw-auth")) {
    mergedHeaders["x-openclaw-auth"] = inboundOpenClawAuthHeader;
  }

  if (Object.keys(mergedHeaders).length > 0) {
    merged.headers = mergedHeaders;
  } else {
    delete merged.headers;
  }

  const discoveredToken =
    headerMapGetIgnoreCase(mergedHeaders, "x-openclaw-token") ??
    headerMapGetIgnoreCase(mergedHeaders, "x-openclaw-auth") ??
    tokenFromAuthorizationHeader(headerMapGetIgnoreCase(mergedHeaders, "authorization"));
  if (discoveredToken && !headerMapHasKeyIgnoreCase(mergedHeaders, "x-openclaw-token")) {
    mergedHeaders["x-openclaw-token"] = discoveredToken;
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

export function mergeJoinDefaultsPayloadForReplay(existingDefaultsPayload: unknown, nextDefaultsPayload: unknown): unknown {
  if (!isPlainObject(existingDefaultsPayload) && !isPlainObject(nextDefaultsPayload)) {
    return nextDefaultsPayload ?? existingDefaultsPayload;
  }
  if (!isPlainObject(existingDefaultsPayload)) return nextDefaultsPayload;
  if (!isPlainObject(nextDefaultsPayload)) return existingDefaultsPayload;

  const merged: Record<string, unknown> = {
    ...(existingDefaultsPayload as Record<string, unknown>),
    ...(nextDefaultsPayload as Record<string, unknown>),
  };

  const existingHeaders = normalizeHeaderMap((existingDefaultsPayload as Record<string, unknown>).headers);
  const nextHeaders = normalizeHeaderMap((nextDefaultsPayload as Record<string, unknown>).headers);
  if (existingHeaders || nextHeaders) {
    merged.headers = {
      ...(existingHeaders ?? {}),
      ...(nextHeaders ?? {}),
    };
  } else if (Object.prototype.hasOwnProperty.call(merged, "headers")) {
    delete merged.headers;
  }

  return merged;
}

export function canReplayOpenClawGatewayInviteAccept(input: {
  requestType: "human" | "agent";
  adapterType: string | null;
  existingJoinRequest: Pick<typeof joinRequests.$inferSelect, "requestType" | "adapterType" | "status"> | null;
}): boolean {
  if (input.requestType !== "agent" || input.adapterType !== "openclaw_gateway") return false;
  if (!input.existingJoinRequest) return false;
  if (input.existingJoinRequest.requestType !== "agent" || input.existingJoinRequest.adapterType !== "openclaw_gateway") {
    return false;
  }
  return (
    input.existingJoinRequest.status === "pending_approval" ||
    input.existingJoinRequest.status === "approved"
  );
}

export function normalizeAgentDefaultsForJoin(input: {
  adapterType: string | null;
  defaultsPayload: unknown;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  bindHost: string;
  allowedHostnames: string[];
}) {
  const fatalErrors: string[] = [];
  const diagnostics: JoinDiagnostic[] = [];
  if (input.adapterType !== "openclaw_gateway") {
    const normalized = isPlainObject(input.defaultsPayload) ? (input.defaultsPayload as Record<string, unknown>) : null;
    return { normalized, diagnostics, fatalErrors };
  }

  if (!isPlainObject(input.defaultsPayload)) {
    diagnostics.push({
      code: "openclaw_gateway_defaults_missing",
      level: "warn",
      message: "No OpenClaw gateway config was provided in agentDefaultsPayload.",
      hint: "Include agentDefaultsPayload.url and headers.x-openclaw-token for OpenClaw gateway joins.",
    });
    fatalErrors.push("agentDefaultsPayload is required for adapterType=openclaw_gateway");
    return { normalized: null as Record<string, unknown> | null, diagnostics, fatalErrors };
  }

  const defaults = input.defaultsPayload as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  let gatewayUrl: URL | null = null;
  const rawGatewayUrl = nonEmptyTrimmedString(defaults.url);
  if (!rawGatewayUrl) {
    diagnostics.push({
      code: "openclaw_gateway_url_missing",
      level: "warn",
      message: "OpenClaw gateway URL is missing.",
      hint: "Set agentDefaultsPayload.url to ws:// or wss:// gateway URL.",
    });
    fatalErrors.push("agentDefaultsPayload.url is required");
  } else {
    try {
      gatewayUrl = new URL(rawGatewayUrl);
      if (gatewayUrl.protocol !== "ws:" && gatewayUrl.protocol !== "wss:") {
        diagnostics.push({
          code: "openclaw_gateway_url_protocol",
          level: "warn",
          message: `OpenClaw gateway URL must use ws:// or wss:// (got ${gatewayUrl.protocol}).`,
        });
        fatalErrors.push("agentDefaultsPayload.url must use ws:// or wss:// for openclaw_gateway");
      } else {
        normalized.url = gatewayUrl.toString();
        diagnostics.push({
          code: "openclaw_gateway_url_configured",
          level: "info",
          message: `Gateway endpoint set to ${gatewayUrl.toString()}`,
        });
      }
    } catch {
      diagnostics.push({
        code: "openclaw_gateway_url_invalid",
        level: "warn",
        message: `Invalid OpenClaw gateway URL: ${rawGatewayUrl}`,
      });
      fatalErrors.push("agentDefaultsPayload.url is not a valid URL");
    }
  }

  const headers = normalizeHeaderMap(defaults.headers) ?? {};
  const gatewayToken =
    headerMapGetIgnoreCase(headers, "x-openclaw-token") ??
    headerMapGetIgnoreCase(headers, "x-openclaw-auth") ??
    tokenFromAuthorizationHeader(headerMapGetIgnoreCase(headers, "authorization"));
  if (gatewayToken && !headerMapHasKeyIgnoreCase(headers, "x-openclaw-token")) {
    headers["x-openclaw-token"] = gatewayToken;
  }
  if (Object.keys(headers).length > 0) {
    normalized.headers = headers;
  }

  if (!gatewayToken) {
    diagnostics.push({
      code: "openclaw_gateway_auth_header_missing",
      level: "warn",
      message: "Gateway auth token is missing from agent defaults.",
      hint: "Set agentDefaultsPayload.headers.x-openclaw-token (or legacy x-openclaw-auth).",
    });
    fatalErrors.push("agentDefaultsPayload.headers.x-openclaw-token (or x-openclaw-auth) is required");
  } else if (gatewayToken.trim().length < 16) {
    diagnostics.push({
      code: "openclaw_gateway_auth_header_too_short",
      level: "warn",
      message: `Gateway auth token appears too short (${gatewayToken.trim().length} chars).`,
      hint: "Use the full gateway auth token from ~/.openclaw/openclaw.json (typically long random string).",
    });
    fatalErrors.push("agentDefaultsPayload.headers.x-openclaw-token is too short; expected a full gateway token");
  } else {
    diagnostics.push({
      code: "openclaw_gateway_auth_header_configured",
      level: "info",
      message: "Gateway auth token configured.",
    });
  }

  if (isPlainObject(defaults.payloadTemplate)) {
    normalized.payloadTemplate = defaults.payloadTemplate;
  }

  const parsedDisableDeviceAuth = parseBooleanLike(defaults.disableDeviceAuth);
  const disableDeviceAuth = parsedDisableDeviceAuth === true;
  if (parsedDisableDeviceAuth !== null) {
    normalized.disableDeviceAuth = parsedDisableDeviceAuth;
  }

  const configuredDevicePrivateKeyPem = nonEmptyTrimmedString(defaults.devicePrivateKeyPem);
  if (configuredDevicePrivateKeyPem) {
    normalized.devicePrivateKeyPem = configuredDevicePrivateKeyPem;
    diagnostics.push({
      code: "openclaw_gateway_device_key_configured",
      level: "info",
      message: "Gateway device key configured. Pairing approvals should persist for this agent.",
    });
  } else if (!disableDeviceAuth) {
    try {
      normalized.devicePrivateKeyPem = generateEd25519PrivateKeyPem();
      diagnostics.push({
        code: "openclaw_gateway_device_key_generated",
        level: "info",
        message: "Generated persistent gateway device key for this join. Pairing approvals should persist for this agent.",
      });
    } catch (err) {
      diagnostics.push({
        code: "openclaw_gateway_device_key_generate_failed",
        level: "warn",
        message: `Failed to generate gateway device key: ${err instanceof Error ? err.message : String(err)}`,
        hint: "Set agentDefaultsPayload.devicePrivateKeyPem explicitly or set disableDeviceAuth=true.",
      });
      fatalErrors.push("Failed to generate gateway device key. Set devicePrivateKeyPem or disableDeviceAuth=true.");
    }
  }

  const waitTimeoutMs =
    typeof defaults.waitTimeoutMs === "number" && Number.isFinite(defaults.waitTimeoutMs)
      ? Math.floor(defaults.waitTimeoutMs)
      : typeof defaults.waitTimeoutMs === "string"
        ? Number.parseInt(defaults.waitTimeoutMs.trim(), 10)
        : NaN;
  if (Number.isFinite(waitTimeoutMs) && waitTimeoutMs > 0) {
    normalized.waitTimeoutMs = waitTimeoutMs;
  }

  const timeoutSec =
    typeof defaults.timeoutSec === "number" && Number.isFinite(defaults.timeoutSec)
      ? Math.floor(defaults.timeoutSec)
      : typeof defaults.timeoutSec === "string"
        ? Number.parseInt(defaults.timeoutSec.trim(), 10)
        : NaN;
  if (Number.isFinite(timeoutSec) && timeoutSec > 0) {
    normalized.timeoutSec = timeoutSec;
  }

  const sessionKeyStrategy = nonEmptyTrimmedString(defaults.sessionKeyStrategy);
  if (sessionKeyStrategy === "fixed" || sessionKeyStrategy === "issue" || sessionKeyStrategy === "run") {
    normalized.sessionKeyStrategy = sessionKeyStrategy;
  }

  const sessionKey = nonEmptyTrimmedString(defaults.sessionKey);
  if (sessionKey) normalized.sessionKey = sessionKey;

  const role = nonEmptyTrimmedString(defaults.role);
  if (role) normalized.role = role;

  if (Array.isArray(defaults.scopes)) {
    const scopes = defaults.scopes.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
    if (scopes.length > 0) normalized.scopes = scopes;
  }

  const rawPaperclipApiUrl = typeof defaults.paperclipApiUrl === "string" ? defaults.paperclipApiUrl.trim() : "";
  if (rawPaperclipApiUrl) {
    try {
      const parsedPaperclipApiUrl = new URL(rawPaperclipApiUrl);
      if (parsedPaperclipApiUrl.protocol !== "http:" && parsedPaperclipApiUrl.protocol !== "https:") {
        diagnostics.push({
          code: "openclaw_gateway_paperclip_api_url_protocol",
          level: "warn",
          message: `paperclipApiUrl must use http:// or https:// (got ${parsedPaperclipApiUrl.protocol}).`,
        });
      } else {
        normalized.paperclipApiUrl = parsedPaperclipApiUrl.toString();
        diagnostics.push({
          code: "openclaw_gateway_paperclip_api_url_configured",
          level: "info",
          message: `paperclipApiUrl set to ${parsedPaperclipApiUrl.toString()}`,
        });
      }
    } catch {
      diagnostics.push({
        code: "openclaw_gateway_paperclip_api_url_invalid",
        level: "warn",
        message: `Invalid paperclipApiUrl: ${rawPaperclipApiUrl}`,
      });
    }
  }

  return { normalized, diagnostics, fatalErrors };
}

export function buildInviteOnboardingManifest(
  req: Request,
  token: string,
  invite: typeof invites.$inferSelect,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    bindHost: string;
    allowedHostnames: string[];
  },
) {
  const baseUrl = requestBaseUrl(req);
  const skillPath = "/api/skills/paperclip";
  const skillUrl = buildPublicUrl(skillPath, req);
  const registrationEndpointPath = `/api/invites/${token}/accept`;
  const registrationEndpointUrl = buildPublicUrl(registrationEndpointPath, req);
  const onboardingTextPath = `/api/invites/${token}/onboarding.txt`;
  const onboardingTextUrl = buildPublicUrl(onboardingTextPath, req);
  const discoveryDiagnostics = buildOnboardingDiscoveryDiagnostics({
    apiBaseUrl: baseUrl,
    deploymentMode: opts.deploymentMode,
    deploymentExposure: opts.deploymentExposure,
    bindHost: opts.bindHost,
    allowedHostnames: opts.allowedHostnames,
  });
  const connectionCandidates = buildOnboardingConnectionCandidates({
    apiBaseUrl: baseUrl,
    bindHost: opts.bindHost,
    allowedHostnames: opts.allowedHostnames,
  });

  return {
    invite: toInviteSummaryResponse(req, token, invite),
    onboarding: {
      instructions:
        "Join as an OpenClaw Gateway agent, save your one-time claim secret, wait for board approval, then claim your API key. Save the claim response token to ~/.openclaw/workspace/paperclip-claimed-api-key.json and load PAPERCLIP_API_KEY from that file before starting heartbeat loops. You MUST submit adapterType='openclaw_gateway', set agentDefaultsPayload.url to your ws:// or wss:// OpenClaw gateway endpoint, and include agentDefaultsPayload.headers.x-openclaw-token (or legacy x-openclaw-auth).",
      inviteMessage: extractInviteMessage(invite),
      recommendedAdapterType: "openclaw_gateway",
      requiredFields: {
        requestType: "agent",
        agentName: "Display name for this agent",
        adapterType: "Use 'openclaw_gateway' for OpenClaw Gateway agents",
        capabilities: "Optional capability summary",
        agentDefaultsPayload:
          "Adapter config for OpenClaw gateway. MUST include url (ws:// or wss://) and headers.x-openclaw-token (or legacy x-openclaw-auth). Optional fields: paperclipApiUrl, waitTimeoutMs, sessionKeyStrategy, sessionKey, role, scopes, disableDeviceAuth, devicePrivateKeyPem.",
      },
      registrationEndpoint: {
        method: "POST",
        path: registrationEndpointPath,
        url: registrationEndpointUrl,
      },
      claimEndpointTemplate: {
        method: "POST",
        path: "/api/join-requests/{requestId}/claim-api-key",
        body: {
          claimSecret: "one-time claim secret returned when the join request is created",
        },
      },
      connectivity: {
        deploymentMode: opts.deploymentMode,
        deploymentExposure: opts.deploymentExposure,
        bindHost: opts.bindHost,
        allowedHostnames: opts.allowedHostnames,
        connectionCandidates,
        diagnostics: discoveryDiagnostics,
        guidance:
          opts.deploymentMode === "authenticated" && opts.deploymentExposure === "private"
            ? "If OpenClaw runs on another machine, ensure the Paperclip hostname is reachable and allowed via `pnpm paperclipai allowed-hostname <host>`."
            : "Ensure OpenClaw can reach this Paperclip API base URL for invite, claim, and skill bootstrap calls.",
      },
      textInstructions: {
        path: onboardingTextPath,
        url: onboardingTextUrl,
        contentType: "text/plain",
      },
      skill: {
        name: "paperclip",
        path: skillPath,
        url: skillUrl,
        installPath: "~/.openclaw/skills/paperclip/SKILL.md",
      },
    },
  };
}

export function buildInviteOnboardingTextDocument(
  req: Request,
  token: string,
  invite: typeof invites.$inferSelect,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    bindHost: string;
    allowedHostnames: string[];
  },
) {
  const manifest = buildInviteOnboardingManifest(req, token, invite, opts);
  const onboarding = manifest.onboarding as {
    inviteMessage?: string | null;
    registrationEndpoint: { method: string; path: string; url: string };
    claimEndpointTemplate: { method: string; path: string };
    textInstructions: { path: string; url: string };
    skill: { path: string; url: string; installPath: string };
    connectivity: {
      diagnostics?: JoinDiagnostic[];
      guidance?: string;
      connectionCandidates?: string[];
      testResolutionEndpoint?: { method?: string; path?: string; url?: string };
    };
  };
  const diagnostics = Array.isArray(onboarding.connectivity?.diagnostics) ? onboarding.connectivity.diagnostics : [];

  const lines: string[] = [];
  const appendBlock = (block: string) => {
    const trimmed = block.replace(/^\n/, "").replace(/\n\s*$/, "");
    const lineIndentation = trimmed
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.match(/^(\s*)/)?.[0].length ?? 0);
    const minIndent = lineIndentation.length > 0 ? Math.min(...lineIndentation) : 0;
    for (const line of trimmed.split("\n")) {
      lines.push(line.slice(minIndent));
    }
  };

  appendBlock(`
    # Paperclip OpenClaw Gateway Onboarding

    This document is meant to be readable by both humans and agents.

    ## Invite
    - inviteType: ${invite.inviteType}
    - allowedJoinTypes: ${invite.allowedJoinTypes}
    - expiresAt: ${invite.expiresAt.toISOString()}
  `);

  if (onboarding.inviteMessage) {
    appendBlock(`
      ## Message from inviter
      ${onboarding.inviteMessage}
    `);
  }

  appendBlock(`
    ## Step 0

    Get the OpenClaw gateway auth token (THIS MUST BE SENT)
    Token lives in:

    ~/.openclaw/openclaw.json -> gateway.auth.token
    Extract:

    TOKEN="$(node -p 'require(process.env.HOME+\"/.openclaw/openclaw.json\").gateway.auth.token')"
    test -n "$TOKEN" || (echo "Missing TOKEN" && exit 1)
    test "\${#TOKEN}" -ge 16 || (echo "Gateway token unexpectedly short (\${#TOKEN})" && exit 1)

    3) IMPORTANT: Don't accidentally drop the token when generating JSON
    If you build JSON with Node, pass the token explicitly (argv), don't rely on an un-exported env var.

    Safe payload build looks sort of like this (substitute where necessary):

    BODY="$(node -e '
      const token = process.argv[1];
      if (!token) process.exit(2);
      const body = {
        requestType: "agent",
        agentName: "OpenClaw",
        adapterType: "openclaw_gateway",
        capabilities: "OpenClaw agent adapter",
        agentDefaultsPayload: {
          url: "ws://127.0.0.1:18789",
          paperclipApiUrl: "http://host.docker.internal:3100",
          headers: { "x-openclaw-token": token },
          waitTimeoutMs: 120000,
          sessionKeyStrategy: "issue",
          role: "operator",
          scopes: ["operator.admin"]
        }
      };
      process.stdout.write(JSON.stringify(body));
    ' "$TOKEN")"

    ## Step 1: Submit agent join request
    ${onboarding.registrationEndpoint.method} ${
    onboarding.registrationEndpoint.url
  }

    IMPORTANT: You MUST include agentDefaultsPayload.headers.x-openclaw-token with your gateway token.
    Legacy x-openclaw-auth is also accepted, but x-openclaw-token is preferred.
    Use adapterType "openclaw_gateway" and a ws:// or wss:// gateway URL.
    Pairing mode requirement:
    - Keep device auth enabled (recommended). If devicePrivateKeyPem is omitted, Paperclip generates and persists one during join so pairing approvals are stable.
    - You may set disableDeviceAuth=true only for special environments that cannot support pairing.
    - First run may return "pairing required" once; approve the pending pairing request in OpenClaw, then retry.
    Do NOT use /v1/responses or /hooks/* in this gateway join flow.

    Body (JSON):
    {
      "requestType": "agent",
      "agentName": "My OpenClaw Agent",
      "adapterType": "openclaw_gateway",
      "capabilities": "Optional summary",
      "agentDefaultsPayload": {
        "url": "wss://your-openclaw-gateway.example",
        "paperclipApiUrl": "https://paperclip-hostname-your-agent-can-reach:3100",
        "headers": { "x-openclaw-token": "replace-me" },
        "waitTimeoutMs": 120000,
        "sessionKeyStrategy": "issue",
        "role": "operator",
        "scopes": ["operator.admin"]
      }
    }

    Expected response includes:
    - request id
    - one-time claimSecret
    - claimApiKeyPath

    ## Step 2: Wait for board approval
    The board approves the join request in Paperclip before key claim is allowed.

    ## Step 3: Claim API key (one-time)
    ${
      onboarding.claimEndpointTemplate.method
    } /api/join-requests/{requestId}/claim-api-key

    Body (JSON):
    {
      "claimSecret": "<one-time-claim-secret>"
    }

    On successful claim, save the full JSON response to:

    - ~/.openclaw/workspace/paperclip-claimed-api-key.json
    chmod 600 ~/.openclaw/workspace/paperclip-claimed-api-key.json

    And set the PAPERCLIP_API_KEY and PAPERCLIP_API_URL in your environment variables as specified here:
    https://docs.openclaw.ai/help/environment

    e.g. 

    {
      env: {
        PAPERCLIP_API_KEY: "...",
        PAPERCLIP_API_URL: "...",
      },
    }

    Then set PAPERCLIP_API_KEY and PAPERCLIP_API_URL from the saved token field for every heartbeat run.

    Important:
    - claim secrets expire
    - claim secrets are single-use
    - claim fails before board approval

    ## Step 4: Install Paperclip skill in OpenClaw
    GET ${onboarding.skill.url}
    Install path: ${onboarding.skill.installPath}

    Be sure to prepend your PAPERCLIP_API_URL to the top of your skill and note the path to your PAPERCLIP_API_URL

    ## Text onboarding URL
    ${onboarding.textInstructions.url}

    ## Connectivity guidance
    ${
      onboarding.connectivity?.guidance ??
      "Ensure Paperclip is reachable from your OpenClaw runtime."
    }
  `);

  const connectionCandidates = Array.isArray(onboarding.connectivity?.connectionCandidates)
    ? onboarding.connectivity.connectionCandidates.filter((entry): entry is string => Boolean(entry))
    : [];

  if (connectionCandidates.length > 0) {
    lines.push("## Suggested Paperclip base URLs to try");
    for (const candidate of connectionCandidates) {
      lines.push(`- ${candidate}`);
    }
    appendBlock(`

      Test each candidate with:
      - GET <candidate>/api/health
      - set the first reachable candidate as agentDefaultsPayload.paperclipApiUrl when submitting your join request

      If none are reachable: ask your human operator for a reachable hostname/address and help them update network configuration.
      For authenticated/private mode, they may need:
      - pnpm paperclipai allowed-hostname <host>
      - then restart Paperclip and retry onboarding.
    `);
  }

  if (diagnostics.length > 0) {
    lines.push("## Connectivity diagnostics");
    for (const diag of diagnostics) {
      lines.push(`- [${diag.level}] ${diag.message}`);
      if (diag.hint) lines.push(`  hint: ${diag.hint}`);
    }
  }

  appendBlock(`

    ## Helpful endpoints
    ${onboarding.registrationEndpoint.path}
    ${onboarding.claimEndpointTemplate.path}
    ${onboarding.skill.path}
    ${manifest.invite.onboardingPath}
  `);

  return `${lines.join("\n")}\n`;
}

export function resolveJoinRequestAgentManagerId(candidates: JoinRequestManagerCandidate[]): string | null {
  const ceoCandidates = candidates.filter((candidate) => candidate.role === "ceo");
  if (ceoCandidates.length === 0) return null;
  const rootCeo = ceoCandidates.find((candidate) => candidate.reportsTo === null);
  return (rootCeo ?? ceoCandidates[0] ?? null)?.id ?? null;
}

type JoinRequestManagerCandidate = {
  id: string;
  role: string;
  reportsTo: string | null;
};
