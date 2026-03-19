import type { Request } from "express";

function firstHeaderValue(value: string | undefined) {
  return value?.split(",")[0]?.trim() || null;
}

export function resolveConfiguredPublicBaseUrl() {
  const explicit =
    process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_BASE_URL ??
    process.env.PAPERCLIP_PUBLIC_URL;
  const trimmed = explicit?.trim();
  return trimmed ? trimmed : null;
}

export function requestBaseUrl(req?: Request) {
  const configured = resolveConfiguredPublicBaseUrl();
  if (configured) return configured;
  if (!req) return "";
  const proto = firstHeaderValue(req.header("x-forwarded-proto")) || req.protocol || "http";
  const host = firstHeaderValue(req.header("x-forwarded-host")) || req.header("host");
  if (!host) return "";
  return `${proto}://${host}`;
}

export function buildPublicUrl(path: string, req?: Request) {
  const baseUrl = requestBaseUrl(req);
  return baseUrl ? `${baseUrl}${path}` : path;
}
