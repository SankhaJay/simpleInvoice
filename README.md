# SimpleInvoice

A production-minded invoicing web app built for the **101 Digital Web Engineer Assessment**. It lets a user sign in; browse, search, filter and paginate their invoices; view an invoice's full detail; create and duplicate single‑line‑item invoices; and see their profile — all while keeping upstream credentials and tokens strictly on the server via a **Backend‑for‑Frontend (BFF)** architecture.

> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 + shadcn/ui · TanStack Query v5 · react‑hook‑form + Zod · iron‑session · Vitest + Testing Library + MSW · Playwright.

---

## Table of contents

- [Highlights](#highlights)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [How it works](#how-it-works)
- [Security posture](#security-posture)
- [Feature tour](#feature-tour)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Assumptions & notes](#assumptions--notes)

---

## Highlights

- 🔐 **Server‑side token exchange** — the OAuth2 password grant runs only in a Route Handler. `client_id`/`client_secret` never reach the browser.
- 🛡️ **BFF proxy** — the browser talks _only_ to our own `/api/*` endpoints; the `access_token` and `org_token` never leave the server.
- 🍪 **Encrypted, httpOnly session** — tokens are AES‑sealed into an `iron-session` cookie (`httpOnly`, `Secure`, `SameSite=Lax`).
- ✅ **Validation everywhere** — one Zod schema validates each form on both the client (instant UX) and the server (source of truth).
- 🧷 **CSRF + rate limiting + strict CSP** — double‑submit token, same‑origin checks, login throttling, and a per‑request nonce Content‑Security‑Policy.
- 🔗 **URL‑driven list state** — search, filter, sort and pagination live in the query string, so every view is shareable and back‑button friendly.
- 🔁 **Self‑healing session** — the shared sandbox revokes tokens when anyone else logs in; the BFF silently refreshes and retries so the user is never kicked out.
- ♿ **Accessible & responsive** — labelled fields, `aria-*`, keyboard‑sortable columns, and a table‑to‑cards layout on mobile.
- 🧪 **91 unit/integration tests** (Vitest + Testing Library + MSW) plus a **9‑test Playwright end‑to‑end suite** running against a mocked upstream.

---

## Quick start

**Prerequisites:** Node.js ≥ 20 (developed on Node 22) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file and fill in the sandbox credentials
cp .env.example .env.local
#    then edit .env.local (see the table below)

# 3. Run the dev server
npm run dev
# → http://localhost:3000
```

Sign in with the sandbox credentials from the assessment brief (Appendix A). After login you land on the **invoice list**.

---

## Environment variables

All variables are **server‑only** (no `NEXT_PUBLIC_` prefix), so none are inlined into the client bundle. They are validated at startup by [`src/lib/env.ts`](src/lib/env.ts) — a misconfiguration fails fast with a precise message.

| Variable              | Required | Description                                                        |
| --------------------- | :------: | ------------------------------------------------------------------ |
| `AUTH_BASE_URL`       |    ✅    | 101 Digital identity server host (OAuth2 token endpoint).          |
| `API_BASE_URL`        |    ✅    | 101 Digital API gateway (membership‑service, invoice‑service).     |
| `OAUTH_CLIENT_ID`     |    ✅    | OAuth2 client id (sandbox).                                        |
| `OAUTH_CLIENT_SECRET` |    ✅    | OAuth2 client secret (sandbox). **Never committed.**               |
| `OAUTH_SCOPE`         |    –     | OAuth2 scope. Defaults to `openid`.                                |
| `SESSION_SECRET`      |    ✅    | ≥ 32‑char secret used to AES‑seal the session cookie. `openssl rand -base64 32`. |
| `SESSION_COOKIE_NAME` |    –     | Session cookie name. Defaults to `si_session`.                     |
| `LOGIN_RATE_LIMIT`    |    –     | Max login attempts per IP per minute. Defaults to `5`.             |

`.env.local` is git‑ignored; a committed [`.env.example`](.env.example) documents the shape. (`.env.example` also lists optional `E2E_USERNAME`/`E2E_PASSWORD` — fictional credentials the E2E mock accepts, not secrets.)

---

## Available scripts

| Script                   | What it does                                     |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Start the dev server (Turbopack).                |
| `npm run build`          | Production build (fails on type/lint errors).    |
| `npm start`              | Serve the production build.                      |
| `npm run lint`           | ESLint.                                          |
| `npm run typecheck`      | `tsc --noEmit`.                                  |
| `npm test`               | Run the Vitest unit/integration suite once.      |
| `npm run test:watch`     | Vitest in watch mode.                            |
| `npm run test:coverage`  | Vitest with a V8 coverage report.                |
| `npm run test:e2e`       | Playwright end-to-end tests (spins up app + mock upstream). |
| `npm run test:e2e:ui`    | Playwright in interactive UI mode.               |
| `npm run format`         | Prettier write.                                  |

---

## How it works

Every request from the browser goes to our own Next.js server, which is the only party that holds tokens and talks to 101 Digital.

```
┌─────────┐   fetch /api/*    ┌──────────────────────────┐   Bearer + org-token   ┌──────────────────┐
│ Browser │ ────────────────▶ │  Next.js BFF (Route       │ ─────────────────────▶ │ 101 Digital APIs │
│  (React)│ ◀──────────────── │  Handlers + Server Comps) │ ◀───────────────────── │ (identity, mem., │
└─────────┘  safe JSON only   │  iron-session (sealed)    │     invoice JSON       │  invoice service)│
                              │  Zod · CSRF · rate-limit  │                        └──────────────────┘
                              └──────────────────────────┘
```

**Login** (`POST /api/auth/login`): validate → rate‑limit → exchange credentials for an `access_token` → fetch the profile for the `org_token` (`memberships[0].token`) → seal both into the encrypted cookie → return only safe user fields.

**List** (`GET /api/invoices`): read the sealed session → attach `Bearer` + `org-token` → proxy the upstream list → normalise into a stable `{ items, pageNum, pageSize, totalRecords, totalPages }` page.

**Create** (`POST /api/invoices`): same‑origin + CSRF check → validate → map the flat form to the nested upstream body (single line item, `Operation-Mode: SYNC`) → proxy → return the created invoice number.

See [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) for full sequence diagrams and the rationale behind each choice.

---

## Security posture

This solution treats the assessment's security guidance as first‑class requirements. Full detail and a threat model are in [`docs/architecture/SECURITY.md`](docs/architecture/SECURITY.md); in brief:

| Control                        | Implementation                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Server‑side token exchange     | [`api/auth/login/route.ts`](src/app/api/auth/login/route.ts) + [`lib/upstream.ts`](src/lib/upstream.ts) |
| Secrets kept off the client    | Server‑only [`lib/env.ts`](src/lib/env.ts) with `import "server-only"`; no `NEXT_PUBLIC_*` |
| Encrypted, httpOnly session    | [`lib/session.ts`](src/lib/session.ts) (iron‑session, `httpOnly`/`Secure`/`SameSite`) |
| BFF proxy for all upstream I/O | [`api/invoices/route.ts`](src/app/api/invoices/route.ts)                        |
| Server‑side input validation   | Zod schemas in [`src/schemas`](src/schemas) reused by every route              |
| CSRF protection                | Double‑submit token + same‑origin checks — [`lib/csrf.ts`](src/lib/csrf.ts)     |
| Rate limiting                  | Login throttle — [`lib/rate-limit.ts`](src/lib/rate-limit.ts)                   |
| Security headers + CSP         | [`next.config.ts`](next.config.ts) + per‑request nonce CSP in [`src/proxy.ts`](src/proxy.ts) |
| Secrets hygiene                | `.env.local`, brief & Postman files git‑ignored; `.env.example` committed with placeholders |

---

## Feature tour

- **Login** — client + server validated, friendly errors, encrypted session on success.
- **Invoice list (landing)** — debounced search, status filter (Due / Overdue / Paid / Cancelled / Rejected), date‑range filter, sortable columns, page‑size selector and pagination; all reflected in the URL. Clickable rows plus a per‑row menu (view / duplicate). Loading skeletons, empty and error states; a table on desktop that collapses to cards on mobile.
- **Invoice detail** — `/invoices/{id}` shows the full record: line items with their adjustments, customer + billing address, bank account, documents, custom fields, and a totals breakdown (subtotal / tax / discount / paid / balance). Handles not‑found and error states.
- **Create invoice** — grouped form (customer / details / single line item) with a live total preview, plus optional collapsed sections (payee bank account, documents, invoice/item custom fields). The **invoice number is assigned by the backend**; on success a toast shows the assigned number and redirects to the list.
- **Duplicate invoice** — the row menu opens the create form pre‑filled from an existing invoice (fresh backend number, dates kept) to tweak and submit as a new one.
- **Profile** — read‑only account details (name, mobile, status, member‑since, organisation, role) with copy buttons for the user and organisation ids.
- **Session** — sign‑out clears the session and cached data; middleware redirects unauthenticated users to login; expired/revoked upstream tokens are refreshed transparently.

---

## Testing

Two layers, both runnable without any real credentials.

**Unit / integration** — Vitest + Testing Library + **MSW** (upstream calls mocked, never hitting the network):

- **Schemas** — invoice + login + query validation, `computeInvoiceTotals`, and the duplicate‑invoice mapper.
- **Security helpers** — CSRF token/origin checks, rate‑limit windows, silent token‑refresh recovery.
- **Upstream client** — request→payload mapping, response normalisation, and HTTP behaviours (token exchange, refresh, profile, list, detail) via MSW.
- **Components** — login‑form validation & a11y, invoice table (loading/empty/rows/navigation), status badge, copy button, formatting.

```bash
npm test              # run once
npm run test:coverage # with coverage
```

**End‑to‑end** — Playwright drives the **real app in a browser** (login, sealed session, CSRF, BFF, routing, forms), while a small local mock stands in for the 101 Digital upstream ([`e2e/mock-server.mjs`](e2e/mock-server.mjs)). This keeps the E2E suite deterministic, CI‑friendly and secret‑free — no real credentials, no sandbox pollution. The login rate limit is relaxed for the suite via `LOGIN_RATE_LIMIT` so each test can sign in.

- **Auth** — sign in, invalid credentials, route protection, sign out.
- **Invoices** — list, search, open detail, create end‑to‑end, and form validation.

```bash
npm run test:e2e      # headless
npm run test:e2e:ui   # interactive
```

**Continuous integration** — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the full gate on every push / PR to `main`: **lint → typecheck → unit tests → production build → E2E**. It needs no secrets (unit tests inject their own env; E2E uses the local mock upstream), and uploads the Playwright report as an artifact.

---

## Project structure

```
src/
  app/
    (auth)/login/            Login screen (server component gate + client form)
    (app)/                   Authenticated shell (header, avatar, logout)
      invoices/              Landing list
      invoices/new/          Create / duplicate form
      invoices/[id]/         Invoice detail
      profile/               Read-only profile
    api/
      auth/{login,logout,session}/   Auth BFF routes
      invoices/                      List (GET) + create (POST)
      invoices/[id]/                 Invoice detail (GET)
      profile/                       Profile (GET)
  components/
    ui/                      shadcn/ui primitives
    auth/ invoices/ layout/ profile/   Feature components
  hooks/                     TanStack Query + URL‑state hooks
  lib/                       env, session, upstream (+ upstream-auth refresh), csrf, rate‑limit, http, format
  schemas/                   Zod schemas shared by client & server
  types/                     Domain & API types
  test/                      Vitest setup + MSW server
  proxy.ts                   Edge proxy: auth routing + nonce CSP
e2e/                         Playwright specs + mock upstream server
```

---

## Documentation

- [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) — system overview, diagrams, data flows, trade‑offs.
- [`docs/architecture/SECURITY.md`](docs/architecture/SECURITY.md) — threat model and control mapping.
- [`docs/architecture/adr/`](docs/architecture/adr/) — Architecture Decision Records for the key choices.

---

## Assumptions & notes

- **Single line item per invoice**, per the brief.
- **Invoice number is not collected** — the backend generates and stores it. The create form omits it; the app supplies the per‑line `itemReference` the API still requires. (Confirmed against the API: a create with no `invoiceNumber` returns `201` with an assigned `IV…` number.)
- **Adjustments (`extensions`)** are a repeatable line‑item editor limited to **tax** or **discount** (the only names the API's payloads document), each with a direction (`ADD`/`DEDUCT`) and type (`FIXED_VALUE`/`PERCENTAGE`); a percentage is capped at 100. They map to **item‑level** `extensions`; rows without an amount are dropped, and the summary computes additions/deductions live.
- **Full payload coverage.** Beyond the essentials, the create form exposes the rest of the upstream payload through optional, collapsed‑by‑default sections — **bank account** (payee), **billing address** (inline in Customer), **documents**, and **invoice/item custom fields**. Each block is sent only when filled, so a minimal invoice stays minimal on the wire.
  - **Documents**: there is no document/upload service in the provided APIs, so the form captures a name + URL and the server generates the `documentId`.
  - **Bank account** is all‑or‑nothing because the API requires a non‑empty `bankId` whenever a bank block is present.
- **Status filter values** are `Due / Overdue / Paid / Cancelled / Rejected` — the exact set the invoice‑service accepts (it `400`s on anything else).
- **Upstream `status`** arrives as an array of `{ key, value }` flags; the UI surfaces the first active flag (e.g. `Due`, `Overdue`).
- **Upstream `customer`** comes in two shapes (`{ name }` or `{ firstName, lastName }`); the list normalises both to a single display name.
- **Rate limiting** is in‑memory (per instance) and configurable via `LOGIN_RATE_LIMIT` — appropriate for this assessment; a shared store (e.g. Redis) would be used for multi‑instance production. Called out in the security doc.
- The sandbox credentials in the brief are treated as **sensitive**: they live only in `.env.local`. The brief and the Postman collection/environment are git‑ignored; the committed `.env.example` carries placeholders. (Set up `.env.local` with the credentials from Appendix A of the brief.)
