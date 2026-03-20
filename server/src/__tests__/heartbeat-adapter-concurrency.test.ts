import { describe, expect, it } from "vitest";

import {
  resolveAdapterRateLimitCooldownMs,
  resolveAdapterSharedConcurrencyLimit,
  shouldApplyAdapterRateLimitCooldown,
} from "../services/heartbeat.js";

describe("resolveAdapterSharedConcurrencyLimit", () => {
  it("defaults openclaw gateway to a shared limit of one", () => {
    expect(resolveAdapterSharedConcurrencyLimit("openclaw_gateway", {})).toBe(1);
  });

  it("allows explicit adapter shared concurrency overrides", () => {
    expect(
      resolveAdapterSharedConcurrencyLimit("openclaw_gateway", {
        heartbeat: {
          adapterSharedConcurrencyLimit: 2,
        },
      }),
    ).toBe(2);
  });

  it("allows disabling the shared limit explicitly", () => {
    expect(
      resolveAdapterSharedConcurrencyLimit("openclaw_gateway", {
        heartbeat: {
          adapterSharedConcurrencyLimit: null,
        },
      }),
    ).toBeNull();
  });

  it("does not force a shared limit for adapters without a default", () => {
    expect(resolveAdapterSharedConcurrencyLimit("process", {})).toBeNull();
  });

  it("defaults openclaw gateway to a one-minute rate-limit cooldown", () => {
    expect(resolveAdapterRateLimitCooldownMs("openclaw_gateway", {})).toBe(60_000);
  });

  it("allows overriding adapter rate-limit cooldowns", () => {
    expect(
      resolveAdapterRateLimitCooldownMs("openclaw_gateway", {
        heartbeat: {
          adapterRateLimitCooldownMs: 15_000,
        },
      }),
    ).toBe(15_000);
  });

  it("applies adapter cooldowns only for rate-limit failures", () => {
    expect(
      shouldApplyAdapterRateLimitCooldown("openclaw_gateway", {
        errorCode: "openclaw_gateway_rate_limited",
        errorMessage: "API rate limit reached. Please try again later.",
      }),
    ).toBe(true);
    expect(
      shouldApplyAdapterRateLimitCooldown("openclaw_gateway", {
        errorCode: "openclaw_gateway_wait_error",
        errorMessage: "API rate limit reached. Please try again later.",
      }),
    ).toBe(true);
    expect(
      shouldApplyAdapterRateLimitCooldown("openclaw_gateway", {
        errorCode: "openclaw_gateway_wait_error",
        errorMessage: "some unrelated failure",
      }),
    ).toBe(false);
  });
});
