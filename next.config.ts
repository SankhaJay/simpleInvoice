import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 *
 * The Content-Security-Policy is intentionally NOT set here — it is emitted
 * per-request from `middleware.ts` with a cryptographic nonce so that Next.js
 * can attach the nonce to its own inline bootstrap scripts. Keeping CSP in the
 * middleware avoids the weaker `'unsafe-inline'` script policy a static header
 * would force.
 */
const securityHeaders = [
  // Enforce HTTPS for two years, including subdomains and preload lists.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Disallow MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy clickjacking protection (CSP frame-ancestors is the modern control).
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features we never use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Isolate this origin's browsing context group.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Type errors and lint errors fail the build by default — kept as-is.
  // Remove the `X-Powered-By: Next.js` fingerprint.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
