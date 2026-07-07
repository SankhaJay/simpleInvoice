# ADR 0003 — TanStack Query + URL as the list state source

**Status:** Accepted

## Context

The invoice list needs search, status/date filtering, column sorting and pagination, backed by a server that returns one page at a time. We want a responsive, shareable experience and clean data fetching.

## Decision

- Use **TanStack Query v5** to fetch invoice pages from our BFF, with caching, loading/error states and `keepPreviousData` so the current page stays visible while the next loads.
- Keep **all list state in the URL query string** as the single source of truth. A small adapter hook ([`use-invoice-query-state`](../../../src/hooks/use-invoice-query-state.ts)) parses/validates the URL into a typed query and writes changes back.

## Consequences

**Positive**

- Every list view is **shareable and bookmarkable**; browser back/forward "just works".
- No bespoke client cache or reducer — Query handles dedupe, caching and refetch; the URL handles state.
- Filtering/pagination feels instant thanks to `keepPreviousData` and debounced search.

**Negative / trade‑offs**

- Two coordinated mechanisms (URL + Query cache) to reason about; mitigated by making the URL authoritative and deriving the Query key from it.
- Requires a `Suspense` boundary around the client list (Next.js `useSearchParams`), which we provide.

## Alternatives considered

- **RSC + Server Actions with `searchParams`.** Fewer client bytes, but interactive filtering feels less instant and is harder to unit‑test; the list is inherently interactive, so the client‑query approach fits better.
- **Local component state for filters.** Rejected — loses shareability and back/forward correctness.
