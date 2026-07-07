# ADR 0001 — Backend‑for‑Frontend (BFF) proxy pattern

**Status:** Accepted · **Context:** 101 Digital SimpleInvoice assessment

## Context

The app must call three upstream 101 Digital services using an OAuth2 `access_token` and an `org_token`. The brief explicitly requires that the token exchange and all upstream communication happen server‑side, with tokens never reaching the browser.

## Decision

Route **all** upstream communication through our own Next.js server (Route Handlers + Server Components). The browser only ever calls same‑origin `/api/*` endpoints. A single server module ([`lib/upstream.ts`](../../../src/lib/upstream.ts)) is the only place that knows upstream URLs, headers and tokens.

## Consequences

**Positive**

- `client_id`, `client_secret`, `access_token` and `org_token` stay entirely on the server.
- One choke point to enforce validation, CSRF, rate limiting, timeouts and error normalisation.
- The client is upstream‑agnostic and easy to test (it only knows our envelope).

**Negative / trade‑offs**

- An extra network hop (browser → our server → upstream). Acceptable, and it enables caching/normalisation we want anyway.
- Our server must be available for every data call (inherent to the pattern and to Next.js).

## Alternatives considered

- **Direct client → upstream calls.** Rejected: would expose tokens to the browser and violate the brief.
- **Next.js `rewrites` as a dumb proxy.** Rejected: cannot inject the sealed session's tokens or run validation/CSRF logic.
