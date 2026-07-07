# ADR 0002 — Encrypted stateless session cookie (iron‑session)

**Status:** Accepted

## Context

We must persist the `access_token`, `org_token`, expiry and safe user profile between requests, securely, without exposing tokens to the browser. The brief calls for httpOnly/Secure/SameSite cookies.

## Decision

Use **iron‑session** to store the session in a single **AES‑sealed, stateless cookie** with flags `httpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`, and a `maxAge` bound to the token lifetime. Decryption happens only on the server with `SESSION_SECRET`. See [`lib/session.ts`](../../../src/lib/session.ts).

## Consequences

**Positive**

- Contents are encrypted and tamper‑evident — even the tokens inside are opaque to the client.
- **Stateless**: no database or session store to run, back up or scale.
- Trivial to invalidate (`session.destroy()`), and expiry is enforced explicitly.

**Negative / trade‑offs**

- Cookie size grows with payload (well within limits here).
- Rotating `SESSION_SECRET` invalidates existing sessions (acceptable; can be handled with key rotation later).

## Alternatives considered

- **Plain httpOnly cookies holding raw tokens.** Meets the baseline but weaker — tokens are readable if the cookie is ever exposed server‑side; no integrity guarantee.
- **Server‑side session store (Redis).** More robust for revocation at scale but adds infrastructure the assessment does not need. Noted as a future step.
- **`localStorage`/`sessionStorage`.** Rejected outright — readable by any script (XSS) and disallowed by the brief.
