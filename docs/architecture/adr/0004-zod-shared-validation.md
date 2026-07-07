# ADR 0004 — Shared Zod schemas for client & server validation

**Status:** Accepted

## Context

The brief requires client‑side validation for good UX **and** server‑side validation for security. Duplicating rules in two places risks drift, where the client and server disagree about what is valid.

## Decision

Define each input contract **once** as a **Zod** schema in [`src/schemas`](../../../src/schemas) and reuse it on both sides:

- **Client:** `@hookform/resolvers/zod` wires the schema into react‑hook‑form for instant field errors.
- **Server:** the same schema `safeParse`s the request body/query in the Route Handler; failures become a `422` with a `{ field: message }` map ([`lib/zod-errors.ts`](../../../src/lib/zod-errors.ts)).

The list query schema uses coercion so it can validate raw `URLSearchParams` directly, with sensible defaults.

## Consequences

**Positive**

- **One source of truth** — client and server can never disagree about validity.
- Types are inferred from the schema (`z.infer`), so form values, API inputs and TypeScript types stay in lock‑step.
- Server validation is guaranteed even if a client is bypassed.

**Negative / trade‑offs**

- Zod adds a small runtime cost and bundle weight — negligible and well worth the safety.
- A subtle Zod detail (input vs. output types with `.default()`) required keeping one enum non‑defaulted so react‑hook‑form's resolver generics line up (documented in the schema).

## Alternatives considered

- **Separate client (e.g. yup) and server validators.** Rejected — invites drift and double maintenance.
- **Manual validation.** Rejected — verbose, error‑prone, and untyped.
