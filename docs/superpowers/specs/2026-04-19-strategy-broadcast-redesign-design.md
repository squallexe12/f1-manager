# Strategy Route Broadcast Redesign — Design Spec

**Date:** 2026-04-19
**Workstream:** v1.1 Frontend Redesign, Phase 1 (`/strategy`)
**Scope:** Visual redress of the existing `/strategy` route (pre-race, live race, post-race phases) to the new Broadcast pit-wall aesthetic sourced from `new-designs/`.
**Status:** Approved by user; ready for implementation plan.

---

## 1. Purpose

The `/strategy` route is the game's most visually dense surface: pre-race setup, live race command center, and post-race results all live here. It currently uses the retired **Kinetic Command** design system (lime/cyan accents, rounded glass panels). The user produced a new reference design set (`new-designs/*.html + app.css + pages.css`) in a **Broadcast TV pit-wall aesthetic** — oklch-based dark palette, JetBrains Mono–heavy typography, signal-red primary, sharp 2px corners, and layered surface tones.

This spec defines a **pure visual redress** of the existing Strategy surfaces. No gameplay logic, engine, store, worker, or persistence change is in scope. The redesign adheres to the Broadcast reference designs with precision while dropping design elements that would require new backend data.

## 2. Non-Goals

- No new routes. The `/strategy` single-route multi-phase FSM stays frozen.
- No engine, worker, store, or type changes. `FullGameState` shape is untouched.
- No new gameplay features. Design elements that require data we don't compute are dropped (see §7).
- No retirement of Kinetic Command yet. Other pages (Paddock, Factory, Driver Office, Financial HQ, Calendar, Regulations) stay on Kinetic Command in this pass. Theme tokens are organized so those pages can migrate later without rework.

## 3. Success Criteria

- Every existing Strategy component renders in the Broadcast aesthetic with no functional regression.
- `/strategy` visually matches the reference HTML (`new-designs/Strategy Pre-Race.html`, `Strategy Planner.html`, `Strategy Page.html`, `Strategy Post-Race.html`) within two comparison rounds per component.
- Paddock, Factory, and other non-Strategy routes render identically to their current state (Kinetic Command unchanged).
- `npx tsc --noEmit`, `npx vitest run`, and `npm run lint` pass green at each rollout step.
- HTTP 200 on `/strategy` after each step.

## 4. Architecture — Token System & Theme

### 4.1 File Layout

```
src/styles/
├── globals.css                  # Existing entry — adds import of themes/tokens.css at top
├── themes/
│   ├── tokens.css               # NEW — switchboard keyed by [data-theme]
│   ├── kinetic.css              # NEW — current Kinetic Command tokens extracted verbatim
│   └── broadcast.css            # NEW — new Broadcast pit-wall tokens (ported from new-designs/app.css)
└── base.css                     # Existing base resets — unchanged
```

### 4.2 Theme Attribute Cascade

- `:root` defaults to the Kinetic Command token set (preserves current look for all pages on day one).
- `[data-theme="kinetic"]` — explicit Kinetic Command palette (for future migration flexibility).
- `[data-theme="broadcast"]` — the new Broadcast palette, ported 1:1 from `new-designs/app.css`.
- `[data-theme="terminal"]` and `[data-theme="editorial"]` — defined in `broadcast.css` as the reference design's alternate variants; **not exposed in the UI** for this phase. Preserved for future theme toggling without code changes.

### 4.3 Theme Application

- `PageShell` (`src/components/layout/page-shell.tsx`) accepts a new optional prop `theme?: 'kinetic' | 'broadcast'` (default: `'kinetic'`).
- When set, `PageShell` applies `data-theme={theme}` to its outermost `<div>`. Theme cascades through CSS variables — no component-level conditionals.
- The `/strategy` page (`src/app/strategy/page.tsx`) passes `theme="broadcast"`.
- All other pages are unchanged; they inherit `:root` (Kinetic Command) by default.

### 4.4 Tailwind Integration

Extend `tailwind.config.ts` `theme.extend.colors` to reference CSS variables so utility classes resolve against whichever theme is active:

```ts
colors: {
  bg: {
    void:   'var(--bg-void)',
    base:   'var(--bg-base)',
    paper:  'var(--bg-paper)',
    raised: 'var(--bg-raised)',
    hi:     'var(--bg-hi)',
  },
  line: { hair: 'var(--line-hair)', sub: 'var(--line-sub)', strong: 'var(--line-strong)' },
  ink:  { dim: 'var(--ink-dim)', mute: 'var(--ink-mute)', body: 'var(--ink-body)', hi: 'var(--ink-hi)' },
  sig:  { red: 'var(--sig-red)', 'red-dk': 'var(--sig-red-dk)', amber: 'var(--sig-amber)',
          green: 'var(--sig-green)', cyan: 'var(--sig-cyan)', purple: 'var(--sig-purple)', pink: 'var(--sig-pink)' },
  c:    { soft: 'var(--c-soft)', med: 'var(--c-med)', hard: 'var(--c-hard)',
          inter: 'var(--c-inter)', wet: 'var(--c-wet)' },
}
```

Extend `fontFamily` similarly (`display`, `body`, `mono` referencing `var(--font-display)`, etc.) and `borderRadius` for `rad: 'var(--rad)'`.

No `@apply` in component files. Components use Tailwind utility classes directly (e.g. `bg-bg-paper text-ink-hi border-line-sub rounded-rad`).

### 4.5 Fonts

Add **JetBrains Mono** to the Next.js font loader in `src/app/layout.tsx` alongside the existing Space Grotesk + Inter. Exposed as CSS variable `--font-mono`. No external `<link>` to Google Fonts — stays consistent with existing Next.js font loading pattern.

### 4.6 Token Surface (Ported from `new-designs/app.css`)

| Category | Variables |
|---|---|
| Surface | `--bg-void`, `--bg-base`, `--bg-paper`, `--bg-raised`, `--bg-hi` |
| Lines | `--line-hair`, `--line-sub`, `--line-strong` |
| Ink | `--ink-dim`, `--ink-mute`, `--ink-body`, `--ink-hi` |
| Signal | `--sig-red`, `--sig-red-dk`, `--sig-amber`, `--sig-green`, `--sig-cyan`, `--sig-purple`, `--sig-pink` |
| Tire compounds | `--c-soft`, `--c-med`, `--c-hard`, `--c-inter`, `--c-wet` |
| Typography | `--font-display` (Space Grotesk), `--font-body` (Inter), `--font-mono` (JetBrains Mono) |
| Radius | `--rad` (2px in broadcast, matches current value in kinetic) |

## 5. Component Mapping

### 5.1 Pre-Race Phase

| Existing component | Reference design | Action |
|---|---|---|
| `src/components/strategy/pre-race-setup.tsx` | `Strategy Pre-Race.html`: `.session-row`, `.prog-grid`, `.setup-grid` | **Adapt.** Session row → `.session-card` (done/active/pending). Programs grid → `.prog-card` (Race Pace / Quali Sim / Tire Test / Setup). Setup sliders → `.setup-track` with mid-tick and fill gradient. |
| `src/components/strategy/race-intel-panel.tsx` | `Strategy Pre-Race.html` intel cards + `Strategy Intel.html` charts (partial) | **Adapt.** Restyle existing intel tiles in Broadcast panel aesthetic. If an intel tile already renders a deg curve / weather widget, adopt `.chart-curve.s/m/h` and `.rain-chart` styling. Skip anything not already rendered. |
| `src/components/strategy/strategy-planner.tsx` | `Strategy Planner.html`: `.gantt-row`, `.planner-title-card` | **Adapt.** Keep per-driver strategy picker. Render each driver's chosen plan as one `.gantt-row`. Drop: undercut simulator, 4 alternative plans with confidence %, risk tags. |
| (optional) qualifying grid | `Strategy Pre-Race.html`: `.pre-grid-strip`, `.quali-wrap` | **Conditional.** Only if a qualifying grid is already rendered in the pre-race view. Verify during planning; drop if absent. |

**Pre-Race layout** — tabs inside the pre-race view (local React state, no store/route change):

```
Top command bar + flag strip + ticker
─────────────────────────────────────
.pre-left (round name + stats)  |  .pre-drivers (player roster)
─────────────────────────────────────
[ Sessions & Programs | Setup | Intel | Planner ]
  → selected tab content
─────────────────────────────────────
.btn-primary "ADVANCE TO QUALIFYING / START RACE →"
```

### 5.2 Live Race Phase

| Existing component | Reference design | Action |
|---|---|---|
| `src/components/strategy/race-status-bar.tsx` | `.topbar` (brand + stats + sim controls) | **Keep & restyle.** 1:1 field mapping. |
| `src/components/strategy/sim-speed-control.tsx` | `.sim-group` + `.sim-btn` | **Keep & restyle.** |
| `src/components/strategy/race-ticker.tsx` | `.flag-strip` + `.ticker-track` | **Keep & restyle.** |
| **NEW** `hero-strip.tsx` | `.hero` grid (`.lap-card` \| `.broadcast` \| `.gap-next`) | **Build.** Composed from existing race state: current lap, leader driver + team, gap to next. No new data. |
| `src/components/strategy/circuit-map.tsx` | `.track`, `.track-svg`, `.car-dot` | **Keep & restyle.** Strokes, dots, kerbs move to Broadcast tokens. SVG circuit data unchanged. |
| `src/components/strategy/timing-tower.tsx` | `.timing` / `.timing-row` | **Keep & restyle.** Fields (pos, team bar, code, name, gap, last lap, status) map directly. |
| `src/components/strategy/tire-strategy.tsx` | `.strategy-grid`, `.strategy-driver`, `.sd-tire`, `.sd-wear-bar` | **Keep & restyle.** Per-driver tire cards. |
| `src/components/strategy/driver-commands.tsx` | `.cmd-grid`, `.cmd-btn.attack/conserve`, `.radio-line` | **Keep & restyle.** |
| `src/components/strategy/battle-forecast.tsx` | `.battles`, `.battle` (two-driver + gap column) | **Keep & restyle.** |
| `src/components/strategy/commentary-feed.tsx` | `.feed`, `.feed-item`, `.feed-tag` (OVERTAKE / PIT / INFO / BATTLE / FASTEST) | **Keep & restyle.** Badge colors map to existing event types. |
| `src/components/charts/gap-chart.tsx` | (no direct equivalent) | **Keep.** Restyle axes + grid lines to Broadcast tokens. Fold into collapsed-by-default row below main grid. |

**Live Race layout**:

```
Top command bar + flag strip + ticker
─────────────────────────────────────
Hero strip: 360px lap-card | flex broadcast-leader | 300px gap-next
─────────────────────────────────────
Main grid (460px | flex | 380px):
  Left:   TimingTower
  Center: CircuitMap (top) + TireStrategy (bottom, 2-driver grid)
  Right:  DriverCommands + BattleForecast + CommentaryFeed
─────────────────────────────────────
GapChart (collapsed row, optional toggle)
```

Responsive: main grid shrinks to `420px | flex | 360px` under 1400px, collapses to single column under 1200px — mirrors reference design breakpoints.

### 5.3 Post-Race Phase

| Existing component | Reference design | Action |
|---|---|---|
| `src/components/strategy/post-race-results.tsx` | `Strategy Post-Race.html`: `.post-hero`, `.post-podium`, `.post-table`, `.fastest-card`, `.stint-analysis`, `.standings-wrap` | **Adapt.** Podium (top 3), classification table, purple fastest-lap card. **Stint analysis bars** — include only if per-stint compound + lap counts are already available in race results. **Standings swing rows** — include only if championship delta is computed. Verify both during planning. |

**Post-Race layout**:

```
Flag strip (RED marker)
─────────────────────────────────────
.post-wrap (flex | 360px sidebar):
  Left:  .post-hero + podium + .post-table (classification)
  Right: .fastest-card (purple) + .post-card standings delta
─────────────────────────────────────
.stint-analysis (one row per driver — conditional)
─────────────────────────────────────
.btn-primary "CONTINUE TO MANAGEMENT →"
```

## 6. Shared Chrome

The Top command bar (`.topbar` + `.flag-strip` pair) is shared by Live Race and Post-Race. It is extracted into a shared layout wrapper within the pre-race/live/post-race views so styling stays consistent.

`RaceStatusBar`, `SimSpeedControl`, and `RaceTicker` are the three components that compose this chrome. They are restyled once and consumed by both phase views.

## 7. Explicit Data Boundaries (Drop List)

Design elements that require backend data we don't compute. These are dropped silently — no placeholders, no mock data, no "coming soon" copy.

| Dropped element | Reason |
|---|---|
| Hub landing page (`new-designs/index.html`) | No matching route in our app; navigation is via existing Paddock + side nav |
| Undercut / Overcut simulator (sliders + SVG projection) | Engine does not compute pit-stop delta projections |
| 4 alternative pit plans with confidence % and risk tag | Engine returns one chosen plan per driver |
| Cliff markers on tire deg curves ("S CLIFF L12") | Per-compound cliff lap not exposed |
| 90-minute rain radar (SVG area chart of rain probability over minutes) | Weather model is coarser than minute-by-minute |
| Competitor pace delta chart | Not a computed metric |
| Track evolution / grip % gauge | Not computed |
| Qualifying elimination brackets with sector-delta bars | Conditional; kept only if already rendered |
| Championship standings delta bars (pre vs post points, rank change) | Conditional; kept only if already computed post-race |
| Three-theme toggle UI (broadcast / terminal / editorial switcher) | Alternate themes preserved in CSS but not exposed in UI |

**Kept because data exists:**
- Pit-banner diagonal label (in-pit flag exists in race state)
- Per-driver single strategy plan (as one Gantt row)
- Tire wear bar and fuel bar (both tracked)
- Commentary feed with tagged event badges (event types exist)

## 8. Testing Strategy

- **Visual correctness:** manual screenshot review per CLAUDE.md rule. For each restyled component, render the reference HTML locally, render the target route locally via `npm run dev` + HTTP 200 probe, compare in at least two rounds, fix mismatches.
- **Regression coverage:** existing unit, store, and hook tests stay green with zero rewrites. No engine, store, or worker change is in scope, so no test changes are expected.
- **Gates per rollout step:**
  - `npx tsc --noEmit` (type-check)
  - `npx vitest run` (full test suite)
  - `npm run lint` (ESLint)
  - HTTP 200 probe on `/strategy`
- **Scope-violation tripwire:** if any component restyle requires a store or engine change, stop and reassess. A UI redress must not cross that boundary. This is the AGENTS.md Pipeline B discipline.

## 9. Rollout Plan

Five sequential commits. Each is a `ui-interface` → `verify` pipeline (AGENTS.md Pipeline B).

1. **Tokens + theme plumbing.** Add `src/styles/themes/{tokens.css, kinetic.css, broadcast.css}`. Extend Tailwind config. Add `theme` prop to `PageShell`. Add JetBrains Mono to `src/app/layout.tsx`. `/strategy` passes `theme="broadcast"`. Visual state after this commit is transitional: new tokens applied, components still use old class names. Acceptable as an intermediate state because all downstream commits restyle on top.
2. **Shared chrome restyle.** Restyle `RaceStatusBar`, `SimSpeedControl`, `RaceTicker`. Build new `hero-strip.tsx` (reused by live race).
3. **Live Race view restyle.** Restyle `TimingTower`, `CircuitMap`, `TireStrategy`, `DriverCommands`, `BattleForecast`, `CommentaryFeed`, `GapChart`. Apply new layout grid from §5.2.
4. **Pre-Race view restyle.** Add tab scaffold inside pre-race view. Restyle `PreRaceSetup`, `RaceIntelPanel`, `StrategyPlanner`. Verify qualifying grid scope.
5. **Post-Race view restyle.** Restyle `PostRaceResults` with podium, classification, stint bars, standings delta. Verify stint and standings scope.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tailwind utility classes using old Kinetic colors leak into restyled components and look wrong | Every Strategy component gets a complete class audit during its restyle step; Tailwind extension names (`bg-paper`, `ink-hi`, `sig-red`) don't overlap with existing Kinetic class names, so leaks are visually obvious |
| Token extraction from current global CSS introduces a Kinetic regression on non-Strategy pages | First rollout commit is limited to adding new token files + wiring `PageShell` prop. Existing global CSS stays. Kinetic tokens are extracted in the same commit but the `:root` default preserves them. A full snapshot of Paddock + Factory + Driver Office is taken before and compared after this commit |
| JetBrains Mono font loading adds measurable page weight | Next.js font loader defers and self-hosts; already proven pattern with Space Grotesk + Inter. Measure bundle delta post-step 1 |
| Dropped design elements confuse reviewers ("where's the undercut sim?") | This spec's §7 is the authoritative drop list — referenced in every PR description |
| Design HTML uses React 18 UMD + Babel standalone; our app is React 19 + TypeScript | Design files are reference material, not consumed directly. All visual translation is manual: read reference CSS + JSX, write new Tailwind classes in our components. No runtime dependency on the `new-designs/` folder |

## 11. Open Questions for Implementation Plan

These are verified during the implementation plan, not in this spec:
- Does the current pre-race view already render a qualifying results grid? (Determines whether §5.1 "qualifying grid" row is kept or dropped.)
- Does `PostRaceResults` already track per-stint compound + laps? (Determines whether stint analysis bars are included.)
- Is championship delta (pre vs post points) computed after each race? (Determines whether standings swing rows are included.)
- Does `RaceIntelPanel` currently render a tire deg curve, weather widget, or pace tiles? (Determines which Intel Desk chart styling is adopted.)

## 12. References

- Reference design: `new-designs/index.html`, `Strategy Pre-Race.html`, `Strategy Planner.html`, `Strategy Page.html`, `Strategy Intel.html`, `Strategy Post-Race.html`
- Reference CSS: `new-designs/app.css` (tokens + shared chrome), `new-designs/pages.css` (per-phase component styles)
- Project rules: `CLAUDE.md` §Frontend Website Rules, `AGENTS.md` §0 Architecture, §1 `ui-interface` agent, §2 Pipeline B
- Related memory: `project_frontend_redesign.md` (v1.1 workstream), `project_ip08.md` (frozen architecture boundary this redesign sits atop)
