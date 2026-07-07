import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { assertSameOrigin, CSRF_COOKIE } from "@/lib/csrf";
import { apiOk, Errors } from "@/lib/api-response";

/**
 * POST /api/auth/logout — destroy the session and clear the CSRF cookie.
 * Same-origin only. Idempotent: always reports success.
 */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return Errors.forbidden();

  const session = await getSession();
  session.destroy();

  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE);

  return apiOk({ success: true });
}
