# ADR 0006 — End‑to‑end tests against a mocked upstream

**Status:** Accepted

## Context

The unit/integration suite (Vitest + MSW) covers logic and components in isolation. We also wanted a browser‑level end‑to‑end check of the real flows — login → list → detail → create — exercising the actual BFF, sealed session, CSRF and routing. Running E2E against the **live 101 Digital sandbox** would be problematic: it needs real credentials, pollutes the shared sandbox with test invoices, and is flaky because the shared account's tokens get revoked whenever anyone else logs in.

## Decision

Use **Playwright** to drive the **real Next.js app in a real browser**, but replace the **external** 101 Digital dependency with a small local mock server ([`e2e/mock-server.mjs`](../../../e2e/mock-server.mjs)). The app is pointed at the mock via `AUTH_BASE_URL`/`API_BASE_URL` in [`playwright.config.ts`](../../../playwright.config.ts), which starts both the mock and the app. Only the outermost hop is stubbed — everything the assessment cares about (auth, session, CSRF, validation, proxy, UI) runs for real.

## Consequences

**Positive**

- **Deterministic & CI‑friendly** — no network flakiness, no shared‑credential token revocation, repeatable results.
- **Secret‑free** — the mock accepts fictional credentials (`e2e/helpers.ts`), so nothing real is committed or required.
- **No side effects** — created invoices live in the mock's in‑memory store, never the real sandbox.

**Negative / trade‑offs**

- Does not verify the real upstream **contract**. That risk is covered elsewhere: the MSW‑based unit tests assert the request/response mapping, and the integration was verified manually against the sandbox during development.
- The mock must be kept roughly in step with upstream response shapes (it is small and centralised, so cheap to maintain).

## Notes

Each test logs in via the UI; the login rate limiter is relaxed for the suite through the configurable `LOGIN_RATE_LIMIT` env var, keeping a single, UI‑friendly Playwright project rather than a separate auth‑setup project.
