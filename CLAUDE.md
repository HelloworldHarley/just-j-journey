# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                     # required on a fresh machine — node_modules is not checked in
pnpm dev                         # @jjj/web on :5173 (host: true, reachable over port-forward)
pnpm build                       # vite build (CI adds --base=/<repo>/ for GitHub Pages)
pnpm test                        # vitest run — whole workspace, no per-package config
pnpm typecheck                   # root tsconfig (covers tools/) + `pnpm -r exec tsc --noEmit`
pnpm data:check                  # parse every fixture under apps/web/public/data + rewrite manifest.json + emit calendar.ics per trip
pnpm data:check seattle-2026-10  # single fixture (accepts `_`-prefixed dirs)

pnpm enrich <dir>                    # real road routes → <dir>/geometry.json (needs ORS_API_KEY)
pnpm enrich <dir> --geocode          # geocode the missing coords, print the list, write nothing
pnpm enrich <dir> --geocode --apply  # after review, write the coords back into plan.md

pnpm vitest run packages/tripmd/test/patch.test.ts   # single test file
pnpm vitest run -t 'roundtrip'                       # single test by name
```

Full verification gate for any change: `pnpm typecheck && pnpm test && pnpm data:check && pnpm build`, then a Playwright screenshot pass checked by eye — including 390px phone width and both light and dark themes.

**Touching the map? Run `pnpm check:built`, not just `pnpm dev`.** Dev loads maplibre straight from `node_modules`; the build inlines it into a hashed chunk, and the two resolve its web worker differently — that gap left the live map showing pins on a blank canvas from the day it shipped until 2026-08-20. `vite preview` hides it too (its SPA fallback answers a missing asset with 200 + index.html, where GitHub Pages 404s). [check-built.ts](tools/check-built.ts) builds at the CI base path into `dist-check/`, then asserts structurally (worker asset exists, its relative imports resolve, a chunk holds its URL — the two historical failure modes, replayed and confirmed red) and, when Chromium + playwright-core are findable (`JJJ_CHROMIUM` / `JJJ_PLAYWRIGHT` to point at them), boots the page on a no-fallback static server and asserts a web worker starts and tiles are requested; missing browser prints an explicit SKIP, never a false green. Do **not** assert by reading canvas pixels — a WebGL canvas without `preserveDrawingBuffer` reads back blank and gives you a false failure.

- Do **not** use `tsc -b` — every tsconfig is `noEmit`, so project references would fight it.
- Reading `pnpm test` output: check the `Test Files` line, not just `Tests N passed`. A suite that fails to collect still leaves the test count green.
- `pnpm add -w` prunes the sub-package `node_modules` links; run `pnpm install` afterwards.
- Playwright is not a dependency — screenshot checks run as ad-hoc scripts with `chromium.launch({ executablePath })`, so a new machine needs `npx playwright install chromium` first.

## Architecture

pnpm workspace, three packages:

| Package | Role |
|---|---|
| `packages/schema` (`@jjj/schema`) | zod `Trip` model, category/palette/time enums. No logic. |
| `packages/tripmd` (`@jjj/tripmd`) | `parse` (orchestrating `sections`/`blocks`/`days`/`lint`) / `serialize` / `applyPatch` / `summarize` / `toIcs` / `detailIndex` / `missingCoords` / `timelineDates` / `geometry` / value coercion |
| `apps/web` (`@jjj/web`) | Vite + React 19 + Tailwind v4 + HashRouter |

**Hub-and-spoke.** The zod `Trip` object is the hub; TripMD text round-trips through `parse()`/`serialize()`. Semantic idempotence — `parse(serialize(parse(md))) === parse(md)` — is pinned by [roundtrip.test.ts](packages/tripmd/test/roundtrip.test.ts). Every write goes `applyPatch` → `serialize` → re-`parse`; **the parser is the only validator**.

**Single artifact, no JSON layer.** The browser fetches `plan.md` and parses it in place ([MarkdownTripRepository.ts](apps/web/src/data/MarkdownTripRepository.ts), ~20ms/trip). There is no export/import step to forget. `tools/check.ts` is purely a CI gate plus `manifest.json` maintenance.

**Two derived files live next to `plan.md`; neither is ever the truth.** `calendar.ics` is the calendar subscription feed: `data:check` regenerates it from plan.md on every run (CI runs that before build, so pushing main updates subscribers on their next poll), it is gitignored (free to rebuild — not worth DTSTAMP-churn diffs), and the 资料 view offers subscribe/copy/download via one `toIcs` ([CalendarExport.tsx](apps/web/src/features/reference/CalendarExport.tsx), links from [calendar-link.ts](apps/web/src/lib/calendar-link.ts)). Beware: event UIDs ride the parser's position-based ids, so inserting an event mid-day shifts later UIDs — fine for subscriptions (the feed replaces wholesale), duplicates on repeated manual imports.

**The second, and it is a cache:** `geometry.json` next to `plan.md` holds pre-computed road polylines (`pnpm enrich` writes it; routing APIs forbid runtime batching). plan.md stays the only truth — every record carries the endpoint coords it was computed from, and **anything that doesn't line up is discarded**: no file, bad JSON, unknown version, drifted coords, undecodable polyline → that leg falls back to the dashed straight line it always drew. Never let a derived cache fail a trip load. One implementation of those rules in [geometry.ts](packages/tripmd/src/geometry.ts), consumed by the repository, `tools/enrich.ts` and the `data:check` health line. Design and reasons: `docs/superpowers/specs/2026-08-13-enrich-pipeline-design.md`.

**Data access has exactly one seam:** the `TripRepository` interface, injected in [main.tsx](apps/web/src/main.tsx). Views never learn where data comes from; a future HTTP backend is a one-line swap there.

### TripMD

`docs/TRIPMD_SPEC.md` is authoritative — its section order *is* the canonical file order, and `serialize` emits in that order (constraints → transports → stays → rentals → places → days).

- **Three front-loaded blocks** — ` ```trip-transports ` (long-haul), ` ```trip-stays `, ` ```trip-rentals `. All detail (times, platform, `cost`, terms) is declared once up front; `what` is unique across all three.
- **`detail:` is the only pointer.** Events carry `detail: <name>`; writing `transport:`/`stay:`/`lodging:` on an event is a migration error. The **first reference in date order** (not authoring order — this is what makes round-tripping idempotent) renders the full info module / ticket timeline; later references are plain mentions and dedupe in the stay/transport filter views. The scan lives once in [resolve.ts](packages/tripmd/src/resolve.ts) (`detailIndex`) — parser, web modules and budget all consume the same index.
- **Money:** front-block `cost` counts toward the budget (long-haul on first-reference day, stays on check-in, rentals on pick-up); event `cost` is only for on-the-spot items. One implementation in [budget.ts](apps/web/src/lib/budget.ts), shared by the budget page and month view.
- **A day starts where you woke up.** ` ```trip-day `'s `from_stay:` is the opening commute (same shape as `to_next`); the origin is never written — `stayOfMorning(stays, date)` claims it from the `trip-stays` interval on **dates only** (`from.date < date ≤ to.date`), which excludes arrival day and includes check-out morning for free. It lands as the day's first `Leg` with `afterEventId: null`, so **every consumer that indexes legs by `afterEventId` must filter null first** (serialize, `buildTimeline`, `dayPaths`, the slack lint). The list draws one commute row before the first card — **never an extra event card**; the map makes the stay stop #1. Missing when it should be there → warning (`lintDayOpening`).
- **Times are input, dates are derived** — never infer a day rollover from duration across time zones.
- **Date arithmetic always goes through `@jjj/tripmd`'s UTC-anchored helpers** (`addDays` / `daysBetween` / `mondayIndex`). Bare `new Date(iso)` is banned.
- **Diagnostics are loud by design:** misspelled field → warning + suggestion, dangling reference → error + suggestion, unreferenced front-block record → warning. Silently dropping data is a bug. The `_broken` fixture pins this.

Fixtures in `apps/web/public/data/`: `seattle-2026-10` (real trip, stress test) · `_example` (minimal) · `_demo` (every feature, **dev-only**) · `_broken` (must fail `data:check`). `_`-prefixed dirs stay out of `manifest.json` and CI deletes them from `dist/` before publishing. The same directory holds `space.md` (the personal-space profile card; `data:check` validates it and the files it references) and `manifest.json` in the shape `{trips:[{id, visibility}]}`. `JJJ_DATA_DIR=<dir>` points every tool and the vite build at another data directory (the `jjj:data-dir` plugin serves it in dev and copies it into `dist/data` at build).

### Web app

```
apps/web/src/
  lib/        pure functions: layout / calendar-grid / week-axis / lanes / budget / format /
              derive / segment-durations / day-bars / map-scene (all unit-tested) + settings /
              palette / time / maplink / useScrollSpy / useMediaQuery (DOM-bound, untested)
  features/   view-specific: trip-list (home + settings sheet) / itinerary / calendar / map /
              budget / reference
  components/ only what ≥2 views share: CategoryChip / CompositionBar / Segmented / Markdown /
              MapLinkButton / RailLayout / States
```

**Layout math lives in pure functions with tests; components only draw.** This is a hard rule. When adding such a test, verify it fails against a deliberately broken formula before trusting it green. `apps/web/src/**/*.test.ts` is auto-collected by the root vitest run.

**Settings** are read/written only through [settings.ts](apps/web/src/lib/settings.ts) (localStorage `jjj:settings`: theme tri-state / palette overrides / rentalBand). Application — injecting CSS variables, stamping `data-theme` — happens in one `subscribeSettings` handler in `main.tsx`. Components change settings; they never apply them.

**Theming:** new components consume switchable tokens only (`.tint-*`, `--t-*`, `--grp-cur`, paired `kindVars`). Never write a component-level `@media (prefers-color-scheme)` block, never use Tailwind's `dark:` variant, and never inline a single-mode color — all three break forced themes (`data-theme`). In `styles/index.css` light/dark values are paired inline via `light-dark()`; non-color tokens derive from the single `--dark` 0/1 flag — there is no duplicated dark block to keep in sync.

**Never write `*/` inside a CSS comment** (e.g. `--g-*/--a-*`) — it terminates the comment early, 500s the dev server, and is silently swallowed by `build`. Write `--g-* 与 --a-*`.

Routing is HashRouter (`/#/trip/seattle-2026-10/list`) so static hosting needs no rewrites. All five views are built: list ✓ calendar ✓ map ✓ info ✓ budget ✓ — **every view route is lazy-loaded**, so the shell carries none of their dependencies (maplibre-gl rides with the map chunk, react-markdown with the shared one).

The map (MapLibre GL + OpenFreeMap tiles) makes **zero API calls at runtime** — tiles are static, and every road route is pre-computed offline by `pnpm enrich`. A leg with geometry draws **solid**, one without draws **dashed**; that difference is deliberately visible, so the casing under it is dash-matched too (maplibre's `line-dasharray` is in line-width units, not pixels — widen the casing and you must shrink the dash values to match; `dashCasing()`). The bottom-right chip switches the whole scene between road geometry and stop-to-stop straight lines (`straightSegments()`, every segment `real: false` — the mode has no true/estimated split to show). Switching only calls `setData` on each day's source: no layer rebuild (flicker) and **no refit** (the camera must not jump on every toggle). A day's route is usually a loop (leave the hotel, come back to it — first and last stop share one coordinate), so a **checkered start flag** is planted into that day's pin #1: deliberately not the pin's shape or palette, `startFlagOffset()` tracks the pin's own cluster offset and bites into it so there is no seam, and it only stands while a single day is selected — five flags on the all-days view is noise. Direction arrows ride a per-day `symbol` layer (`symbol-placement: 'line'`, one every 105px) over the same source, so **both modes get them for free** and maplibre rotates each one along the line — the icon must therefore be drawn **pointing right**, since that is its 0°. The icon is a canvas image added via `map.addImage`, never a Unicode triangle: text symbols need the basemap style's glyph pack, which the offline paper fallback does not have.

**maplibre's tile worker must be handed to it explicitly:** `setWorkerUrl(workerUrl)` with `import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'`. maplibre otherwise derives the path at runtime from `import.meta.url` (a computed string no bundler can see), so the file never lands in `dist` and every tile silently fails to parse. `?worker&url` and not `?url`: that worker imports `maplibre-gl-shared.mjs`, so it has to be *bundled* as a worker (~470KB), not copied as one file. The OSM attribution is collapsed to its compact ⓘ at startup (it ships *expanded*, eating a full 351px row on a phone) — collapse it only after attributions settle, or MapLibre re-expands it. Marker opacity must go through `marker.setOpacity()`; writing `element.style.opacity` is silently overwritten on every redraw. See `docs/superpowers/specs/2026-08-11-map-view-design.md` for these and the other overlay rules.

## Conventions

- **Chinese** for conversation, UI copy, and code comments. **English, single-line** for commit messages: `feature|fix|refactor|docs: description`. Large changes split into logical commits may add short bullets — verify each block compiles and tests independently (in a scratch copy) before splitting.
- **Never run git write operations** (add/commit/push/checkout). Hand Harley a pasteable command; he runs it. Read-only git is fine.
- Integrate deeply rather than patching. Before adding a feature, look for duplication to converge first; prefer a net deletion over a fourth layer of patches.

## In progress (half-finished, committed as `wip:` on 2026-09-11)

**Personal space + public sharing**, migration step 1 of `docs/superpowers/specs/2026-09-09-personal-space-sharing-design.md`. Tasks 1–6 of 11 are done and reviewed (`visibility` frontmatter, manifest `{trips:[{id,visibility}]}`, `space.md` profile + home-page header + tips sheet, `JJJ_DATA_DIR` via the `jjj:data-dir` vite plugin + `tools/lib`, `sanitize` whitelist, `findLeaks`); Task 7 (public-build UI hides 待填 / calendar export) has code in the tree but no review; Tasks 8–11 (`pnpm build:public`, `_showcase`, CI + data-repo workflow template + `docs/PUBLISHING.md`, docs) are not started. Resume from the 进度 table at the top of `docs/superpowers/plans/2026-09-09-personal-space-sharing.md`; the spec's 实现记录 lists every deviation. Rule learned this round: synthetic fixtures/tests must never contain a value from the real seattle trip — the repo is public. Development moved to Harley's local machine; on the shared EC2, close every dev/preview port when done.

## Backlog

Render `trip-constraints` (parsed, never displayed; the week view is the natural home; Harley has deferred this — edit mode comes first) → edit mode on `applyPatch` — two paths side by side, hand the data to an agent to improve *and* edit by hand; **filling in missing coordinates belongs to that round**, not to a write path of its own (the map's "N places missing coords" chip is read-only today, and `saveTrip?` on `TripRepository` is still an unimplemented Phase-6 stub). Full five-milestone plan: `docs/superpowers/specs/2026-08-21-edit-mode-design.md` → agent authoring pipeline (`docs/AUTHORING_PROMPT.md`).

`seattle-2026-10` is fully enriched: 0 places missing coords, 28 of its 32 legs on real road geometry (the other 4 are rail/monorail — no public line geometry, dashed by design). For another trip: `--geocode` → review the list → `--apply` → re-run `pnpm enrich <dir>`; `ORS_API_KEY` lives in the repo-root `.env`.

**Process docs live in the repo** (since 2026-09-02; they were briefly local-only). `docs/HANDOVER.md` is the cross-machine handover snapshot — update it at the end of a round of work. `docs/superpowers/specs/` holds per-round design + implementation records, including every deviation and its reason; when a design decision looks odd, its spec's 实现记录 section usually explains it. Product specs are `TRIPMD_SPEC` / `AUTHORING_PROMPT` / `archive/`.
