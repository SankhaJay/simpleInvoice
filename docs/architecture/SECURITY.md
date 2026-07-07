# SimpleInvoice — Security

Security is a primary evaluation axis for this assessment, and the design treats the brief's security guidance as hard requirements. This document maps each guideline to its implementation, then walks a short threat model.

---

## 1. Requirement → control mapping

| Brief guidance | Implemented control | Where |
| --- | --- | --- |
| Server‑side token exchange (`/oauth2/token` never from the client) | The password grant runs only in a Route Handler; `client_id`/`client_secret` are read from env on the server. | [`api/auth/login/route.ts`](../../src/app/api/auth/login/route.ts), [`lib/upstream.ts`](../../src/lib/upstream.ts) |
| Keep secrets out of the browser bundle (no `NEXT_PUBLIC_*`) | Secrets live in server‑only env, imported through `import "server-only"` which fails the build if pulled client‑side. | [`lib/env.ts`](../../src/lib/env.ts) |
| Secure token storage (httpOnly/Secure/SameSite, not `localStorage`) | Tokens are AES‑sealed by iron‑session into an `httpOnly`, `Secure` (prod), `SameSite=Lax` cookie. Nothing sensitive is in web storage. | [`lib/session.ts`](../../src/lib/session.ts) |
| BFF / proxy pattern (tokens never reach the browser) | All membership/invoice calls go through our `/api/*`; responses to the client contain only safe fields. | [`api/invoices/route.ts`](../../src/app/api/invoices/route.ts) |
| Secrets hygiene (git‑ignored `.env.local`, committed `.env.example`) | `.env.local` and the real Postman env are git‑ignored; `.env.example` and a Postman `.example.json` are committed with placeholders. | [`.gitignore`](../../.gitignore), [`.env.example`](../../.env.example) |
| Server‑side validation (not only client‑side) | Every Route Handler validates input with the same Zod schema the form uses. | [`src/schemas`](../../src/schemas), [`api/*`](../../src/app/api) |
| Security headers (via config or middleware) | Static headers in `next.config.ts`; a per‑request nonce CSP in the edge proxy. | [`next.config.ts`](../../next.config.ts), [`src/proxy.ts`](../../src/proxy.ts) |

---

## 2. Session & token handling

- **Encryption at rest in the cookie.** `iron-session` seals the payload (`Fe26.2*…`) with `SESSION_SECRET`; the browser cannot read or tamper with the `access_token`/`org_token` inside.
- **Flags.** `httpOnly` (no JS access → XSS cannot exfiltrate it), `Secure` in production (HTTPS only), `SameSite=Lax` (not sent on cross‑site subrequests → blunts CSRF), `Path=/`, and a `maxAge` bound to the token lifetime.
- **Never returned.** Login/session endpoints return only `SessionUser` (ids, names, org) — never tokens. Verified: no `access_token`, JWT, or sealed‑cookie material appears in any page HTML or API response body.
- **Validity.** `isSessionValid` checks both presence and expiry (`expiresAt`) before any protected action.

---

## 3. CSRF defence (layered)

Mutations (`POST /api/*`) must pass **both** checks:

1. **Same‑origin assertion** — the request `Origin`/`Referer` host must equal the `Host`. ([`assertSameOrigin`](../../src/lib/csrf.ts))
2. **Double‑submit token** — a random token is stored inside the sealed session and mirrored in a readable `si_csrf` cookie. The client echoes it in the `x-csrf-token` header; the server requires `header === session token` (length‑checked, constant‑time‑style compare). ([`assertCsrfToken`](../../src/lib/csrf.ts))

Because the session cookie is `SameSite=Lax`, a forged cross‑site POST would not even carry the session — these checks are defence‑in‑depth. _Verified: a create request without the CSRF header returns `403`._

---

## 4. Content‑Security‑Policy & headers

The edge proxy issues a **nonce‑based CSP** per request. Next.js detects the nonce in the request‑side CSP header and stamps it onto its own inline scripts, letting us avoid `'unsafe-inline'` for `script-src`:

```
default-src 'self';
script-src 'self' 'nonce-<rand>' 'strict-dynamic' [ 'unsafe-eval' only in dev ];
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self'; frame-ancestors 'none'; base-uri 'self';
form-action 'self'; object-src 'none'; upgrade-insecure-requests
```

Static headers from `next.config.ts`: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/topics disabled), `Cross-Origin-Opener-Policy: same-origin`. The `X-Powered-By` banner is removed.

---

## 5. Abuse & input hardening

- **Rate limiting** — the login route throttles login attempts per client IP (default **5/minute**, configurable via `LOGIN_RATE_LIMIT`), returning `429` + `Retry-After`. _Verified: rapid bad logins are blocked._ (In‑memory/per‑instance; a shared store would enforce this globally in production.)
- **Input validation** — Zod validates login, invoice‑create and list‑query inputs on the server; invalid payloads return `422` with field messages and never reach upstream.
- **Timeouts** — upstream fetches abort after 15 s to prevent resource exhaustion from a hung dependency.
- **Open‑redirect protection** — the post‑login `redirect` param is restricted to internal, single‑slash paths.
- **Error hygiene** — upstream error bodies are never forwarded; the client sees safe, generic messages.

---

## 6. Threat model (STRIDE‑lite)

| Threat | Vector | Mitigation |
| --- | --- | --- |
| **Token theft via XSS** | Malicious script reads storage | Tokens are `httpOnly` + encrypted in the cookie, never in `localStorage`; strict CSP limits script injection. |
| **CSRF** | Cross‑site forged POST | `SameSite=Lax` + same‑origin check + double‑submit token. |
| **Secret leakage** | Secrets in client bundle / repo | `server-only` env, no `NEXT_PUBLIC_*`, git‑ignored `.env.local` + Postman env. |
| **Credential brute force** | Repeated login attempts | Per‑IP rate limiting with `Retry-After`. |
| **Clickjacking** | App framed by attacker | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| **MITM / downgrade** | Plaintext HTTP | HSTS + `Secure` cookies + `upgrade-insecure-requests`. |
| **Injection via inputs** | Malformed/oversized payloads | Server‑side Zod validation with bounds; upstream never sees invalid data. |
| **Session fixation/tamper** | Forged/edited cookie | AES‑sealed, signed cookie — tampering invalidates it. |
| **Open redirect** | Crafted `?redirect=` | Only internal paths accepted. |

---

## 7. Session resilience — silent token refresh

The 101 Digital identity server issues a **single active access token per (client, user)** and revokes the previous one on each new password‑grant login. Because the assessment credentials are a **shared sandbox account**, another login elsewhere (another tab, another candidate, a test run) revokes our access token mid‑session — the local session cookie still looks valid, so pages render but upstream data calls return `401`.

The BFF recovers transparently ([`lib/upstream-auth.ts`](../../src/lib/upstream-auth.ts)): on an upstream `401` it uses the still‑valid **refresh token** (which a competing login does **not** revoke) to mint a fresh access token, re‑derives the org token, rotates the sealed session, and retries the call once. Concurrent 401s coalesce into a single refresh (single‑flight) so the rotating refresh token is not invalidated by a race. If the refresh itself fails, the session is destroyed and the client is routed to login.

## 8. Known limitations (honest disclosure)

- **Rate limiting is per‑instance** (in‑memory). Behind multiple instances it should use a shared store (Redis) or an edge limiter.
- **Refresh single‑flight is per‑instance.** The coalescing map is in‑memory, so across horizontally‑scaled instances two nodes could still refresh concurrently. A shared lock (Redis) would close this in production; it is not a concern for a single‑instance deployment.
- **CSP `style-src` allows `'unsafe-inline'`** — required by Tailwind/Next injected styles; styles are not a script‑execution vector, so this is a widely accepted trade‑off.
