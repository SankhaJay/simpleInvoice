# Architecture Decision Records

Short records of the significant architectural decisions in SimpleInvoice, why they were made, and the trade‑offs considered.

| # | Decision | Summary |
| --- | --- | --- |
| [0001](0001-bff-proxy-pattern.md) | Backend‑for‑Frontend proxy | All upstream I/O goes through our server; tokens never reach the browser. |
| [0002](0002-encrypted-cookie-session.md) | Encrypted stateless session cookie | AES‑sealed iron‑session cookie; no DB. |
| [0003](0003-tanstack-query-url-state.md) | TanStack Query + URL state | Interactive list backed by Query, with the URL as the single source of truth. |
| [0004](0004-zod-shared-validation.md) | Shared Zod schemas | One schema validates client and server. |
| [0005](0005-shadcn-ui.md) | Tailwind v4 + shadcn/ui | Accessible, owned component code. |
| [0006](0006-e2e-mocked-upstream.md) | E2E vs a mocked upstream | Playwright drives the real app; only 101 Digital is stubbed. |
