# ADR 0005 — Tailwind CSS v4 + shadcn/ui for the component layer

**Status:** Accepted

## Context

The app must be professionally styled, fully responsive and accessible, without over‑investing in a bespoke design system for a focused assessment.

## Decision

Use **Tailwind CSS v4** for styling and **shadcn/ui** (Radix primitives) for interactive components (Button, Input, Select, Table, Dialog, etc.). shadcn components are copied into the repo under [`src/components/ui`](../../../src/components/ui) — we own the code rather than depending on a black‑box library.

## Consequences

**Positive**

- **Accessibility for free** — Radix handles focus management, keyboard interaction and ARIA for menus/selects/dialogs.
- **We own the components** — easy to read, tweak and audit; no runtime lock‑in.
- Consistent, themeable design via CSS variables (light/dark tokens defined), small runtime, first‑class responsive utilities.

**Negative / trade‑offs**

- More component code lives in the repo than with an off‑the‑shelf kit — offset by full control and transparency.
- Tailwind's utility classes are verbose in markup; mitigated by the `cn()` helper and small, well‑named components.

## Alternatives considered

- **Material UI (MUI).** Faster to assemble but heavier, more opinionated visually, and a black box to customise.
- **Hand‑rolled components + Tailwind only.** Maximum control but significant effort to make dialogs/selects/tables accessible — exactly what Radix already solves.
