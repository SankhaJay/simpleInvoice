import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { loginSchema } from "@/schemas/auth.schema";
import { getSession } from "@/lib/session";
import { exchangePasswordForToken, fetchUserProfile } from "@/lib/upstream";
import { UpstreamError } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { assertSameOrigin, generateCsrfToken, CSRF_COOKIE } from "@/lib/csrf";
import { apiOk, apiError, Errors } from "@/lib/api-response";
import { fieldErrors } from "@/lib/zod-errors";
import { env } from "@/lib/env";

/**
 * POST /api/auth/login — server-side OAuth2 password grant.
 *
 * Security properties:
 *  - The client_id/client_secret never leave the server (read from env here).
 *  - The browser sends only { username, password } to OUR endpoint; it never
 *    talks to the 101 Digital identity server directly.
 *  - Tokens are sealed into an encrypted, httpOnly cookie and never returned.
 *  - Brute-force attempts are rate-limited per IP.
 */
export async function POST(request: NextRequest) {
  // Reject cross-site form posts up front.
  if (!assertSameOrigin(request)) return Errors.forbidden();

  // Throttle by client IP (5 attempts / minute).
  const limit = rateLimit(`login:${clientIp(request.headers)}`, { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return Errors.tooManyRequests(limit.retryAfter);

  // Parse + validate the body against the shared schema.
  const raw = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return Errors.validation(fieldErrors(parsed.error));
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await exchangePasswordForToken(
      parsed.data.username,
      parsed.data.password,
    );
    const { user, orgToken } = await fetchUserProfile(accessToken);

    // Seal everything sensitive into the encrypted session cookie.
    const csrfToken = generateCsrfToken();
    const session = await getSession();
    session.accessToken = accessToken;
    session.refreshToken = refreshToken;
    session.orgToken = orgToken;
    session.expiresAt = Date.now() + expiresIn * 1000;
    session.user = user;
    session.csrfToken = csrfToken;
    await session.save();

    // Mirror the CSRF token in a readable cookie for the double-submit check.
    // Not httpOnly by design — the client must read it to echo it back — but it
    // grants no access on its own (it must match the sealed session copy).
    const cookieStore = await cookies();
    cookieStore.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn,
    });

    return apiOk({ user });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return apiError(err.status, "AUTH_FAILED", err.message);
    }
    return Errors.internal();
  }
}
