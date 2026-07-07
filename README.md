# SimpleInvoice

A production-minded invoicing web app built for the **101 Digital Web Engineer Assessment**. It lets a user sign in, browse/search/filter/paginate their invoices, and create new single‑line‑item invoices — all while keeping upstream credentials and tokens strictly on the server via a **Backend‑for‑Frontend (BFF)** architecture.

> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 + shadcn/ui · TanStack Query v5 · react‑hook‑form + Zod · iron‑session · Vitest + Testing Library + MSW.

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
- ♿ **Accessible & responsive** — labelled fields, `aria-*`, keyboard‑sortable columns, and a table‑to‑cards layout on mobile.
- 🧪 **50 unit/integration tests** across schemas, security helpers, the upstream client (MSW‑mocked), and components.

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

`.env.local` is git‑ignored; a committed [`.env.example`](.env.example) documents the shape.

---

## Available scripts

| Script                   | What it does                                     |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Start the dev server (Turbopack).                |
| `npm run build`          | Production build (fails on type/lint errors).    |
| `npm start`              | Serve the production build.                      |
| `npm run lint`           | ESLint.                                          |
| `npm run typecheck`      | `tsc --noEmit`.                                  |
| `npm test`               | Run the Vitest suite once.                       |
| `npm run test:watch`     | Vitest in watch mode.                            |
| `npm run test:coverage`  | Vitest with a V8 coverage report.                |
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
| Secrets hygiene                | `.env.local` + Postman env git‑ignored; `.example` templates committed          |

---

## Feature tour

- **Login** — client + server validated, friendly errors, encrypted session on success.
- **Invoice list (landing)** — debounced search, status filter, date‑range filter, sortable columns, page‑size selector and pagination; all reflected in the URL. Loading skeletons, empty and error states.
- **Create invoice** — grouped form (customer / details / line item), a live total preview (subtotal → tax → discount → total), an invoice‑number suggester, and a success toast + redirect on completion.
- **Session** — sign‑out clears the session and cached data; protected routes redirect unauthenticated users to login.

---

## Testing

50 tests run under Vitest with Testing Library and **MSW** (upstream calls are mocked, never hitting the network):

- **Schemas** — invoice + login + query validation and `computeInvoiceTotals`.
- **Security helpers** — CSRF token/origin checks, rate‑limit windows.
- **Upstream client** — request→payload mapping, response normalisation, and HTTP behaviours (token exchange, profile, list) via MSW.
- **Components** — login‑form validation & a11y, invoice table (loading/empty/rows), status badge, formatting.

```bash
npm test              # run once
npm run test:coverage # with coverage
```

---

## Project structure

```
src/
  app/
    (auth)/login/            Login screen (server component gate + client form)
    (app)/                   Authenticated shell (header, nav, logout)
      invoices/              Landing list  ·  invoices/new  Create form
    api/
      auth/{login,logout,session}/   Auth BFF routes
      invoices/                      List (GET) + Create (POST) BFF proxy
  components/
    ui/                      shadcn/ui primitives
    auth/  invoices/  layout/  Feature components
  hooks/                     TanStack Query + URL‑state hooks
  lib/                       env, session, upstream client, csrf, rate‑limit, http, format
  schemas/                   Zod schemas shared by client & server
  types/                     Domain & API types
  test/                      Vitest setup + MSW server
src/proxy.ts                 Edge proxy: auth routing + nonce CSP
```

---

## Documentation

- [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) — system overview, diagrams, data flows, trade‑offs.
- [`docs/architecture/SECURITY.md`](docs/architecture/SECURITY.md) — threat model and control mapping.
- [`docs/architecture/adr/`](docs/architecture/adr/) — Architecture Decision Records for the key choices.

---

## Assumptions & notes

- **Single line item per invoice**, per the brief. The form supports optional tax (%) and a fixed discount, mapped to upstream `extensions`.
- **Upstream `status`** arrives as an array of `{ key, value }` flags; the UI surfaces the first active flag (e.g. `Due`, `Overdue`).
- **Rate limiting** is in‑memory (per instance) — appropriate for this assessment; a shared store (e.g. Redis) would be used for multi‑instance production. This is called out in the security doc.
- The sandbox credentials in the brief are treated as **sensitive**: they live only in `.env.local` and the (git‑ignored) Postman environment. Committed `.example` files carry placeholders.
