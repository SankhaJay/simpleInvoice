import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf-constants";

/**
 * CSRF defence uses two independent, layered checks on mutating requests:
 *
 *  1. Same-origin assertion — the request's Origin (or Referer) host must match
 *     the Host it was sent to. Cross-site attackers cannot forge a matching
 *     Origin from the victim's browser.
 *  2. Double-submit token — a random token is stored inside the sealed session
 *     AND mirrored in a readable cookie. The client echoes it back in the
 *     `x-csrf-token` header; the server requires header === session token.
 *
 * Because our session cookie is SameSite=Lax, a forged cross-site POST would
 * not even carry the session — these checks are belt-and-braces.
 */

export { CSRF_HEADER, CSRF_COOKIE };

/** Cryptographically-random 32-byte token, URL-safe. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Reject if the request did not originate from our own origin. */
export function assertSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Constant-time-ish comparison of the header token against the session token. */
export function assertCsrfToken(request: NextRequest, sessionToken: string | undefined): boolean {
  const headerToken = request.headers.get(CSRF_HEADER);
  if (!headerToken || !sessionToken) return false;
  if (headerToken.length !== sessionToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerToken.length; i++) {
    mismatch |= headerToken.charCodeAt(i) ^ sessionToken.charCodeAt(i);
  }
  return mismatch === 0;
}
