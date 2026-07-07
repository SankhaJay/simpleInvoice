import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy (formerly "middleware") responsible for two cross-cutting concerns:
 *
 *  1. Content-Security-Policy with a per-request nonce. Next.js detects the
 *     nonce in the request-side CSP header and stamps it onto its own inline
 *     bootstrap scripts, so we can run a strict `script-src` without
 *     `'unsafe-inline'`. The same policy is echoed on the response for the
 *     browser to enforce.
 *  2. Coarse auth routing. Unauthenticated visitors to protected routes are
 *     redirected to `/login`. This is a UX gate only — every `/api` route and
 *     server component still independently validates the sealed session, so a
 *     stale or forged cookie grants no access to data.
 */

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "si_session";

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  // React Refresh / dev tooling needs eval only in development.
  if (isDev) scriptSrc.push("'unsafe-eval'");

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    // Tailwind + Next inject inline <style>; styles are not a script-injection
    // vector so 'unsafe-inline' here is acceptable and common practice.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Auth routing (UX gate) ---
  const isPublicPath = pathname === "/login" || pathname.startsWith("/api");
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublicPath && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- CSP with per-request nonce ---
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on everything except static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
