import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { buildPublicUrl, requestBaseUrl, resolveConfiguredPublicBaseUrl } from "../utils/public-url.js";

function buildReq(headers: Record<string, string>, protocol = "http") {
  return {
    protocol,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe("public-url utils", () => {
  const originalEnv = {
    PAPERCLIP_AUTH_PUBLIC_BASE_URL: process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_BASE_URL: process.env.BETTER_AUTH_BASE_URL,
    PAPERCLIP_PUBLIC_URL: process.env.PAPERCLIP_PUBLIC_URL,
  };

  afterEach(() => {
    process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL = originalEnv.PAPERCLIP_AUTH_PUBLIC_BASE_URL;
    process.env.BETTER_AUTH_URL = originalEnv.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_BASE_URL = originalEnv.BETTER_AUTH_BASE_URL;
    process.env.PAPERCLIP_PUBLIC_URL = originalEnv.PAPERCLIP_PUBLIC_URL;
  });

  it("prefers configured public base url over request headers", () => {
    process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL = "https://paperclip.example.com";
    const req = buildReq({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "proxy.example.com",
      host: "localhost:3100",
    });

    expect(resolveConfiguredPublicBaseUrl()).toBe("https://paperclip.example.com");
    expect(requestBaseUrl(req)).toBe("https://paperclip.example.com");
    expect(buildPublicUrl("/api/invites/token/onboarding", req)).toBe(
      "https://paperclip.example.com/api/invites/token/onboarding",
    );
  });

  it("falls back to forwarded headers when no explicit public url is configured", () => {
    delete process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL;
    delete process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_BASE_URL;
    delete process.env.PAPERCLIP_PUBLIC_URL;

    const req = buildReq({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "gateway.example.com, proxy.internal",
      host: "localhost:3100",
    });

    expect(requestBaseUrl(req)).toBe("https://gateway.example.com");
    expect(buildPublicUrl("/api/skills/index", req)).toBe("https://gateway.example.com/api/skills/index");
  });

  it("returns relative path when no public base and no host are available", () => {
    delete process.env.PAPERCLIP_AUTH_PUBLIC_BASE_URL;
    delete process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_BASE_URL;
    delete process.env.PAPERCLIP_PUBLIC_URL;

    const req = buildReq({});
    expect(requestBaseUrl(req)).toBe("");
    expect(buildPublicUrl("/api/skills/index", req)).toBe("/api/skills/index");
  });
});
