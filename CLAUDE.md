# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                     # required on a fresh machine — node_modules is not checked in
pnpm dev                         # @jjj/web on :5173 (host: true, reachable over port-forward)
pnpm build                       # vite build (CI adds --base=/<repo>/ for GitHub Pages)
pnpm test                        # vitest run — whole workspace, no per-package config
pnpm typecheck                   # root tsconfig (covers tools/) + `pnpm -r exec tsc --noEmit`
pnpm data:check                  # parse every fixture under apps/web/public/data + rewrite manifest.json
pnpm data:check seattle-2026-10  # single fixture (accepts `_`-prefixed dirs)

pnpm vitest run packages/tripmd/test/patch.test.ts   # single test file
pnpm vitest run -t 'roundtrip'                       # single test by name
```

Full verification gate for any change: `pnpm typecheck && pnpm test && pnpm data:check && pnpm build`, then a Playwright screenshot pass checked by eye — including 390px phone width and both light and dark themes.

- Do **not** use `tsc -b` — every tsconfig is `noEmit`, so project references would fight it.
- Reading `pnpm test` output: check the `Test Files` line, not just `Tests N passed`. A suite that fails to collect still leaves the test count green.
- `pnpm add -w` prunes the sub-package `node_modules` links; run `pnpm install` afterwards.
- Playwright is not a dependency — screenshot checks run as ad-hoc scripts with `chromium.launch({ executablePath })`, so a new machine needs `npx playwright install chromium` first.

## Architecture

pnpm workspace, three packages:

| Package | Role |
|---|---|
| `packages/schema` (`@jjj/schema`) | zod `Trip` model, category/palette/time enums. No logic. |
| `packages/tripmd` (`@jjj/tripmd`) | `parse` (orchestrating `sections`/`blocks`/`days`/`lint`) / `serialize` / `applyPatch` / `summarize` / `toIcs` / `detailIndex` / `timelineDates` / value coercion |
| `apps/web` (`@jjj/web`) | Vite + React 19 + Tailwind v4 + HashRouter |

**Hub-and-spoke.** The zod `Trip` object is the hub; TripMD text round-trips through `parse()`/`serialize()`. Semantic idempotence — `parse(serialize(parse(md))) === parse(md)` — is pinned by [roundtrip.test.ts](packages/tripmd/test/roundtrip.test.ts). Every write goes `applyPatch` → `serialize` → re-`parse`; **the parser is the only validator**.

**Single artifact, no JSON layer.** The browser fetches `plan.md` and parses it in place ([MarkdownTripRepository.ts](apps/web/src/data/MarkdownTripRepository.ts), ~20ms/trip). There is no export/import step to forget. `tools/check.ts` is purely a CI gate plus `manifest.json` maintenance.

**Data access has exactly one seam:** the `TripRepository` interface, injected in [main.tsx](apps/web/src/main.tsx). Views never learn where data comes from; a future HTTP backend is a one-line swap there.

### TripMD

`docs/TRIPMD_SPEC.md` is authoritative — its section order *is* the canonical file order, and `serialize` emits in that order (constraints → transports → stays → rentals → places → days).

- **Three front-loaded blocks** — ` ```trip-transports ` (long-haul), ` ```trip-stays `, ` ```trip-rentals `. All detail (times, platform, `cost`, terms) is declared once up front; `what` is unique across all three.
- **`detail:` is the only pointer.** Events carry `detail: <name>`; writing `transport:`/`stay:`/`lodging:` on an event is a migration error. The **first reference in date order** (not authoring order — this is what makes round-tripping idempotent) renders the full info module / ticket timeline; later references are plain mentions and dedupe in the stay/transport filter views. The scan lives once in [resolve.ts](packages/tripmd/src/resolve.ts) (`detailIndex`) — parser, web modules and budget all consume the same index.
- **Money:** front-block `cost` counts toward the budget (long-haul on first-reference day, stays on check-in, rentals on pick-up); event `cost` is only for on-the-spot items. One implementation in [budget.ts](apps/web/src/lib/budget.ts), shared by the budget page and month view.
- **Times are input, dates are derived** — never infer a day rollover from duration across time zones.
- **Date arithmetic always goes through `@jjj/tripmd`'s UTC-anchored helpers** (`addDays` / `daysBetween` / `mondayIndex`). Bare `new Date(iso)` is banned.
- **Diagnostics are loud by design:** misspelled field → warning + suggestion, dangling reference → error + suggestion, unreferenced front-block record → warning. Silently dropping data is a bug. The `_broken` fixture pins this.

Fixtures in `apps/web/public/data/`: `seattle-2026-10` (real trip, stress test) · `_example` (minimal) · `_demo` (every feature, **dev-only**) · `_broken` (must fail `data:check`). `_`-prefixed dirs stay out of `manifest.json` and CI deletes them from `dist/` before publishing.

### Web app

```
apps/web/src/
  lib/        pure functions: layout / calendar-grid / week-axis / lanes / budget / format /
              derive / segment-durations / day-bars (all unit-tested) + settings / palette /
              time / maplink / useScrollSpy / useMediaQuery (DOM-bound, untested)
  features/   view-specific: trip-list (home + settings sheet) / itinerary / calendar / budget / reference
  components/ only what ≥2 views share: CategoryChip / CompositionBar / Segmented / Markdown /
              RailLayout / States
```

**Layout math lives in pure functions with tests; components only draw.** This is a hard rule. When adding such a test, verify it fails against a deliberately broken formula before trusting it green. `apps/web/src/**/*.test.ts` is auto-collected by the root vitest run.

**Settings** are read/written only through [settings.ts](apps/web/src/lib/settings.ts) (localStorage `jjj:settings`: theme tri-state / palette overrides / rentalBand). Application — injecting CSS variables, stamping `data-theme` — happens in one `subscribeSettings` handler in `main.tsx`. Components change settings; they never apply them.

**Theming:** new components consume switchable tokens only (`.tint-*`, `--t-*`, `--grp-cur`, paired `kindVars`). Never write a component-level `@media (prefers-color-scheme)` block, never use Tailwind's `dark:` variant, and never inline a single-mode color — all three break forced themes (`data-theme`). In `styles/index.css` light/dark values are paired inline via `light-dark()`; non-color tokens derive from the single `--dark` 0/1 flag — there is no duplicated dark block to keep in sync.

**Never write `*/` inside a CSS comment** (e.g. `--g-*/--a-*`) — it terminates the comment early, 500s the dev server, and is silently swallowed by `build`. Write `--g-* 与 --a-*`.

Routing is HashRouter (`/#/trip/seattle-2026-10/list`) so static hosting needs no rewrites. Views: list ✓ calendar ✓ info ✓ budget ✓ — **map is the unbuilt fifth**.

## Conventions

- **Chinese** for conversation, UI copy, and code comments. **English, single-line** for commit messages: `feature|fix|refactor|docs: description`. Large changes split into logical commits may add short bullets — verify each block compiles and tests independently (in a scratch copy) before splitting.
- **Never run git write operations** (add/commit/push/checkout). Hand Harley a pasteable command; he runs it. Read-only git is fine.
- Integrate deeply rather than patching. Before adding a feature, look for duplication to converge first; prefer a net deletion over a fourth layer of patches.

## Backlog

Map view (foundations exist: place coordinates + outlier detection, `day.color` / `DAY_COLORS`, `legs.geometry` polyline slot, `gmaps_place_id`) → wire up `toIcs()` (written, no UI entry) → render `trip-constraints` (parsed, never displayed; the week view is the natural home) → edit mode on `applyPatch` → agent authoring pipeline (`docs/AUTHORING_PROMPT.md`).

`docs/HANDOVER.md` holds the cross-machine handover state; `docs/superpowers/specs/2026-08-04-calendar-view-design.md` records every deviation between the calendar design and its implementation, with reasons.
