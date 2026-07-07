import { getSession, isSessionValid } from "@/lib/session";
import { fetchProfile } from "@/lib/upstream";
import { withUpstreamAuth } from "@/lib/upstream-auth";
import { UpstreamError } from "@/lib/http";
import { apiOk, Errors } from "@/lib/api-response";

/**
 * GET /api/profile — the current user's full profile from `/users/me`.
 * Session-gated, token-free response, with the same silent-refresh recovery.
 */
export async function GET() {
  const session = await getSession();
  if (!isSessionValid(session)) return Errors.unauthorized();

  try {
    const profile = await withUpstreamAuth(session, (auth) => fetchProfile(auth.accessToken));
    return apiOk(profile);
  } catch (err) {
    if (err instanceof UpstreamError) return Errors.upstream(err.status, err.message);
    return Errors.internal();
  }
}
