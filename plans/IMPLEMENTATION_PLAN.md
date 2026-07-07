# SimpleInvoice — 101 Digital Web Engineer Assessment

## Context

This is a greenfield build for the 101 Digital Web Engineer assessment (`docs/Assessment Project - NextJS v2.2.4.md`). The repo currently contains only the brief and a Postman collection. We must deliver a **Next.js + TypeScript** invoicing web app named **SimpleInvoice** with three core features — **Login**, **Invoice List** (search/sort/filter/paginate, as the landing page), and **Create Invoice** (single line item) — plus supporting architecture documentation.

Scoring is weighted heavily toward **security posture** (server-side token exchange, BFF/proxy pattern, httpOnly cookies, no secrets in the browser, server-side validation, security headers), **code quality + testing**, **architecture documentation**, and **value-add**. The plan below targets all six assessment criteria.

The upstream 101 Digital APIs (sandbox):
- `POST {authBaseUrl}/t/101digital.core/oauth2/token` — OAuth2 password grant → `access_token`
- `GET {apiBaseUrl}/membership-service/1.0.0/users/me` — profile → `org_token` = `memberships[0].token`
- `GET {apiBaseUrl}/invoice-service/1.0.0/invoices` — list (params: keyword, status, sortBy, ordering, pageNum, pageSize, fromDate, toDate)
- `POST {apiBaseUrl}/invoice-service/1.0.0/invoices` — create (headers: `Authorization: Bearer`, `org-token`, `Operation-Mode: SYNC`)

## Decisions (confirmed with user)

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4 + shadcn/ui (Radix primitives, owned code, accessible) |
| Data layer | TanStack Query v5 against our own BFF routes; URL `searchParams` as the source of truth for list state |
| Forms/validation | react-hook-form + Zod, schemas **shared** between client and server |
| Session security | Encrypted stateless cookie via **iron-session** (AES-sealed, httpOnly, Secure, SameSite=Lax) |
| Testing | Vitest + React Testing Library (+ MSW for network mocking) |

## Architecture

**Backend-for-Frontend (BFF).** The browser only ever talks to our own `/api/*` routes. All 101 Digital calls happen server-side; upstream tokens never reach client JS. Client secret and credentials are read only from non-public env vars on the server.

```
Browser ──▶ Next.js Route Handlers (BFF) ──▶ 101 Digital APIs
   │            │ iron-session (encrypted cookie: access_token, org_token, user, exp)
   │            │ Zod validation · CSRF check · rate limit · security headers
   └── only sees safe user data + its own /api/* endpoints
```

### Proposed structure
```
src/
  app/
    (auth)/login/page.tsx                # login form (client validation)
    (app)/layout.tsx                     # auth-gated shell (nav, user menu, logout)
    (app)/invoices/page.tsx              # LANDING: list + search/sort/filter/paginate
    (app)/invoices/new/page.tsx          # create invoice form
    api/
      auth/login/route.ts                # server token exchange + profile → seal session
      auth/logout/route.ts               # destroy session cookie
      auth/session/route.ts              # return current safe user (no tokens)
      invoices/route.ts                  # GET proxy(list) · POST proxy(create)
    layout.tsx  ·  globals.css  ·  providers.tsx (QueryClient)
  components/ui/                         # shadcn components
  components/invoices/                   # InvoiceTable, Filters, Pagination, InvoiceForm
  lib/
    env.ts                               # zod-validated process.env (server-only)
    session.ts                           # iron-session config + get/seal/destroy helpers
    upstream.ts                          # typed server-side 101Digital client (token exchange, profile, list, create)
    csrf.ts  ·  rate-limit.ts  ·  http.ts (fetch wrapper w/ timeout + error mapping)
  schemas/  auth.schema.ts · invoice.schema.ts · invoice-query.schema.ts
  types/    invoice.ts · session.ts · api.ts
  hooks/    use-invoices.ts · use-create-invoice.ts · use-session.ts
middleware.ts                            # route protection + security headers
```

### Key flows
- **Login:** client posts username/password → `/api/auth/login`. Handler: Zod-validate → rate-limit → exchange for `access_token` (client_id/secret from env) → fetch `/users/me` for `org_token` + profile → seal `{accessToken, orgToken, user, expiresAt}` into encrypted cookie → return safe user only.
- **List:** TanStack Query reads URL params → `/api/invoices?…`. Handler reads session, attaches `Bearer` + `org-token`, proxies upstream, returns normalized page `{items, total, pageNum, pageSize}`.
- **Create:** react-hook-form + Zod → `/api/invoices` (POST). Handler: CSRF check → Zod-validate → map flat form to upstream `invoices[]` shape (single line item, adds `Operation-Mode: SYNC`) → proxy → return success; UI shows confirmation toast and redirects to list.

## Security controls (production-grade)
- Server-side OAuth2 token exchange only; secrets from `.env.local`, never `NEXT_PUBLIC_*`.
- Committed `.env.example` with placeholders; real `.env.local` git-ignored.
- Encrypted session cookie: httpOnly, Secure (prod), SameSite=Lax, short TTL tied to token `expires_in`.
- **Server-side Zod validation** on every BFF route (not just client-side).
- **CSRF** protection on mutating routes (double-submit token issued to client; origin/host check).
- **Rate limiting** on `/api/auth/login` (in-memory sliding window; note Redis for multi-instance in docs).
- **Security headers** via `next.config` + middleware: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Route protection** middleware: unauthenticated users → `/login`; authenticated hitting `/login` → `/invoices`.
- Upstream fetches: timeouts, no token/secret leakage in error responses or logs.

## Value-add (functional + non-functional)
- Session-aware UX: loading **skeletons**, empty/error states, **toast** notifications, optimistic-friendly query invalidation.
- Debounced search, column sort toggles, status filter, date-range filter, page-size selector — all reflected in the URL (shareable/back-button friendly).
- Auto-generated `invoiceNumber`/reference suggestions; client-side total computation (rate × qty ± extensions) preview before submit.
- Accessibility: keyboard-navigable table, dialogs, form labels/aria, focus management.
- Full responsiveness (mobile card view ↔ desktop table).

## Documentation deliverables
- `README.md` — quickstart, env setup, scripts (dev/build/test/lint), architecture summary, feature tour.
- `docs/architecture/ARCHITECTURE.md` — system overview, BFF diagram (mermaid), data-flow sequence diagrams, tech choices, assumptions.
- `docs/architecture/SECURITY.md` — threat model + control mapping to the brief's security checklist.
- `docs/architecture/adr/` — short ADRs: (1) BFF/proxy pattern, (2) encrypted-cookie session, (3) TanStack Query + URL state, (4) Zod shared validation, (5) shadcn/ui.

## Testing (Vitest + RTL + MSW)
- Zod schemas (auth, invoice, query) — valid/invalid cases.
- BFF route handlers — token exchange, session sealing, list proxy, create mapping, auth/CSRF/rate-limit rejections (MSW mocks upstream).
- Components — InvoiceForm validation, InvoiceTable rendering, Filters/Pagination behavior.
- Session + upstream client helpers.
- Target a meaningful, representative suite (not 100% coverage theater) with a `test` + `test:coverage` script.

## Build order
1. Scaffold Next.js + TS + Tailwind v4 + shadcn/ui; ESLint/Prettier; `env.ts`; `.env.example`; Vitest+RTL+MSW config.
2. Security/session core: `session.ts`, `upstream.ts`, `csrf.ts`, `rate-limit.ts`, security headers, `middleware.ts`.
3. Auth: `/api/auth/*` routes + login page + `use-session` + route protection. Verify real login against sandbox.
4. Invoice list: `/api/invoices` GET proxy + list page + table/filters/pagination + `use-invoices`. Verify.
5. Create invoice: `/api/invoices` POST + form + mapping + confirmation. Verify end-to-end.
6. Tests across schemas/handlers/components; polish (skeletons, toasts, a11y, responsive).
7. Documentation (README + architecture + ADRs + SECURITY).

## Optional stretch (not in confirmed scope — pull in on request)
- Playwright E2E happy-path (login → list → create).
- Silent access_token auto-refresh.
- Dark mode, Dockerfile, GitHub Actions CI (lint/typecheck/test).

## Verification
- **Manual:** `npm run dev` → log in with the sandbox credentials from Appendix A of the brief → confirm redirect to invoice list → exercise search/sort/filter/paginate → create an invoice → confirm success toast + row appears. Confirm in browser devtools that **no upstream token or secret** appears in any client response, network payload to non-`/api` hosts, or JS bundle.
- **Automated:** `npm run lint && npm run typecheck && npm test` all green.
- **Security spot-check:** cookie is httpOnly + Secure + SameSite; response headers include CSP/HSTS/etc.; login endpoint rate-limits; malformed create payload rejected server-side.
