import "server-only";
import type { IronSession } from "iron-session";
import { UpstreamError } from "@/lib/http";
import { fetchUserProfile, refreshAccessToken, type UpstreamAuth } from "@/lib/upstream";
import type { SessionData } from "@/types/session";

/**
 * Coalesce refreshes so a rotating refresh token is spent exactly once even
 * under concurrency. Two layers, both keyed by the OLD refresh token:
 *
 *  - `inFlight`: requests that overlap the refresh call share one promise.
 *  - `recent`: a short‑lived cache of the result, so requests that arrive just
 *    AFTER the refresh completed still receive the already‑minted tokens instead
 *    of replaying the now‑consumed refresh token (which would 401).
 *
 * This is per‑instance state; a shared lock (Redis) would be needed to make it
 * strict across horizontally‑scaled nodes.
 */
type RefreshResult = Awaited<ReturnType<typeof refreshAccessToken>>;
const inFlight = new Map<string, Promise<RefreshResult>>();
const recent = new Map<string, { result: RefreshResult; expiresAt: number }>();
const RECENT_TTL_MS = 30_000;

async function coalescedRefresh(refreshToken: string): Promise<RefreshResult> {
  const cached = recent.get(refreshToken);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let pending = inFlight.get(refreshToken);
  if (!pending) {
    pending = refreshAccessToken(refreshToken)
      .then((result) => {
        recent.set(refreshToken, { result, expiresAt: Date.now() + RECENT_TTL_MS });
        return result;
      })
      .finally(() => inFlight.delete(refreshToken));
    inFlight.set(refreshToken, pending);
  }
  return pending;
}

/**
 * Run an authenticated upstream call, transparently recovering from a revoked
 * or expired access token.
 *
 * Why this exists: the identity server revokes our access token whenever a new
 * password‑grant login happens for the same user — which, on the shared sandbox
 * credentials, occurs unpredictably (another tab, another candidate, a test
 * run). The result is a mid‑session upstream 401 even though our local session
 * cookie still looks valid.
 *
 * Recovery: on a 401 we use the still‑valid refresh token to mint a fresh access
 * token, re‑derive the org token, persist the rotated tokens back into the
 * sealed session, and retry the call once. If the refresh itself fails the
 * session is unrecoverable, so we destroy it and surface a 401 for the client
 * to route to login.
 */
export async function withUpstreamAuth<T>(
  session: IronSession<SessionData>,
  call: (auth: UpstreamAuth) => Promise<T>,
): Promise<T> {
  try {
    return await call({ accessToken: session.accessToken, orgToken: session.orgToken });
  } catch (err) {
    const isAuthError = err instanceof UpstreamError && err.status === 401;
    if (!isAuthError || !session.refreshToken) throw err;

    try {
      const refreshed = await coalescedRefresh(session.refreshToken);
      const { orgToken } = await fetchUserProfile(refreshed.accessToken);
      session.accessToken = refreshed.accessToken;
      session.refreshToken = refreshed.refreshToken ?? session.refreshToken;
      session.orgToken = orgToken;
      session.expiresAt = Date.now() + refreshed.expiresIn * 1000;
      await session.save();
    } catch {
      // Refresh failed → the session cannot be recovered. Clear it so the next
      // navigation is routed to login, and signal 401 to the caller.
      session.destroy();
      throw new UpstreamError(401, "Your session has expired. Please sign in again.");
    }

    // Retry once with the refreshed credentials.
    return call({ accessToken: session.accessToken, orgToken: session.orgToken });
  }
}
