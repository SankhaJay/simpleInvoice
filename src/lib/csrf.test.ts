import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { assertSameOrigin, assertCsrfToken, generateCsrfToken } from "@/lib/csrf";

/** Build a minimal stand-in for NextRequest carrying just the headers we read. */
function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("assertSameOrigin", () => {
  it("passes when Origin host matches Host", () => {
    expect(assertSameOrigin(req({ origin: "https://app.example.com", host: "app.example.com" }))).toBe(true);
  });

  it("falls back to the Referer header", () => {
    expect(
      assertSameOrigin(req({ referer: "https://app.example.com/login", host: "app.example.com" })),
    ).toBe(true);
  });

  it("fails on a cross-site origin", () => {
    expect(assertSameOrigin(req({ origin: "https://evil.com", host: "app.example.com" }))).toBe(false);
  });

  it("fails when no origin/referer present", () => {
    expect(assertSameOrigin(req({ host: "app.example.com" }))).toBe(false);
  });
});

describe("assertCsrfToken", () => {
  it("passes when header token matches the session token", () => {
    const token = generateCsrfToken();
    expect(assertCsrfToken(req({ "x-csrf-token": token }), token)).toBe(true);
  });

  it("fails when tokens differ", () => {
    expect(assertCsrfToken(req({ "x-csrf-token": "aaaa" }), "bbbb")).toBe(false);
  });

  it("fails when the header is missing", () => {
    expect(assertCsrfToken(req({}), "bbbb")).toBe(false);
  });

  it("fails when the session token is undefined", () => {
    expect(assertCsrfToken(req({ "x-csrf-token": "aaaa" }), undefined)).toBe(false);
  });
});
