# Strategy Route Broadcast Redesign — Design Spec

**Date:** 2026-04-19
**Workstream:** v1.1 Frontend Redesign, Phase 1 (`/strategy`)
**Scope:** Visual redress of the existing `/strategy` route (pre-race, live race, post-race phases) to the new Broadcast pit-wall aesthetic sourced from `new-designs/`.
**Revision:** r2 (incorporates spec-review findings 2026-04-19)

---

## 1. Purpose

The `/strategy` route is the game's most visually dense surface: pre-race setup, live race command center, and post-race results all live here. It currently uses the retired **Kinetic Command** design system (lime/cyan accents, rounded glass panels). The user produced a new reference design set (`new-designs/*.html + app.css + pages.css`) in a **Broadcast TV pit-wall aesthetic** — oklch-based dark palette, JetBrains Mono–heavy typography, signal-red primary, sharp 2px corners, and layered surface tones.

This spec defines a **visual redress plus targeted layout regrouping** of the existing Strategy surfaces. No gameplay logic, engine, store, worker, or persistence change is in scope. The redesign follows the Broadcast reference with precision while dropping design elements that would require new backend data.

## 2. Non-Goals

- No new routes. The `/strategy` single-route multi-phase FSM stays frozen.
- No engine, worker, store, type, or persistence changes. `FullGameState` shape is untouched.
- No new gameplay features. Design elements that require data we don't compute are dropped (see §7).
- No retirement of Kinetic Command yet. Other pages (Paddock, Factory, Driver Office, Financial HQ, Calendar, Regulations) stay on Kinetic Command in this pass. Tokens are organized so they can migrate later without rework.

## 3. Success Criteria

- Every existing Strategy component renders in the Broadcast aesthetic with no functional regression.
- `/strategy` visually matches the reference HTML (`Strategy Pre-Race.html`, `Strategy Planner.html`, `Strategy Page.html`, `Strategy Post-Race.html`). Minimum two screenshot-comparison rounds per component; continue until remaining mismatches are minimal (per `CLAUDE.md` Screenshot Review Workflow).
- Paddock, Factory, Driver Office, and other non-Strategy routes render identically to their current state.
- `npx tsc --noEmit`, `npx vitest run`, and `npm run lint` pass green at each rollout step.
- HTTP 200 on `/strategy` after each step.

## 4. Architecture — Token System & Theme

### 4.1 File Layout (Actual Paths)

Current state (ground truth):
- `src/styles/tokens.css` — the only token file today, defines `:root` and `.high-contrast`.
- `src/app/globals.css` — global entry, consumed by `src/app/layout.tsx`.
- `src/app/layout.tsx` — already loads `Space Grotesk`, `Inter`, **and `JetBrains Mono`** via Next.js font loader (lines 2, 20–24, 33).

Target state after step 1:

```
src/styles/
├── tokens.css                   # MODIFIED — becomes a pure @import switchboard
└── themes/
    ├── kinetic.css              # NEW — current Kinetic tokens moved here verbatim + .high-contrast override block preserved inside
    └── broadcast.css            # NEW — Broadcast pit-wall tokens ported from new-designs/app.css, including terminal/editorial variants as dead [data-theme] blocks
```

`src/app/globals.css` and `src/app/layout.tsx` remain untouched as entry points.

### 4.2 Theme Attribute Cascade

- `:root` keeps the Kinetic token set as default (preserves current look for all pages on day one).
- `[data-theme="kinetic"]` — explicit alias, mirrors `:root`. Used for future migration flexibility.
- `[data-theme="broadcast"]` — the new Broadcast palette.
- `[data-theme="terminal"]` and `[data-theme="editorial"]` — preserved as dead CSS blocks inside `broadcast.css` (reference designs include them). **Not exposed in any UI surface this phase.** They exist only so a future phase can activate them without a migration — if the user decides to drop them entirely, they come out in a later phase spec.
- `.high-contrast` override block stays inside `kinetic.css` alongside the Kinetic tokens. A Broadcast-specific high-contrast override is **out of scope** for this phase and flagged as future work (see §11).

### 4.3 Theme Application

- `src/components/layout/page-shell.tsx` currently has `PageShellProps = { children: ReactNode }`. Extend to:

  ```ts
  interface PageShellProps {
    children: ReactNode
    theme?: 'kinetic' | 'broadcast'  // default: 'kinetic'
  }
  ```

- When `theme` is set, `PageShell` renders `data-theme={theme}` on its outermost `<div>`. Theme cascades through CSS variables — no component-level conditionals.
- `src/app/strategy/page.tsx` contains **six** `PageShell` call sites (grep-verified lines 178, 215, 230, 253, 279, 391 — error branch, loading branch, management phase branch, start-race branch, race phase branch, default fallback). **Every one** of these gets `theme="broadcast"`. Missing any single site causes Kinetic chrome to wrap Broadcast content in the skipped phase.
- All non-Strategy pages inherit `:root` (Kinetic). Their `PageShell` calls are unchanged.

### 4.4 Tailwind Integration

**Key constraint (reviewer finding H1):** `tailwind.config.ts` today exposes these buckets against the existing Kinetic tokens:

```
bg.{primary, secondary, surface}
border.{default, hover}
accent.{lime, cyan, red, amber, purple}
text.{primary, secondary, muted, dim}
fontFamily.{heading, body, mono}
```

These are used extensively outside `/strategy` (Paddock, Factory, Driver Office, etc.) and **must remain functional** throughout this phase. The migration strategy is:

**Dual-write during transition.** The new Broadcast bindings are **added** alongside the existing ones, under new namespaces that do not collide:

```ts
colors: {
  // ─── Existing Kinetic bindings — PRESERVED, consumed by non-Strategy pages ───
  bg:     { primary, secondary, surface },         // existing
  border: { default, hover },                      // existing
  accent: { lime, cyan, red, amber, purple },     // existing
  text:   { primary, secondary, muted, dim },     // existing

  // ─── New Broadcast bindings — ADDED, consumed only by Strategy components ───
  surface: { void, base, paper, raised, hi },     // new — was bg.{void,...} but renamed to avoid bg.* collision
  line:    { hair, sub, strong },                 // new
  ink:     { dim, mute, body, hi },               // new
  sig:     { red, redDk, amber, green, cyan, purple, pink },  // new
  c:       { soft, med, hard, inter, wet },       // new
}
```

Each new binding resolves via `var(--surface-paper)` etc., and those CSS variables are defined under both `[data-theme="kinetic"]` (with Kinetic palette mappings, e.g. `--surface-paper: var(--bg-surface)`) and `[data-theme="broadcast"]` (with true Broadcast values). This means **old Tailwind classes (`bg-bg-surface`) keep working on Kinetic pages** and **new Tailwind classes (`bg-surface-paper`) work on both** (showing Kinetic-ish colors on Kinetic pages, Broadcast colors on Strategy).

**Cleanup path (out of scope for this phase):** once every page migrates to Broadcast in a later v1.1 phase, the old `bg.*`, `border.*`, `accent.*`, `text.*` buckets are removed in a single cleanup commit. This spec does not schedule that commit.

**Rename note:** `bg.{void,base,paper,raised,hi}` from the Broadcast design is rebound to `surface.*` in our Tailwind config specifically to avoid colliding with the existing `bg.{primary,secondary,surface}` bucket. CSS-variable names (`--bg-paper`, etc.) retain their original Broadcast names for clarity when reading against the reference HTML.

### 4.5 Fonts

**No change.** `src/app/layout.tsx` lines 20–24 already load `JetBrains_Mono` with `variable: '--font-mono'`, and `tokens.css` line 19 already defines `--font-mono: 'JetBrains Mono', monospace`. `tailwind.config.ts` already exposes `font-mono`. The Broadcast design uses the same three fonts already wired; **no font-loader work is required**.

### 4.6 Token Surface (Ported from `new-designs/app.css`)

| Category | CSS variables | Notes |
|---|---|---|
| Surface | `--bg-void`, `--bg-base`, `--bg-paper`, `--bg-raised`, `--bg-hi` | Ported verbatim |
| Lines | `--line-hair`, `--line-sub`, `--line-strong` | Ported verbatim |
| Ink | `--ink-dim`, `--ink-mute`, `--ink-body`, `--ink-hi` | Ported verbatim |
| Signal | `--sig-red`, `--sig-red-dk`, `--sig-amber`, `--sig-green`, `--sig-cyan`, `--sig-purple`, `--sig-pink` | Ported verbatim |
| Tire compounds | `--c-soft`, `--c-med`, `--c-hard`, `--c-inter`, `--c-wet` | Ported verbatim |
| Radius | `--rad: 2px` (broadcast) / matches current value (kinetic) | Literal `2px` per `new-designs/app.css:44` |

Typography variables (`--font-display`, `--font-body`, `--font-mono`) already exist as `--font-heading`, `--font-body`, `--font-mono` — Broadcast uses the same three. `broadcast.css` adds the alias `--font-display: var(--font-heading)` to match the reference CSS without renaming globals.

## 5. Component Mapping

### 5.1 Pre-Race Phase

`StrategyPlanner` is currently consumed **inside** `PreRaceSetup` (`src/components/strategy/pre-race-setup.tsx:11,227`). **The tabs live inside `PreRaceSetup`**, preserving the existing prop flow (`onSelectStrategies` → parent page). No state hoisting to `src/app/strategy/page.tsx`. This is an explicit Pipeline B discipline choice.

| Existing component | Reference design | Action |
|---|---|---|
| `src/components/strategy/pre-race-setup.tsx` | `Strategy Pre-Race.html`: `.session-row`, `.prog-grid`, `.setup-grid` + local tab scaffold | **Adapt.** Session row → `.session-card` (done/active/pending). Programs grid → `.prog-card` (Race Pace / Quali Sim / Tire Test / Setup). Setup sliders → `.setup-track` with mid-tick and fill gradient. Adds internal tab state (local `useState`, no store field) to switch between Sessions & Programs / Setup / Intel / Planner. |
| `src/components/strategy/race-intel-panel.tsx` | `Strategy Pre-Race.html` intel cards + `Strategy Intel.html` charts (partial) | **Adapt.** Restyle existing intel tiles in Broadcast panel aesthetic. For any tile that already renders a deg curve, weather widget, or pace card, adopt `.chart-curve.s/m/h`, `.rain-chart` styling. Skip anything not already rendered. Rendered inside the Intel tab of `PreRaceSetup`. |
| `src/components/strategy/strategy-planner.tsx` | `Strategy Planner.html`: `.gantt-row`, `.planner-title-card` | **Adapt.** Keep per-driver strategy picker. Render each driver's chosen plan as one `.gantt-row`. Drop: undercut simulator, 4 alternative plans with confidence %, risk tags. Rendered inside the Planner tab of `PreRaceSetup`. |
| (optional) qualifying grid | `Strategy Pre-Race.html`: `.pre-grid-strip`, `.quali-wrap` | **Conditional.** Only if a qualifying grid is already rendered in the pre-race view. If absent, the pre-race hero remains the round-name + driver-roster grid with no gap. Verified during planning (§11). |

**Pre-Race layout:**

```
Top command bar + flag strip + ticker  (shared chrome — see §6)
─────────────────────────────────────
.pre-left (round name + stats)  |  .pre-drivers (player roster)
─────────────────────────────────────
[ Sessions & Programs | Setup | Intel | Planner ]   (tabs: local useState)
  → selected tab content
─────────────────────────────────────
.btn-primary "ADVANCE TO QUALIFYING / START RACE →"
```

### 5.2 Live Race Phase — Restyle **and** Layout Regrouping

Reviewer finding H3: this is not a pure restyle. Current live view composes `CircuitMap` as a full-width hero above a 3-column grid. Broadcast design reorganizes into a narrower 3-column grid with `CircuitMap` + `TireStrategy` stacked in the center column and `GapChart` folded into a collapsible row.

| Existing component | Reference design | Action | Relocated? |
|---|---|---|---|
| `src/components/strategy/race-status-bar.tsx` | `.topbar` (brand + stats + sim controls) | **Keep & restyle.** 1:1 field mapping. | No |
| `src/components/strategy/sim-speed-control.tsx` | `.sim-group` + `.sim-btn` | **Keep & restyle.** | No |
| `src/components/strategy/race-ticker.tsx` | `.flag-strip` + `.ticker-track` | **Keep & restyle.** | No |
| **NEW** `src/components/strategy/hero-strip.tsx` | `.hero` grid (`.lap-card` \| `.broadcast` \| `.gap-next`) | **Build.** Composed from existing race state (current lap, leader driver + team, gap to next). Client Component. No new data fields. | New |
| `src/components/strategy/circuit-map.tsx` | `.track`, `.track-svg`, `.car-dot` | **Keep & restyle.** SVG circuit data unchanged. | **Moved** to center-top of main grid (was full-width hero). |
| `src/components/strategy/timing-tower.tsx` | `.timing` / `.timing-row` | **Keep & restyle.** Fields map directly. | **Moved** to left column alone (was paired with GapChart). |
| `src/components/strategy/tire-strategy.tsx` | `.strategy-grid`, `.strategy-driver`, `.sd-tire`, `.sd-wear-bar` | **Keep & restyle.** Per-driver tire cards. | **Moved** to center-bottom under `CircuitMap` (was column 2). |
| `src/components/strategy/driver-commands.tsx` | `.cmd-grid`, `.cmd-btn.attack/conserve`, `.radio-line` | **Keep & restyle.** | Right column (unchanged relative position). |
| `src/components/strategy/battle-forecast.tsx` | `.battles`, `.battle` | **Keep & restyle.** | **Moved** to right column (was column 3 top). |
| `src/components/strategy/commentary-feed.tsx` | `.feed`, `.feed-item`, `.feed-tag` (OVERTAKE / PIT / INFO / BATTLE / FASTEST) | **Keep & restyle.** Badge colors map to existing event types. | Right column. |
| `src/components/charts/gap-chart.tsx` | (no direct equivalent in design) | **Keep.** Restyle axes and grid lines only. **Moved** to collapsible row below main grid. Toggle state is local `useState` in the page (no store field). | **Moved** to secondary row. |

**Live Race layout:**

```
Shared chrome: Top command bar + flag strip + ticker  (§6)
─────────────────────────────────────
Hero strip: 360px .lap-card | flex .broadcast | 300px .gap-next
─────────────────────────────────────
Main grid (460px | flex | 380px):
  Left:   TimingTower
  Center: CircuitMap (top)
          TireStrategy (bottom, 2-driver grid)
  Right:  DriverCommands
          BattleForecast
          CommentaryFeed
─────────────────────────────────────
Secondary row: GapChart (collapsed by default; toggle via local useState)
```

Responsive: main grid shrinks to `420px | flex | 360px` under 1400px, collapses to single column under 1200px (mirrors reference design breakpoints).

### 5.3 Post-Race Phase

| Existing component | Reference design | Action |
|---|---|---|
| `src/components/strategy/post-race-results.tsx` | `Strategy Post-Race.html`: `.post-hero`, `.post-podium`, `.post-table`, `.fastest-card`, `.stint-analysis`, `.standings-wrap` | **Adapt.** Podium (top 3), classification table, purple fastest-lap card. **Stint analysis bars** — conditional on per-stint compound+laps being available; likely dropped (see §7 and §11). **Standings swing rows** — conditional on championship delta being computed; verified during planning. |

**Post-Race layout:**

```
Shared chrome: Flag strip (RED marker)  (§6)
─────────────────────────────────────
.post-wrap (flex | 360px sidebar):
  Left:  .post-hero + podium + .post-table (classification)
  Right: .fastest-card (purple) + .post-card standings delta
─────────────────────────────────────
.stint-analysis (one row per driver — conditional, see §11)
─────────────────────────────────────
.btn-primary "CONTINUE TO MANAGEMENT →"
```

**Fallback if stint analysis drops:** post-wrap's sidebar widens to 400px and the classification table takes the full left column. No visual gap.

**Fallback if standings swing drops:** the right sidebar contains only the fastest-lap card; a "Championship snapshot" tile with current driver/constructor standings is shown in its place (data already computed).

## 6. Shared Chrome

The top command bar (`.topbar` + `.flag-strip`) is shared by Live Race and Post-Race. Extracted into:

**`src/components/strategy/broadcast-chrome.tsx`** — a new `'use client'` component that composes `RaceStatusBar`, `SimSpeedControl`, `RaceTicker`. Prop contract:

```ts
interface BroadcastChromeProps {
  phase: 'race' | 'sprint' | 'post-race'
  flagStatus?: 'green' | 'yellow' | 'sc' | 'vsc' | 'red' | 'chequered'
  // pass-through props for RaceStatusBar / SimSpeedControl / RaceTicker
  // (enumerated in the implementation plan, not here)
}
```

The existing inline composition at `src/app/strategy/page.tsx:281-299` is replaced by `<BroadcastChrome ... />`. No behavior change — handlers still dispatch via the existing store actions.

## 7. Explicit Data Boundaries (Drop List)

Design elements that require backend data we don't compute. Dropped silently — no placeholders, no mock data, no "coming soon" copy.

| Dropped element | Reason |
|---|---|
| Hub landing page (`new-designs/index.html`) | No matching route; navigation is via existing Paddock + side nav |
| Undercut / Overcut simulator (sliders + SVG projection) | Engine does not compute pit-stop delta projections |
| 4 alternative pit plans with confidence % and risk tag | Engine returns one chosen plan per driver |
| Cliff markers on tire deg curves ("S CLIFF L12") | Per-compound cliff lap not exposed in race state |
| 90-minute rain radar (area chart over minutes) | Weather model coarser than minute-by-minute |
| Competitor pace delta chart | Not a computed metric |
| Track evolution / grip % gauge | Not computed |
| Qualifying elimination brackets with sector-delta bars | Conditional on pre-race view already rendering qualifying; verified in §11 |
| Championship standings delta bars | Conditional on post-race computing pre-vs-post points delta; verified in §11 |
| Per-stint analysis bars | Conditional on per-stint compound+laps being tracked; grep shows no `stints` / `stintCompounds` field in `src/types/race.ts`, so **likely dropped**; verified in §11 |
| Three-theme toggle UI (broadcast / terminal / editorial switcher) | Alternate themes preserved as dead CSS, not user-visible |
| Broadcast-specific `.high-contrast` override | Accessibility override exists only for Kinetic today; Broadcast equivalent deferred to a future phase |

**Kept — data verified by grep:**
- Pit-banner diagonal label. Backed by `pitted: boolean` (`src/types/race.ts:49`) and `pitLap: number` (`src/types/race.ts:60`).
- Per-driver single strategy plan rendered as one Gantt row (data flows from `StrategyPlanner`'s existing `DriverStrategies` shape).
- Tire wear bar and fuel bar (both tracked in race state, confirmed via existing `TireStrategy` component rendering them today).
- Commentary feed with tagged event badges (event types exist in current feed data).

## 8. Testing Strategy

- **Visual correctness:** screenshot review per `CLAUDE.md` Frontend Rules. For each restyled component: render reference HTML locally, render target route via `npm run dev`, compare in **minimum two rounds** — continue until remaining mismatches are minimal, then stop.
- **Regression coverage:** existing unit, store, hook, and component tests stay green with zero rewrites. No engine, store, or worker change is in scope, so no test changes are expected at the data layer.
- **Per-step verify gates** (AGENTS.md Pipeline B):
  - `npx tsc --noEmit` (type-check)
  - `npx vitest run` (full test suite)
  - `npm run lint` (ESLint)
  - HTTP 200 probe on `/strategy` after each step
  - **Additional: Tailwind class-usage audit.** For each Strategy component touched in a step, grep within `src/components/strategy/` and `src/app/strategy/` for any remaining old-bucket class names (`bg-bg-primary`, `bg-bg-secondary`, `bg-bg-surface`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-dim`, `border-border-default`, `border-border-hover`, `bg-accent-*`). Any hit means an unmigrated reference. (Reviewer finding M4.)
  - **Additional: Kinetic route snapshot comparison** after step 1. Take a screenshot of Paddock + Factory + Driver Office before step 1 and after step 1; byte-level diff. Any drift means tokens leaked across the theme boundary.
- **Scope-violation tripwire:** if any component restyle requires a store, engine, worker, or type change, stop and reassess. UI redress must not cross that boundary.

## 9. Rollout Plan

Five sequential commits. Each is a `ui-interface` → `verify` pipeline (AGENTS.md Pipeline B). Each step names its verify gates explicitly.

### Step 1 — Tokens + theme plumbing (no theme activation yet)

- Create `src/styles/themes/kinetic.css`, move existing Kinetic tokens from `src/styles/tokens.css` into it (preserving `.high-contrast` block).
- Create `src/styles/themes/broadcast.css` with Broadcast palette + dead `[data-theme="terminal|editorial"]` blocks.
- Convert `src/styles/tokens.css` to a pure `@import "./themes/kinetic.css"; @import "./themes/broadcast.css";` switchboard.
- Extend `tailwind.config.ts` with the new `surface.*`, `line.*`, `ink.*`, `sig.*`, `c.*` bindings alongside existing ones (dual-write per §4.4).
- Add `theme?: 'kinetic' | 'broadcast'` prop to `PageShell`. Apply `data-theme` attribute when set.
- **Critical: `/strategy` does NOT yet pass `theme="broadcast"` in this step** (reviewer finding M3). Theme flag activation is deferred to step 2 to avoid rendering Strategy with broken variables between steps.

Verify gates: `tsc --noEmit`, `vitest run`, `lint`, HTTP 200 on `/strategy` and one non-Strategy route (e.g. `/paddock`), Kinetic-route snapshot diff (Paddock/Factory/Driver Office must match byte-for-byte).

### Step 2 — Shared chrome + theme activation

- Create `src/components/strategy/broadcast-chrome.tsx` (Client Component).
- Restyle `RaceStatusBar`, `SimSpeedControl`, `RaceTicker` using new Broadcast Tailwind classes.
- Build `src/components/strategy/hero-strip.tsx` (also Client Component, composed from existing race state).
- **Activate `theme="broadcast"` on all six `PageShell` instances in `src/app/strategy/page.tsx`.**
- The pre-race and post-race phases will still render unrestyled components inside the new chrome — this is an acceptable intermediate state because subsequent steps restyle them, and the Tailwind class-usage audit in verify gates flags it loudly per page.

Verify gates: as above, plus Tailwind class audit on touched components, screenshot review against reference `.topbar + .flag-strip`.

### Step 3 — Live Race view

Restyle and regroup: `TimingTower`, `CircuitMap`, `TireStrategy`, `DriverCommands`, `BattleForecast`, `CommentaryFeed`, `GapChart` (collapsible row). Apply new layout grid per §5.2.

Verify gates: as above, plus two-round screenshot comparison of `/strategy` during race phase against `Strategy Page.html`.

### Step 4 — Pre-Race view

Add internal tab scaffold inside `PreRaceSetup`. Restyle `PreRaceSetup`, `RaceIntelPanel`, `StrategyPlanner`. Resolve qualifying-grid open question (§11).

Verify gates: as above, plus two-round screenshot comparison against `Strategy Pre-Race.html` and `Strategy Planner.html`.

### Step 5 — Post-Race view

Restyle `PostRaceResults` with podium, classification, fastest-lap card. Resolve stint-analysis and standings-swing open questions (§11). Apply fallback layouts if either drops.

Verify gates: as above, plus two-round screenshot comparison against `Strategy Post-Race.html`.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Unmigrated old Tailwind classes silently resolve against new theme's CSS-variable aliases and render "plausible but wrong" | Grep-based class audit in every verify step (see §8). Leaks are not visually obvious, so must be caught syntactically |
| Token extraction from current `tokens.css` into `kinetic.css` introduces a regression on non-Strategy pages | Kinetic-route snapshot diff in step 1 verify gate. Any drift fails the step |
| Step 1's dual-write Tailwind config doubles the production CSS bundle temporarily | Measured once post-step 1. Dual-write is bounded to this phase; cleanup commit in later v1.1 phase removes old buckets |
| `StrategyPlanner` prop flow breaks when tabs are introduced inside `PreRaceSetup` | Tabs are local state inside `PreRaceSetup`; `onSelectStrategies` callback flow unchanged. Explicitly test pre-race → race transition after step 4 |
| Broadcast skip-link styling still references `--accent-lime` (Kinetic token) | Address in step 2 when `PageShell` prop is wired: make the skip-link class use `var(--sig-amber)` when `data-theme="broadcast"` is active. Verify WCAG 4.5:1 contrast against Broadcast focus background. See §11 |
| Reference HTML uses React 18 UMD + Babel standalone; our app is React 19 + TypeScript | Reference files are visual source material, not consumed at runtime. All translation is manual Tailwind-class authoring. No runtime dependency on `new-designs/` |
| Dropped design elements confuse reviewers ("where's the undercut sim?") | §7 is the authoritative drop list; referenced in every PR description |

## 11. Open Questions for Implementation Plan

Resolved during planning, not in this spec. Each names the fallback for a "no" answer:

1. **Does the pre-race view already render a qualifying results grid?**
   Fallback if no: skip the `.pre-grid-strip` / `.quali-wrap` visuals. Pre-race hero keeps the round-name + driver-roster grid.
2. **Does `PostRaceResults` (or race results shape in `FullGameState`) track per-stint compound + lap counts?**
   Grep of `src/types/race.ts` found no `stints` / `stintCompounds` / `perStint` field. Likely dropped. Fallback: see §5.3 "Fallback if stint analysis drops."
3. **Is championship delta (pre-race vs post-race points, rank change) computed after each race?**
   Fallback if no: see §5.3 "Fallback if standings swing drops."
4. **Does `RaceIntelPanel` currently render a tire deg curve, weather widget, or pace tile?**
   If yes → adopt Broadcast chart styling for each. If no → the Intel tab becomes simpler existing-data cards only.
5. **Broadcast-specific high-contrast override** — does the user want one this phase, or defer?
   Spec defaults to defer. Confirm with user during plan review.
6. **Skip-link contrast under Broadcast theme** — which Broadcast token passes WCAG 4.5:1 against the focus background?
   Verified during step 2 implementation; may require a token-pair selection.

## 12. References

- Reference design source: `new-designs/index.html`, `Strategy Pre-Race.html`, `Strategy Planner.html`, `Strategy Page.html`, `Strategy Intel.html`, `Strategy Post-Race.html`
- Reference CSS: `new-designs/app.css` (tokens + shared chrome), `new-designs/pages.css` (per-phase component styles)
- Project rules: `CLAUDE.md` §Frontend Website Rules, `AGENTS.md` §0 Architecture, §1 `ui-interface` agent, §2 Pipeline B
- Related memory: `project_frontend_redesign.md` (v1.1 workstream), `project_ip08.md` (frozen architecture boundary this redesign sits atop)
- Key file verifications (from spec-review r1):
  - `src/app/layout.tsx:20-24` — JetBrains Mono already loaded
  - `src/styles/tokens.css:19` — `--font-mono` already defined
  - `tailwind.config.ts:8-30` — existing Kinetic bucket bindings
  - `src/app/strategy/page.tsx:178,215,230,253,279,391` — six `PageShell` instances
  - `src/components/strategy/pre-race-setup.tsx:11,227` — `StrategyPlanner` consumed here, not in page
  - `src/types/race.ts:49,60` — `pitted: boolean`, `pitLap: number` back the pit-banner
