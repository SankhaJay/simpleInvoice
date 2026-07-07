import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { env } from "@/lib/env";
import type { SessionData, SessionUser } from "@/types/session";

/**
 * iron-session configuration. The cookie is:
 *  - AES-sealed (encrypted + signed) with SESSION_SECRET — its contents are
 *    opaque and tamper-evident, so even the token payloads inside are unreadable
 *    to the browser.
 *  - httpOnly    → never accessible to JavaScript (XSS cannot read it).
 *  - secure      → only sent over HTTPS in production.
 *  - sameSite=lax→ not sent on cross-site subrequests, mitigating CSRF while
 *    still allowing top-level navigations.
 */
export const sessionOptions: SessionOptions = {
  password: env.SESSION_SECRET,
  cookieName: env.SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Bound to the upstream access-token lifetime (1h); refreshed on each login.
    maxAge: 60 * 60,
  },
};

/**
 * Read/write the encrypted session bound to the current request's cookies.
 * Works in Route Handlers and Server Components/Actions.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/** Whether the current session holds a still-valid access token. */
export function isSessionValid(session: IronSession<SessionData>): boolean {
  return Boolean(session.accessToken) && session.expiresAt > Date.now();
}

/**
 * Return the safe (token-free) user for the current request, or null when the
 * session is missing or expired.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!isSessionValid(session)) return null;
  return session.user ?? null;
}
