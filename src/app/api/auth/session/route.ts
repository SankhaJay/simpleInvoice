import { getSession, isSessionValid } from "@/lib/session";
import { apiOk } from "@/lib/api-response";

/**
 * GET /api/auth/session — return the current safe user (no tokens), or null.
 * Used by the client `useSession` hook to hydrate auth state.
 */
export async function GET() {
  const session = await getSession();
  if (!isSessionValid(session)) {
    return apiOk({ user: null });
  }
  return apiOk({ user: session.user });
}
