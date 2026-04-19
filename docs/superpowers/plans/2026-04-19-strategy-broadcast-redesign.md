# Strategy Route Broadcast Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Broadcast pit-wall aesthetic from `new-designs/` to the existing `/strategy` route (pre-race, live race, post-race) as a pure visual redress — no engine, store, worker, or type changes.

**Architecture:** Token-first. A new `data-theme="broadcast"` layer is added alongside the existing Kinetic Command theme. `PageShell` gains a `theme` prop; only `/strategy` passes `theme="broadcast"`. Tailwind config dual-writes new Broadcast buckets (`surface.*`, `line.*`, `ink.*`, `sig.*`, `c.*`) beside the preserved Kinetic buckets. Each Strategy component is then restyled/relocated against the Broadcast tokens. Other routes (Paddock, Factory, Driver Office) are untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, CSS custom properties. Theme switching via `[data-theme]` attribute cascade.

**Spec:** `docs/superpowers/specs/2026-04-19-strategy-broadcast-redesign-design.md` (revision r2, reviewer-approved)

**Agent routing:** `ui-interface` owns every task in this plan (per `AGENTS.md` §1). `verify` runs after each commit (Pipeline B). No `sim-engine` or `game-state` work is in scope. If a task pushes you to touch `src/engine/**`, `src/stores/**`, `src/workers/**`, or `src/types/**`, STOP — that's a scope violation and requires user check-in.

---

## File Structure Map

### Files CREATED

| Path | Responsibility |
|---|---|
| `src/styles/themes/kinetic.css` | Current Kinetic tokens + `.high-contrast` block (moved verbatim from `src/styles/tokens.css`) |
| `src/styles/themes/broadcast.css` | Broadcast pit-wall tokens + dead `[data-theme="terminal"]` + `[data-theme="editorial"]` blocks |
| `src/components/strategy/broadcast-chrome.tsx` | Shared top command bar + flag strip wrapper (Client Component) |
| `src/components/strategy/hero-strip.tsx` | Live race hero strip: lap-card \| broadcast leader \| gap-next (Client Component) |

### Files MODIFIED

| Path | Why |
|---|---|
| `src/styles/tokens.css` | Becomes pure `@import` switchboard |
| `tailwind.config.ts` | Add Broadcast buckets (dual-write with existing Kinetic buckets) |
| `src/components/layout/page-shell.tsx` | Add optional `theme?: 'kinetic' \| 'broadcast'` prop; render `data-theme` attr; swap skip-link color per theme |
| `src/app/strategy/page.tsx` | Pass `theme="broadcast"` on all six `PageShell` instances; replace inline sticky-chrome composition with `<BroadcastChrome>`; add hero strip; regroup main grid; collapse `GapChart` to secondary row |
| `src/components/strategy/pre-race-setup.tsx` | Add internal tab state; restyle to `.session-card`, `.prog-card`, `.setup-track`; host Intel + Planner tabs |
| `src/components/strategy/race-intel-panel.tsx` | Restyle tiles to Broadcast panels; adopt chart styles where existing charts are rendered |
| `src/components/strategy/strategy-planner.tsx` | Restyle to `.gantt-row` per-driver (one row each) |
| `src/components/strategy/race-status-bar.tsx` | Restyle to `.topbar` aesthetic |
| `src/components/strategy/sim-speed-control.tsx` | Restyle to `.sim-group`/`.sim-btn` aesthetic |
| `src/components/strategy/race-ticker.tsx` | Restyle to `.flag-strip`/`.ticker-track` aesthetic |
| `src/components/strategy/circuit-map.tsx` | Restyle track strokes/kerbs/dots to Broadcast tokens |
| `src/components/strategy/timing-tower.tsx` | Restyle to `.timing`/`.timing-row` aesthetic |
| `src/components/strategy/tire-strategy.tsx` | Restyle to `.strategy-grid`/`.sd-tire`/`.sd-wear-bar` aesthetic |
| `src/components/strategy/driver-commands.tsx` | Restyle to `.cmd-grid`/`.cmd-btn.attack/conserve`/`.radio-line` aesthetic |
| `src/components/strategy/battle-forecast.tsx` | Restyle to `.battles`/`.battle` aesthetic |
| `src/components/strategy/commentary-feed.tsx` | Restyle to `.feed`/`.feed-item`/`.feed-tag` aesthetic |
| `src/components/charts/gap-chart.tsx` | Restyle axes + grid lines to Broadcast tokens |
| `src/components/strategy/post-race-results.tsx` | Restyle to `.post-hero`/`.post-podium`/`.post-table`/`.fastest-card`; conditional stint + swing rows per §11 open questions |

### Files NOT TOUCHED (must remain byte-for-byte identical at rest)

- `src/app/layout.tsx` (JetBrains Mono already loaded — **do not re-add**)
- `src/app/globals.css`
- Any file under `src/engine/`, `src/stores/`, `src/workers/`, `src/hooks/`, `src/types/`
- Any file under `tests/` — Pipeline B ui-interface does not write or modify tests. `verify` runs the existing suite; no new tests are expected or wanted.
- Any page or component outside `src/app/strategy/` and `src/components/strategy/` except `page-shell.tsx`, `tailwind.config.ts`, and `src/components/charts/gap-chart.tsx`

---

## Pre-Flight Checks (run once before Task 1)

- [ ] **P-1: Confirm current branch is clean**

```bash
git status
```
Expected: working tree clean on `main`. If not, stash or commit before proceeding.

- [ ] **P-2: Confirm baseline builds green (capture logs for later diff)**

```bash
mkdir -p scratch/baseline
npx tsc --noEmit 2>&1 | tee scratch/baseline/tsc-precheck.log
npx vitest run 2>&1 | tee scratch/baseline/vitest-precheck.log
npm run lint 2>&1 | tee scratch/baseline/lint-precheck.log
```
Expected: all three pass. If any fail on `main` before you start, that's a pre-existing issue — flag to user, do not proceed. Keep the logs — later steps diff their output against these to distinguish regressions from pre-existing noise.

- [ ] **P-3: Capture structured baseline of non-Strategy routes**

Start dev server (background). For each of `/paddock`, `/factory`, and one other Kinetic route (check `src/app/` for available routes — likely `/drivers`, `/calendar`, or similar), open the URL in a browser and record a **structured baseline** in `scratch/baseline/kinetic-snapshot.md`:

For each route, document:
1. Top-bar rendered colors (background, text, accent).
2. Nav-bar rendered colors.
3. First card's border color + background.
4. Body text color.
5. Any active accent color visible.

```bash
npm run dev
# Visit each route, fill in the markdown table.
```

This replaces pixel-diff tooling (which is not wired in the project). Step 1.7 compares the same five observations post-change; any visible color shift in those five observations is a failure. This is the "structured eyeball" gate per review finding H-6.

---

## Task 1 — Token Plumbing (No Theme Activation)

**Goal:** Extract Kinetic tokens into their own file, add Broadcast tokens as a sibling file, extend Tailwind with new buckets. `/strategy` still renders in Kinetic at end of task — theme flag activation is deferred to Task 2.

**Why deferred:** §9 Step 1 of the spec (and reviewer finding M3). Activating `theme="broadcast"` before any Strategy component is restyled would break variable resolution on `/strategy` because the old class names (`bg-bg-surface`, `text-text-primary`) reference CSS variables not yet mapped by `broadcast.css`.

**Files:**
- Create: `src/styles/themes/kinetic.css`, `src/styles/themes/broadcast.css`
- Modify: `src/styles/tokens.css`, `tailwind.config.ts`, `src/components/layout/page-shell.tsx`

- [ ] **Step 1.1: Create `src/styles/themes/kinetic.css`**

Two substeps:

**1.1a — Move existing Kinetic tokens verbatim.** Copy the entire current content of `src/styles/tokens.css` (every line, including `@layer base {`, `:root { … }`, `.high-contrast { … }`, and the closing `}`) into the new file `src/styles/themes/kinetic.css` with zero modifications. This preserves the Kinetic palette exactly.

**1.1b — Append compatibility aliases inside `:root`.** Then extend the existing `:root` block (do **not** create a separate block, do **not** place aliases in `[data-theme="kinetic"]`) with the Broadcast-compatibility aliases below, per spec §4.4. These aliases let the new Tailwind classes (`bg-surface-paper`, `text-ink-hi`, etc.) resolve to Kinetic-equivalent colors on Kinetic pages.

**Final file should look like:**

```css
@layer base {
  :root {
    /* --- existing Kinetic tokens, moved verbatim --- */
    --bg-primary: #0A0A0A;
    --bg-secondary: #111111;
    --bg-surface: rgba(255, 255, 255, 0.03);
    --border-default: rgba(255, 255, 255, 0.06);
    --border-hover: rgba(255, 255, 255, 0.12);
    --accent-lime: #CCFF00;
    --accent-cyan: #00E5FF;
    --accent-red: #FF3B30;
    --accent-amber: #FFC800;
    --accent-purple: #B450FF;
    --text-primary: #FFFFFF;
    --text-secondary: #AAAAAA;
    --text-muted: #888888;
    --text-dim: #555555;
    --font-heading: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;

    /* --- Broadcast-bucket compatibility aliases (resolve new Tailwind classes on Kinetic pages) --- */
    --surface-void: var(--bg-primary);
    --surface-base: var(--bg-primary);
    --surface-paper: var(--bg-surface);
    --surface-raised: var(--bg-secondary);
    --surface-hi: var(--bg-secondary);
    --line-hair: var(--border-default);
    --line-sub: var(--border-default);
    --line-strong: var(--border-hover);
    --ink-dim: var(--text-dim);
    --ink-mute: var(--text-muted);
    --ink-body: var(--text-secondary);
    --ink-hi: var(--text-primary);
    --sig-red: var(--accent-red);
    --sig-red-dk: var(--accent-red);
    --sig-amber: var(--accent-amber);
    --sig-green: #4ADE80;
    --sig-cyan: var(--accent-cyan);
    --sig-purple: var(--accent-purple);
    --sig-pink: #EC4899;
    --c-soft: #FF3B30;
    --c-med: #FFC800;
    --c-hard: #FFFFFF;
    --c-inter: #4ADE80;
    --c-wet: #3B82F6;
    --rad: 8px;
    --font-display: var(--font-heading);
  }

  /* No separate [data-theme="kinetic"] block — the :root above IS the Kinetic
     theme. A <PageShell theme="kinetic"> renders with data-theme="kinetic",
     which falls through to :root via the cascade. If the spec later changes
     :root default away from Kinetic, duplicate these declarations into
     [data-theme="kinetic"] at that time. */

  .high-contrast {
    /* --- moved verbatim from src/styles/tokens.css --- */
    --bg-primary: #000000;
    --bg-secondary: #0A0A0A;
    --bg-surface: rgba(255, 255, 255, 0.06);
    --border-default: rgba(255, 255, 255, 0.20);
    --border-hover: rgba(255, 255, 255, 0.35);
    --accent-lime: #DDFF33;
    --accent-cyan: #33EEFF;
    --accent-red: #FF5544;
    --accent-amber: #FFD633;
    --accent-purple: #CC66FF;
    --text-primary: #FFFFFF;
    --text-secondary: #CCCCCC;
    --text-muted: #AAAAAA;
    --text-dim: #777777;
  }
}
```

- [ ] **Step 1.2: Create `src/styles/themes/broadcast.css`**

Port tokens verbatim from `new-designs/app.css` lines 6–44 (base palette) and 46–82 (terminal + editorial variants) into a `[data-theme="broadcast"]` block. Key tokens:

```css
@layer base {
  [data-theme="broadcast"] {
    /* Surface */
    --bg-void: oklch(0.11 0.008 260);
    --bg-base: oklch(0.14 0.01 260);
    --bg-paper: oklch(0.17 0.012 260);
    --bg-raised: oklch(0.21 0.014 260);
    --bg-hi: oklch(0.26 0.016 260);
    /* Lines */
    --line-hair: oklch(0.28 0.012 260);
    --line-sub: oklch(0.34 0.014 260);
    --line-strong: oklch(0.48 0.018 260);
    /* Ink */
    --ink-dim: oklch(0.54 0.012 260);
    --ink-mute: oklch(0.68 0.012 260);
    --ink-body: oklch(0.86 0.008 260);
    --ink-hi: oklch(0.98 0.003 260);
    /* Signal */
    --sig-red: oklch(0.68 0.22 25);
    --sig-red-dk: oklch(0.42 0.16 25);
    --sig-amber: oklch(0.82 0.17 80);
    --sig-green: oklch(0.78 0.18 148);
    --sig-cyan: oklch(0.82 0.13 210);
    --sig-purple: oklch(0.68 0.22 300);
    --sig-pink: oklch(0.72 0.22 355);
    /* Tire compounds */
    --c-soft: oklch(0.72 0.22 25);
    --c-med: oklch(0.88 0.18 95);
    --c-hard: oklch(0.98 0 0);
    --c-inter: oklch(0.72 0.18 148);
    --c-wet: oklch(0.65 0.18 245);
    /* Rebinding the new Tailwind `surface.*` bucket */
    --surface-void: var(--bg-void);
    --surface-base: var(--bg-base);
    --surface-paper: var(--bg-paper);
    --surface-raised: var(--bg-raised);
    --surface-hi: var(--bg-hi);
    /* Fonts */
    --font-display: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;
    /* Radius */
    --rad: 2px;
  }

  /* Dead themes — preserved for future phases, not exposed anywhere in UI */
  [data-theme="terminal"] {
    /* Port lines 47–65 of new-designs/app.css verbatim into this block */
  }
  [data-theme="editorial"] {
    /* Port lines 68–82 of new-designs/app.css verbatim into this block */
  }
}
```

- [ ] **Step 1.3: Convert `src/styles/tokens.css` into a switchboard**

Replace the entire content of `src/styles/tokens.css` with:

```css
@import "./themes/kinetic.css";
@import "./themes/broadcast.css";
```

- [ ] **Step 1.4: Extend `tailwind.config.ts` with Broadcast buckets (dual-write)**

Add to `theme.extend.colors` **without removing any existing bucket**:

```ts
surface: {
  void:   'var(--surface-void)',
  base:   'var(--surface-base)',
  paper:  'var(--surface-paper)',
  raised: 'var(--surface-raised)',
  hi:     'var(--surface-hi)',
},
line: {
  hair:   'var(--line-hair)',
  sub:    'var(--line-sub)',
  strong: 'var(--line-strong)',
},
ink: {
  dim:  'var(--ink-dim)',
  mute: 'var(--ink-mute)',
  body: 'var(--ink-body)',
  hi:   'var(--ink-hi)',
},
sig: {
  red:     'var(--sig-red)',
  'red-dk':'var(--sig-red-dk)',
  amber:   'var(--sig-amber)',
  green:   'var(--sig-green)',
  cyan:    'var(--sig-cyan)',
  purple:  'var(--sig-purple)',
  pink:    'var(--sig-pink)',
},
c: {
  soft:  'var(--c-soft)',
  med:   'var(--c-med)',
  hard:  'var(--c-hard)',
  inter: 'var(--c-inter)',
  wet:   'var(--c-wet)',
},
```

Also add to `fontFamily`:

```ts
display: ['var(--font-display)'],
```

Also add to `borderRadius`:

```ts
rad: 'var(--rad)',
```

**Do not remove** `bg.*`, `border.*`, `accent.*`, `text.*` — they are consumed by every other page and must keep working.

- [ ] **Step 1.5: Add `theme` prop to `PageShell`**

Modify `src/components/layout/page-shell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { TopBar } from './top-bar'
import { NavBar } from './nav-bar'

interface PageShellProps {
  children: ReactNode
  theme?: 'kinetic' | 'broadcast'
}

export function PageShell({ children, theme = 'kinetic' }: PageShellProps) {
  const isBroadcast = theme === 'broadcast'
  return (
    <div data-theme={theme} className="min-h-screen bg-[var(--bg-primary)]">
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-heading focus:font-bold ${
          isBroadcast
            ? 'focus:bg-[var(--sig-amber)] focus:text-[var(--bg-void)]'
            : 'focus:bg-[var(--accent-lime)] focus:text-[#0A0A0A]'
        }`}
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 pt-4 pb-20" role="main">
        {children}
      </main>
      <NavBar />
    </div>
  )
}
```

The skip-link color swap (reviewer finding L5) uses `--sig-amber` against `--bg-void` — verify WCAG 4.5:1 contrast after step 2.6.

- [ ] **Step 1.5a: PageShell audit — confirm skip-link uses theme-correct tokens on both branches**

```bash
grep -nE "focus:bg-\[var\(--(accent-lime|sig-amber)\)\]|focus:text-\[var\(--(bg-void|[^)]+)\)\]" src/components/layout/page-shell.tsx
```
Expected: exactly two `focus:bg` matches and two `focus:text` matches (one pair per theme branch). If any legacy token (e.g. `--accent-cyan`, `--accent-red`) leaked into the skip-link, fix it before moving on.

- [ ] **Step 1.6: Verify type-check, tests, lint**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
```
Expected: all three green. Compare against `scratch/baseline/*.log` from P-2 if any failures appear — a pre-existing failure is not a regression.

- [ ] **Step 1.7: Verify Kinetic routes unchanged (structured eyeball)**

Start `npm run dev`. Visit `/paddock`, `/factory`, and the third route you recorded in P-3. Re-observe the same five data points from `scratch/baseline/kinetic-snapshot.md` (top-bar colors, nav-bar colors, first-card border+background, body text color, active accent color).

Any observable color shift = token leak across the Kinetic/Broadcast boundary. Must be fixed before commit. Expected: zero observable changes — Kinetic routes should look identical to their pre-change state because only `/strategy` passes `theme="broadcast"`, and in this task `/strategy` does **not** yet pass it.

- [ ] **Step 1.8: Verify `/strategy` still renders (Kinetic)**

Visit `/strategy` (any phase). Page should still look like the current Kinetic styling because `theme="broadcast"` has NOT been applied yet. HTTP 200 required.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/strategy --max-time 30
```
Expected: `200`.

- [ ] **Step 1.9: Commit**

```bash
git add src/styles tailwind.config.ts src/components/layout/page-shell.tsx
git commit -m "feat(strategy-redesign): add Broadcast theme tokens (Task 1/5)

Extract Kinetic tokens into src/styles/themes/kinetic.css. Add
Broadcast tokens under [data-theme='broadcast'] in
src/styles/themes/broadcast.css with dead terminal/editorial variants.
tokens.css becomes an @import switchboard.

Dual-write Tailwind: new surface.*, line.*, ink.*, sig.*, c.* buckets
added alongside existing bg.*, border.*, accent.*, text.* (preserved
for all non-Strategy pages). PageShell gains optional theme prop;
skip-link class set swaps per theme. WCAG 4.5:1 contrast
verification on the Broadcast skip-link deferred to Task 2 when the
theme is first activated on /strategy.

No theme activation yet. /strategy still renders Kinetic to avoid a
transitional variable-resolution break. Activation ships in Task 2.

Spec: docs/superpowers/specs/2026-04-19-strategy-broadcast-redesign-design.md"
```

---

## Task 2 — Shared Chrome + Theme Activation

**Goal:** Build the reusable top-chrome wrapper, build the new hero strip, restyle the three chrome components, and **activate `theme="broadcast"` on all six `PageShell` call sites** in `src/app/strategy/page.tsx`.

**Files:**
- Create: `src/components/strategy/broadcast-chrome.tsx`, `src/components/strategy/hero-strip.tsx`
- Modify: `src/components/strategy/race-status-bar.tsx`, `src/components/strategy/sim-speed-control.tsx`, `src/components/strategy/race-ticker.tsx`, `src/app/strategy/page.tsx`

- [ ] **Step 2.0: Pre-flight — confirm page is Client Component and count PageShell sites**

```bash
# Verify strategy page is 'use client' (required for useState later)
head -3 src/app/strategy/page.tsx
# Expected: first line is 'use client'

# Count PageShell instances — spec §4.3 cites six
grep -c "<PageShell" src/app/strategy/page.tsx
# Expected: 6
```

If the count differs from 6, STOP. Either the file has drifted since the spec was written (reconcile with user before proceeding) or the grep pattern needs escaping. Do not continue Task 2 until the count is confirmed — the `theme="broadcast"` activation in Step 2.7 depends on it.

If the first line is not `'use client'`, add that directive as a separate one-line commit before starting Step 2.1 (commit message: `chore(strategy): mark page as Client Component for upcoming useState`).

- [ ] **Step 2.1: Capture exact prop shapes of chrome components**

Read each of these files and record the exact prop interface in `scratch/baseline/chrome-props.md` (gitignored). Specifically capture:
- `RaceStatusBar` — interface name, each prop's name + type
- `SimSpeedControl` — same
- `RaceTicker` — same, with particular attention to the `entries` prop's array element type (likely `CommentaryEntry[]` — capture the import path)

These exact types drive Step 2.5's `BroadcastChromeProps`. Do not guess — copy the type signatures byte-for-byte.

Files to read:
- `src/components/strategy/race-status-bar.tsx`
- `src/components/strategy/sim-speed-control.tsx`
- `src/components/strategy/race-ticker.tsx`

- [ ] **Step 2.2: Restyle `race-status-bar.tsx` to `.topbar` aesthetic**

Replace Kinetic Tailwind classes (`bg-bg-surface`, `text-text-primary`, etc.) with Broadcast equivalents. Reference CSS: `new-designs/app.css` lines 132–189 (`.topbar`, `.brand`, `.stat`). Use new Tailwind buckets: `bg-surface-paper`, `border-line-sub`, `text-ink-hi`, `text-ink-mute`, `font-mono`, `rounded-rad`.

Do not change any prop or field name. Only class names and JSX structure (to match `.stat`/`.brand` grouping).

- [ ] **Step 2.3: Restyle `sim-speed-control.tsx` to `.sim-group`/`.sim-btn` aesthetic**

Reference CSS: `new-designs/app.css` lines 191–213. Buttons become `.sim-btn` with `.sim-group` wrapper. Active speed button uses `--sig-red` background.

- [ ] **Step 2.4: Restyle `race-ticker.tsx` to `.flag-strip`/`.ticker-track` aesthetic**

Reference CSS: `new-designs/app.css` lines 215–281. Green/yellow/red flag-marker variants. Ticker track uses `font-mono`, `text-ink-mute`, with animated translateX. Keep the existing ticker-roll animation but port to Broadcast colors.

- [ ] **Step 2.5: Create `src/components/strategy/broadcast-chrome.tsx`**

Use the **exact prop types** you captured in Step 2.1 — do not invent or widen them. The interface must embed each child's prop set exactly so no casts or `as` narrowing is needed.

Skeleton (fill in the placeholders from your `chrome-props.md` capture; replace `{CommentaryEntry}` with the real imported type):

```tsx
'use client'

import { RaceStatusBar } from './race-status-bar'
import { SimSpeedControl } from './sim-speed-control'
import { RaceTicker } from './race-ticker'
import type { /* CommentaryEntry — use the real type captured in 2.1 */ } from '@/types/race'
// (Replace the import path above with the actual path from step 2.1.)

interface BroadcastChromeProps {
  // Phase + flag context (from spec §6).
  phase: 'race' | 'sprint' | 'post-race'
  flagStatus?: 'green' | 'yellow' | 'sc' | 'vsc' | 'red' | 'chequered'

  // ─── RaceStatusBar pass-through (EXACT types from step 2.1) ───
  lap: number
  totalLaps: number
  weather: /* fill in */
  trackTemp: number
  safetyCar: boolean

  // ─── SimSpeedControl pass-through ───
  currentSpeed: number
  onSetSpeed: (speed: number) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean

  // ─── RaceTicker pass-through ───
  tickerEntries: /* CommentaryEntry[] or whatever step 2.1 captured */

  // Layout
  sticky?: boolean
}

export function BroadcastChrome({
  phase, flagStatus,
  lap, totalLaps, weather, trackTemp, safetyCar,
  currentSpeed, onSetSpeed, onPause, onResume, isPaused,
  tickerEntries, sticky = true,
}: BroadcastChromeProps) {
  return (
    <div className={sticky ? 'sticky top-12 z-20 bg-surface-void/95 backdrop-blur-md pb-2 -mx-4 px-4 pt-1' : ''}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <RaceStatusBar
          lap={lap} totalLaps={totalLaps} weather={weather}
          trackTemp={trackTemp} safetyCar={safetyCar}
        />
        <SimSpeedControl
          currentSpeed={currentSpeed} onSetSpeed={onSetSpeed}
          onPause={onPause} onResume={onResume} isPaused={isPaused}
        />
      </div>
      <RaceTicker entries={tickerEntries} className="mt-2" />
      {/* phase + flagStatus are carried in the prop contract per spec §6.
          For this phase of the plan they're used only by flag-strip styling
          decisions in Step 2.4 (passed through to RaceTicker or rendered
          inline). If you don't use them yet, don't rename or remove them —
          later design phases may consume them. */}
    </div>
  )
}
```

**Critical:** No `as never`, no `as any`, no `// @ts-ignore`. If TypeScript complains, the interface is wrong — go back to Step 2.1 and re-capture the exact types. AGENTS.md §1 `verify` prohibits type escapes.

- [ ] **Step 2.6: Create `src/components/strategy/hero-strip.tsx`**

Reference CSS: `new-designs/app.css` lines 283–444 (`.hero`, `.lap-card`, `.broadcast`, `.gap-next`). Three-cell grid: lap counter card, broadcast leader card, gap-to-next card. All data derives from existing race-state fields — no new backend data.

```tsx
'use client'

interface HeroStripProps {
  currentLap: number
  totalLaps: number
  leaderCode: string      // e.g. "NOR"
  leaderFirst: string     // e.g. "Lando"
  leaderLast: string      // e.g. "Norris"
  leaderNumber: number    // e.g. 4
  leaderTeamColor: string // hex from team data
  leaderTeamCode: string  // e.g. "MCL"
  leaderGap?: number      // gap leader → P2, seconds
  gapTrend?: 'closing' | 'growing' | 'stable'
}

export function HeroStrip({
  currentLap, totalLaps,
  leaderCode, leaderFirst, leaderLast, leaderNumber,
  leaderTeamColor, leaderTeamCode,
  leaderGap, gapTrend = 'stable',
}: HeroStripProps) {
  const lapPct = totalLaps > 0 ? (currentLap / totalLaps) * 100 : 0
  const gapLabel = typeof leaderGap === 'number' ? leaderGap.toFixed(3) : '—'
  const trendClass = gapTrend === 'closing' ? 'text-sig-red' :
                     gapTrend === 'growing' ? 'text-sig-green' : 'text-ink-mute'

  return (
    <div className="grid gap-3 mb-3
                    grid-cols-1
                    min-[1200px]:grid-cols-[320px_1fr_280px]
                    min-[1400px]:grid-cols-[360px_1fr_300px]">

      {/* .lap-card — lap counter with progress bar */}
      <div className="relative overflow-hidden bg-surface-paper border border-line-sub rounded-rad p-5 flex flex-col gap-2.5">
        <span className="absolute top-0 left-0 bottom-0 w-1 bg-sig-red" />
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-dim">Current Lap</div>
        <div className="font-display font-extrabold text-[86px] leading-[0.88] tracking-[-0.04em] text-ink-hi tabular-nums flex items-baseline gap-2">
          {currentLap}
          <span className="text-[28px] font-medium text-ink-dim tracking-normal">/ {totalLaps}</span>
        </div>
        <div className="h-1 bg-surface-hi rounded-[2px] overflow-hidden">
          <div className="h-full bg-sig-red transition-[width] duration-500" style={{ width: `${lapPct}%` }} />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-ink-mute tracking-[0.1em]">
          <span>START</span>
          <span>{Math.round(lapPct)}%</span>
          <span>FLAG</span>
        </div>
      </div>

      {/* .broadcast — leader callout */}
      <div className="relative grid grid-cols-[120px_1fr_auto] bg-surface-paper border border-line-sub rounded-rad overflow-hidden items-stretch">
        <div className="bg-sig-red text-surface-void flex items-center justify-center font-display font-extrabold text-[92px] leading-none tracking-[-0.08em] relative">
          1
          <span className="absolute top-2.5 right-2.5 font-mono text-[10px] tracking-[0.2em] opacity-60">P1</span>
        </div>
        <div className="px-5 py-3.5 flex flex-col justify-between gap-2 border-r border-line-hair">
          <div className="flex items-baseline gap-3">
            <span className="font-body font-light text-ink-mute text-[15px]">{leaderFirst}</span>
            <span className="font-display font-bold text-[30px] text-ink-hi tracking-[-0.02em] leading-none">{leaderLast}</span>
            <span className="ml-auto font-display font-extrabold text-[30px] text-ink-dim tracking-[-0.04em]">#{leaderNumber}</span>
          </div>
          <div className="flex gap-5 font-mono text-[11px]">
            <span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">Code</span>
              <span className="text-ink-hi font-semibold">{leaderCode}</span>
            </span>
          </div>
        </div>
        <div
          className="w-[68px] relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5"
          style={{ background: leaderTeamColor }}
        >
          <span className="font-display font-extrabold text-[18px] text-white tracking-[0.02em]">{leaderTeamCode}</span>
        </div>
      </div>

      {/* .gap-next — gap to P2 */}
      <div className="bg-surface-paper border border-line-sub rounded-rad px-4 py-3.5 flex flex-col gap-1.5 justify-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">Gap to P2</div>
        <div className="font-display font-bold text-[38px] tracking-[-0.03em] text-ink-hi leading-none tabular-nums">
          <span className="text-sig-red text-[24px]">+</span>
          {gapLabel}
          <span className="text-ink-dim text-base ml-1 font-medium">s</span>
        </div>
        <div className={`font-mono text-[11px] inline-flex gap-1.5 items-center ${trendClass}`}>
          <span className="text-[10px]">{gapTrend === 'closing' ? '▼' : gapTrend === 'growing' ? '▲' : '—'}</span>
          <span className="uppercase tracking-[0.1em]">{gapTrend}</span>
        </div>
      </div>
    </div>
  )
}
```

Tailwind classes reference buckets added in Task 1 Step 1.4 (`surface.paper`, `line.sub`, `ink.hi/mute/dim`, `sig.red/green`, `rounded-rad`). If any class fails to compile, verify the Tailwind extension landed correctly in `tailwind.config.ts`.

- [ ] **Step 2.7: Wire `theme="broadcast"` on every `PageShell` in `src/app/strategy/page.tsx`**

Confirm the count from Step 2.0 (should be 6). Then for each `<PageShell>` opening tag in the file, add `theme="broadcast"` as a prop. Since line numbers drift, locate by the phase landmark comments already in the file (e.g. `// Pre-race phases`, `// Post-race`, `// Race phase — show either the "Start Race" button …`, `// Default: management phase …`, and any error branch).

After the edit, verify:

```bash
grep -c 'theme="broadcast"' src/app/strategy/page.tsx
# Expected: exactly 6 (matches the PageShell count from Step 2.0)

grep -nE '<PageShell(?![^>]*theme=)' src/app/strategy/page.tsx
# Expected: no output — zero PageShell tags without a theme prop
```

If either check fails, one or more sites were missed. Fix before moving on.

- [ ] **Step 2.8: Replace inline sticky-chrome with `<BroadcastChrome>`**

In the live race branch of `src/app/strategy/page.tsx`, locate the inline sticky block. Use a grep landmark — the current code has a distinctive comment `═══ Sticky Control Bar ═══`:

```bash
grep -n "Sticky Control Bar" src/app/strategy/page.tsx
```

That grep returns the opening-comment line. Replace the entire JSX block from that comment through the closing `</div>` that wraps `<RaceTicker>` with a single `<BroadcastChrome ... />` call, passing the same prop values the inline components currently receive (`raceSim.currentLap`, `raceSim.totalLaps`, `raceSim.weather`, etc., plus the new `phase` prop from `gameState.phase`).

If the landmark comment has been edited away, the replacement target is the only `sticky top-12 z-20` className in the file — grep for that instead.

- [ ] **Step 2.9: Add `<HeroStrip>` to live race branch**

Immediately after the `<BroadcastChrome />` insert and before the `<CircuitMap>` block (grep landmark: `Hero: Track Map`), insert the hero strip. Use the page's existing `drivers` and `teams` arrays (read at the top of the page component; they're returned by `useGameSlice`) to look up leader fields:

```tsx
{/* Derive leader fields from timing + drivers + teams */}
{(() => {
  const leader = raceSim.timing[0]
  const leaderDriver = leader ? drivers.find(d => d.id === leader.driverId) : undefined
  const leaderTeam = leaderDriver ? teams.find(t => t.id === leaderDriver.teamId) : undefined
  const p2 = raceSim.timing[1]
  return (
    <HeroStrip
      currentLap={raceSim.currentLap}
      totalLaps={raceSim.totalLaps}
      leaderCode={leaderDriver?.shortName ?? ''}
      leaderFirst={leaderDriver?.firstName ?? ''}
      leaderLast={leaderDriver?.lastName ?? ''}
      leaderNumber={leaderDriver?.carNumber ?? 0}
      leaderTeamColor={leaderTeam?.color ?? '#666'}
      leaderTeamCode={leaderTeam?.shortName ?? leaderTeam?.name?.slice(0, 3).toUpperCase() ?? ''}
      leaderGap={p2?.gapToLeader}
    />
  )
})()}
```

Field names (`shortName`, `firstName`, `lastName`, `carNumber`, `color`) are the expected shape of `Driver` and `Team` types per existing usage in the file. If TypeScript complains about any field not existing on the type, check `src/types/driver.ts` and `src/types/team.ts` (**READ-ONLY — do not modify**) and adjust the field access to match the actual shape.

- [ ] **Step 2.10: Tailwind class audit — shared chrome files**

```bash
# Must return zero hits
grep -E "bg-bg-(primary|secondary|surface)|text-text-(primary|secondary|muted|dim)|border-border-(default|hover)|bg-accent-(lime|cyan|red|amber|purple)" src/components/strategy/race-status-bar.tsx src/components/strategy/sim-speed-control.tsx src/components/strategy/race-ticker.tsx src/components/strategy/broadcast-chrome.tsx src/components/strategy/hero-strip.tsx
```
Expected: no output. Any hit = unmigrated class, fix before commit.

- [ ] **Step 2.11: Verify type-check, tests, lint**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
```

- [ ] **Step 2.12: Visual check — chrome + hero strip**

`npm run dev`. Navigate `/strategy` during a race phase (start a race from Paddock if needed). Confirm:
- Top command bar renders in Broadcast colors (dark paper background, mono typography, red signal on active sim-speed button).
- Flag strip + ticker renders in Broadcast colors.
- Hero strip renders with the three cells: lap counter, leader callout, gap-to-next.
- Pre-race and post-race phases render in Broadcast theme (their chrome/content is still mostly unrestyled — this is expected, restyle ships in Tasks 4 and 5).

Take reference screenshot; compare against `new-designs/Strategy Page.html` upper area. Minimum two rounds.

- [ ] **Step 2.13: Commit**

```bash
git add src/components/strategy/broadcast-chrome.tsx \
        src/components/strategy/hero-strip.tsx \
        src/components/strategy/race-status-bar.tsx \
        src/components/strategy/sim-speed-control.tsx \
        src/components/strategy/race-ticker.tsx \
        src/app/strategy/page.tsx
git commit -m "feat(strategy-redesign): shared chrome + hero strip, activate broadcast theme (Task 2/5)

Build BroadcastChrome wrapper and HeroStrip. Restyle RaceStatusBar,
SimSpeedControl, RaceTicker to .topbar/.sim-group/.flag-strip
aesthetic. Activate theme='broadcast' on all six PageShell call sites
in src/app/strategy/page.tsx.

Pre-race and post-race content still renders with unmigrated classes
under the Broadcast theme — transitional, restyled in Tasks 4 and 5.

Spec §6, §9 Step 2."
```

---

## Task 3 — Live Race View Restyle + Regrouping

**Goal:** Restyle the seven live-race data components. Regroup the main grid to `460px | flex | 380px` (Timing | Map+Tires | Commands+Battles+Feed). Move `GapChart` to a collapsible secondary row.

**Files:**
- Modify: `src/components/strategy/timing-tower.tsx`, `src/components/strategy/circuit-map.tsx`, `src/components/strategy/tire-strategy.tsx`, `src/components/strategy/driver-commands.tsx`, `src/components/strategy/battle-forecast.tsx`, `src/components/strategy/commentary-feed.tsx`, `src/components/charts/gap-chart.tsx`, `src/app/strategy/page.tsx`

- [ ] **Step 3.1: Restyle `timing-tower.tsx` → `.timing`/`.timing-row`**

Reference: `new-designs/app.css` lines 482–565. Grid columns match `32px 8px 48px 1fr 70px 64px 40px` (pos, team-bar, code, name-group, gap, lap, status). Use `font-mono`, `text-ink-hi` for primary, `text-ink-mute` for secondary. Player row uses red accent bar.

Props unchanged.

- [ ] **Step 3.2: Restyle `circuit-map.tsx` → `.track`/`.track-svg`/`.car-dot`**

Reference: `new-designs/app.css` lines 567–645. Change SVG stroke colors to `var(--bg-hi)` (asphalt), `var(--line-strong)` (kerbs), `var(--line-sub)` (racing line dashed). Car dots use team color fill with `stroke-ink-hi`; player car dot gets `fill-sig-red` and drop-shadow glow.

- [ ] **Step 3.3: Restyle `tire-strategy.tsx` → `.strategy-grid`/`.strategy-driver`/`.sd-tire`**

Reference: `new-designs/app.css` lines 647–705. Two-column grid (one cell per player driver). Each cell: large 56px compound tire ring, wear bar gradient (green → amber → red), fuel bar cyan, stat rows.

- [ ] **Step 3.4: Restyle `driver-commands.tsx` → `.cmd-grid`/`.cmd-btn`/`.radio-line`**

Reference: `new-designs/app.css` lines 707–752. 4-column command button grid (`.cmd-btn.attack.active` → red, `.cmd-btn.conserve.active` → cyan). Radio line with amber left border and `▸ RADIO` label.

- [ ] **Step 3.5: Restyle `battle-forecast.tsx` → `.battles`/`.battle`**

Reference: `new-designs/app.css` lines 836–858. `1fr auto 1fr` grid per battle row: left driver, gap+delta column center, right driver. Gap direction indicator (`closing` red / `growing` green).

- [ ] **Step 3.6: Restyle `commentary-feed.tsx` → `.feed`/`.feed-item`/`.feed-tag`**

Reference: `new-designs/app.css` lines 801–834. `36px 58px 1fr` grid per entry (lap, tag, text). Tag color mapping: `OVERTAKE`→red, `PIT`→amber, `INFO`→neutral, `BATTLE`→purple, `FASTEST`→purple. Mapping must match existing event type strings — read current commentary feed data to confirm enum values before committing to colors.

- [ ] **Step 3.7: Restyle `gap-chart.tsx`**

Update chart axes, grid lines, and series colors to Broadcast tokens (`stroke-line-hair` grid, `text-ink-dim` axis labels, team colors unchanged). No structural change.

- [ ] **Step 3.8: Regroup live race grid in `src/app/strategy/page.tsx`**

Locate the current data-panels block using the grep landmark:

```bash
grep -n "Data Panels: 3-column" src/app/strategy/page.tsx
```

Replace the JSX from that landmark comment through its closing `</div>` (the `grid grid-cols-1 lg:grid-cols-3` wrapper and its three children) with the new structure per spec §5.2:

```tsx
<>
  <BroadcastChrome ... />
  <HeroStrip ... />

  <div className="grid gap-4 mt-3
                  grid-cols-1
                  min-[1200px]:grid-cols-[420px_1fr_360px]
                  min-[1400px]:grid-cols-[460px_1fr_380px]">
    {/* Left — Timing only */}
    <div className="flex flex-col gap-3">
      <TimingTower entries={raceSim.timing} />
    </div>

    {/* Center — Map (top) + Tires (bottom) */}
    <div className="flex flex-col gap-3">
      <CircuitMap ... />
      <TireStrategy ... />
    </div>

    {/* Right — Commands + Battles + Feed */}
    <div className="flex flex-col gap-3">
      {playerDrivers.map(driver => (
        <DriverCommands key={driver.id} ... />
      ))}
      <BattleForecast battles={raceSim.battles} />
      <CommentaryFeed entries={raceSim.commentary} />
    </div>
  </div>

  {/* Secondary collapsible GapChart row */}
  <GapChartRow timing={raceSim.timing} />
</>
```

- [ ] **Step 3.9: Add local toggle state + `GapChartRow` helper**

`src/app/strategy/page.tsx` is already `'use client'` (verified in Step 2.0). Add near the top of `StrategyPage`:

```tsx
const [showGapChart, setShowGapChart] = useState(false)
```

Define `GapChartRow` as an **inline helper function component** inside the same file (not a separate file — this keeps scope tight and avoids over-factoring a single-use component). Place it above the `StrategyPage` export or inside the file's top-level scope. It receives the `timing` prop and renders a collapsible panel with a toggle button.

```tsx
function GapChartRow({ timing, isOpen, onToggle }: {
  timing: typeof raceSimType.timing  // use the actual type from @/types/race
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="mt-4 bg-surface-paper border border-line-sub rounded-rad">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute hover:text-ink-hi transition-colors"
      >
        <span>Gap Chart · Top 10</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <GapChart
            entries={timing.slice(0, 10).map(t => ({
              driverId: t.driverId,
              driverName: t.driverName,
              teamColor: t.teamColor,
              gap: t.gapToLeader,
              isPlayer: t.isPlayer,
            }))}
          />
        </div>
      )}
    </div>
  )
}
```

**Local state only — no Zustand field, no store action.** This is a UI affordance, not game state.

- [ ] **Step 3.10: Tailwind class audit — live race files**

```bash
grep -E "bg-bg-(primary|secondary|surface)|text-text-(primary|secondary|muted|dim)|border-border-(default|hover)|bg-accent-(lime|cyan|red|amber|purple)" \
  src/components/strategy/timing-tower.tsx \
  src/components/strategy/circuit-map.tsx \
  src/components/strategy/tire-strategy.tsx \
  src/components/strategy/driver-commands.tsx \
  src/components/strategy/battle-forecast.tsx \
  src/components/strategy/commentary-feed.tsx \
  src/components/charts/gap-chart.tsx
```
Expected: no output.

- [ ] **Step 3.11: Verify type-check, tests, lint**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
```

- [ ] **Step 3.12: HTTP 200 + visual comparison — live race**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/strategy --max-time 30
```
Then start a race from Paddock, let the simulation run, and compare `/strategy` live-race view against `new-designs/Strategy Page.html`. Verify:
- Main grid matches the 3-column proportions at both 1200px and 1400px breakpoints.
- Each component renders in Broadcast colors.
- No functional regression (timing updates, car dots move, commands dispatch).
- `GapChart` collapsed by default, toggle reveals it below main grid.

Minimum two comparison rounds; iterate until mismatches are minimal.

- [ ] **Step 3.13: Commit**

```bash
git add src/components/strategy/timing-tower.tsx \
        src/components/strategy/circuit-map.tsx \
        src/components/strategy/tire-strategy.tsx \
        src/components/strategy/driver-commands.tsx \
        src/components/strategy/battle-forecast.tsx \
        src/components/strategy/commentary-feed.tsx \
        src/components/charts/gap-chart.tsx \
        src/app/strategy/page.tsx
git commit -m "feat(strategy-redesign): restyle + regroup live race view (Task 3/5)

Restyle TimingTower, CircuitMap, TireStrategy, DriverCommands,
BattleForecast, CommentaryFeed, GapChart to Broadcast tokens.
Regroup main grid to 460|1fr|380 with CircuitMap+TireStrategy in
the center column and BattleForecast moved to right column.
GapChart moved to collapsible secondary row with local useState
toggle.

No store/engine/worker changes. Pipeline B.

Spec §5.2, §9 Step 3."
```

---

## Task 4 — Pre-Race View Restyle

**Goal:** Restyle pre-race setup including internal tabs for Sessions&Programs / Setup / Intel / Planner. Restyle `RaceIntelPanel` and `StrategyPlanner`. Resolve qualifying-grid open question.

**Files:**
- Modify: `src/components/strategy/pre-race-setup.tsx`, `src/components/strategy/race-intel-panel.tsx`, `src/components/strategy/strategy-planner.tsx`

- [ ] **Step 4.1: Resolve qualifying-grid open question (READ-ONLY)**

**This step is READ-ONLY.** You may `Read` and grep any file in the repo to answer the question, but you may **NOT** edit any file outside the plan's "Files MODIFIED" list. Specifically, do not add a `qualifyingResults` field to any type, store, or engine file. If the data isn't there, apply the fallback — do not invent the data.

Read `src/components/strategy/pre-race-setup.tsx` in full. Determine whether a qualifying results grid is already rendered (look for `currentRound` qualifying results, grid positions, or similar data).

- **If yes:** plan to style it as `.pre-grid-strip`/`.quali-wrap` (reference `new-designs/pages.css` lines 101–123).
- **If no:** skip that visual. Pre-race hero stays as round-name + driver-roster grid. Document the decision inline in a one-line code comment (e.g. `// IP-P1: qualifying grid dropped — no pre-race qualifying results in store`).

- [ ] **Step 4.2: Restyle `pre-race-setup.tsx` — hero block**

Reference: `new-designs/app.css` lines 935–1068. Implement:
- `.pre-left` round-name hero with gradient ellipse background, round badge, race name in `font-display` 64px, stats row (circuit length, laps, winner last year, etc.).
- `.pre-drivers` column with player team's drivers, team-colored left border, large driver number in `font-display`.

Fields populate from existing `race`, `playerTeam`, `playerDrivers` props.

- [ ] **Step 4.3: Add tab state to `pre-race-setup.tsx`**

```tsx
const [activeTab, setActiveTab] = useState<'sessions' | 'setup' | 'intel' | 'planner'>('sessions')

// Reset tab when the phase transitions (practice → qualifying). Without this,
// tab state could leak across phase transitions if the component remounts with
// a fresh `phase` prop. If React unmounts the component naturally on each
// phase change, this is a no-op. Still safer to include.
useEffect(() => {
  setActiveTab('sessions')
}, [phase])
```

Render a tab bar that maps to `.phase-switcher` styling (reference `new-designs/app.css` lines 908–932). Each tab mounts its corresponding content block.

- [ ] **Step 4.4: Restyle Sessions & Programs tab**

Reference: `new-designs/pages.css` lines 41–82.
- Session row → `.session-card` with `done` (progress bar full), `active` (red border, gradient), `pending` (dim) variants.
- Practice program cards → `.prog-card` with icon letter in `font-display` 38px, hover/active red border.

Use existing `PRACTICE_PROGRAMS` array and `onStartSession` callback — no prop changes.

- [ ] **Step 4.5: Restyle Setup tab**

Reference: `new-designs/pages.css` lines 85–98. `.setup-grid` 2-column, each row a `.setup-track` slider with mid-tick and fill gradient.

**Fallback if no sliders exist.** If the current setup UI in `pre-race-setup.tsx` doesn't expose numeric sliders (read to confirm), restyle whatever controls exist (dropdowns, select buttons, toggles) using the `.setup-grid` 2-column wrapper and Broadcast panel tokens:
- Wrapper: `bg-surface-paper border border-line-sub rounded-rad p-5`
- Control labels: `font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute`
- Control values: `font-mono font-bold text-[14px] text-ink-hi`

**Do not invent new controls.** If the tab currently has only informational cards, render those cards in the same `.setup-grid` layout. Never add form inputs the existing state doesn't back.

- [ ] **Step 4.6: Host `<RaceIntelPanel>` inside Intel tab**

Keep the existing `RaceIntelPanel` component and its props. Render it inside the Intel tab content block. The panel itself is restyled in Step 4.8.

- [ ] **Step 4.7: Host `<StrategyPlanner>` inside Planner tab**

Render `StrategyPlanner` with the existing `onSelectStrategies` callback inside the Planner tab content block. Prop flow unchanged.

- [ ] **Step 4.8: Restyle `race-intel-panel.tsx`**

Read the file. For each tile currently rendered, restyle to Broadcast panel style (`.panel` + `.panel-head` from `new-designs/app.css` lines 463–480). If the component renders:
- A tire degradation curve → adopt `.chart-curve.s/m/h` styling (ref `new-designs/Strategy Intel.html` `DegChart`).
- A weather widget → adopt `.rain-chart` area-chart styling.
- Pace deltas or similar tiles → use `.w-cell` layout (`new-designs/app.css` lines 860–872).

Drop any attempt to render cliff markers, pace-delta chart, or track-evolution gauge — these are on the §7 drop list.

- [ ] **Step 4.9: Restyle `strategy-planner.tsx` → `.gantt-row` per driver**

Reference: `new-designs/pages.css` lines 126–207.
- Header becomes `.planner-title-card` with red left border, `font-display` 36px title.
- Each player driver's chosen strategy becomes a single `.gantt-row` with:
  - `130px` label column (`.gantt-label`: driver code + "RECOMMENDED" or description subline)
  - `1fr` track with lap marks, stint segments colored by compound, pit markers
  - `80px` confidence column — **hidden or replaced with neutral "CHOSEN" badge**, since we don't compute confidence %
- Drop the 4-alternative-plans UI, undercut simulator, risk tag (§7 drop list).

- [ ] **Step 4.10: Tailwind class audit — pre-race files**

```bash
grep -E "bg-bg-(primary|secondary|surface)|text-text-(primary|secondary|muted|dim)|border-border-(default|hover)|bg-accent-(lime|cyan|red|amber|purple)" \
  src/components/strategy/pre-race-setup.tsx \
  src/components/strategy/race-intel-panel.tsx \
  src/components/strategy/strategy-planner.tsx
```
Expected: no output.

- [ ] **Step 4.11: Verify type-check, tests, lint**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
```

- [ ] **Step 4.12: Visual comparison — pre-race**

`npm run dev`. Start a new game, reach the practice phase. Compare `/strategy` pre-race view against `new-designs/Strategy Pre-Race.html` and tab content against `new-designs/Strategy Planner.html`. Verify:
- Hero block matches the round-name + stats + driver-roster layout.
- Tab bar renders and switches content.
- Pre-race → qualifying → race transition still works (tab state does not persist incorrectly across phase changes).

- [ ] **Step 4.13: Commit**

```bash
git add src/components/strategy/pre-race-setup.tsx \
        src/components/strategy/race-intel-panel.tsx \
        src/components/strategy/strategy-planner.tsx
git commit -m "feat(strategy-redesign): restyle pre-race view with internal tabs (Task 4/5)

Add internal tab state to PreRaceSetup (sessions | setup | intel |
planner). Restyle session cards, program cards, setup tracks, intel
panel, and Gantt planner to Broadcast tokens. Drop undercut
simulator, 4-alt plans, confidence %, risk tags per §7 drop list.

Prop flow unchanged; StrategyPlanner and RaceIntelPanel stay hosted
inside PreRaceSetup.

Spec §5.1, §9 Step 4."
```

---

## Task 5 — Post-Race View Restyle

**Goal:** Restyle `PostRaceResults` with podium, classification table, fastest-lap card. Resolve stint-analysis and standings-swing open questions. Apply fallback layouts if either drops.

**Files:**
- Modify: `src/components/strategy/post-race-results.tsx`

- [ ] **Step 5.1: Resolve stint-analysis open question (READ-ONLY)**

**This step is READ-ONLY.** You may `Read` and grep any file in `src/types/`, `src/engine/`, `src/stores/`, or `src/workers/` to answer the question. You may **NOT** edit any of those files. If the stint data isn't in the existing shape, apply the fallback — do not add a `stints` field anywhere.

Read `src/components/strategy/post-race-results.tsx`. Check its `results` prop shape and any data available from `raceSim.timing` / `raceSim.compoundHistory` at the post-race point. Per `src/types/race.ts` grep, no `stints` / `stintCompounds` top-level field exists — but `compoundHistory` may be derivable into stint segments.

- **If stint data is NOT derivable from existing fields:** skip the `.stint-analysis` section. Use the §5.3 fallback: post-wrap sidebar widens, classification fills left column.
- **If stint data IS derivable** (e.g., from `compoundHistory` + `pitLap` via a pure client-side transform inside the component): render `.stint-row` per driver using derived stint segments. The derivation lives inside the component — no engine or store change.

Document the decision as a one-line code comment.

- [ ] **Step 5.2: Resolve standings-swing open question**

Check whether championship pre-vs-post points delta is computed (grep the store or orchestrator for `preRaceStandings`, `raceResults` delta, etc. — **read only, do not modify**).

- **If yes:** render `.swing-bar-row` per top-N drivers with pre/post ranks and delta bars.
- **If no:** use §5.3 fallback — replace the right-sidebar swing block with a Championship snapshot tile showing current standings (data already in the store).

- [ ] **Step 5.3: Restyle `post-race-results.tsx` — hero block**

Reference: `new-designs/pages.css` has post-specific rules; `new-designs/app.css` lines 1070–1175 define `.post-hero`, `.post-podium`, `.podium-slot`, `.post-table`, `.fastest-card`.

Implement:
- `.post-hero` with diagonal stripe gradient (right-edge), red flag marker, race name in `font-display` 44px.
- `.post-podium` 3-column grid. P1 slot gets red accent border + shaded red background. Positions in `font-display` 52px.

- [ ] **Step 5.4: Restyle classification table → `.post-table-row`**

Reference: `new-designs/app.css` lines 1124–1144. Grid cols `38px 1fr 80px 90px` (pos, name, time/gap, points). Header row uses `.post-table-row.head` with uppercase mono labels.

- [ ] **Step 5.5: Restyle fastest-lap card → `.fastest-card`**

Reference: `new-designs/app.css` lines 1156–1165. Purple gradient background, fastest time in `font-display` 40px purple, driver name below.

- [ ] **Step 5.6: Implement stint analysis OR fallback per Step 5.1 decision**

If rendering stints: use `.stint-row` layout with `.stint-seg.{S|M|H}` colored segments proportional to laps-per-stint.

If falling back: skip the section entirely. Expand the post-wrap left column (no code comment cruft about the skipped row).

- [ ] **Step 5.7: Implement standings swing OR fallback per Step 5.2 decision**

If rendering: `.swing-bar-row` layout with `.swing-bar-track` bar.

If falling back: render a Championship snapshot tile listing current top drivers/constructors. Read data from existing `gameState.standings` or equivalent.

- [ ] **Step 5.8: Tailwind class audit — post-race file**

```bash
grep -E "bg-bg-(primary|secondary|surface)|text-text-(primary|secondary|muted|dim)|border-border-(default|hover)|bg-accent-(lime|cyan|red|amber|purple)" \
  src/components/strategy/post-race-results.tsx
```
Expected: no output.

- [ ] **Step 5.9: Verify type-check, tests, lint**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
```

- [ ] **Step 5.10: Visual comparison — post-race**

`npm run dev`. Play through a race to completion (or use dev-tools to advance to post-race phase). Compare `/strategy` post-race view against `new-designs/Strategy Post-Race.html`. Verify:
- Podium layout and coloring.
- Classification table columns.
- Fastest-lap purple card.
- Continue-to-management CTA renders and functions.

Minimum two comparison rounds.

- [ ] **Step 5.11: Final repo-wide Strategy audit**

```bash
# No old Tailwind classes remain anywhere in the Strategy surface,
# INCLUDING the gap-chart file which lives outside the strategy folder.
grep -rE "bg-bg-(primary|secondary|surface)|text-text-(primary|secondary|muted|dim)|border-border-(default|hover)|bg-accent-(lime|cyan|red|amber|purple)" \
  src/app/strategy/ src/components/strategy/ src/components/charts/gap-chart.tsx
```
Expected: zero hits. Any hit indicates an unmigrated surface — must be fixed before this commit.

Also verify the page `src/app/strategy/page.tsx` and gap-chart do not carry inline old-token arbitrary values:

```bash
grep -nE "bg-\[var\(--bg-primary\)\]|bg-\[var\(--bg-surface\)\]|bg-\[var\(--bg-secondary\)\]|text-\[var\(--text-(primary|secondary|muted|dim)\)\]|border-\[var\(--border-(default|hover)\)\]|\[var\(--accent-(lime|cyan|red|amber|purple)\)\]" \
  src/app/strategy/page.tsx src/components/charts/gap-chart.tsx
```
Expected: zero hits. Any inline arbitrary-value reference to an old Kinetic variable name means the restyle skipped a spot.

- [ ] **Step 5.12: Full regression sweep**

```bash
# Kinetic routes unchanged
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/paddock --max-time 30
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/factory --max-time 30
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/strategy --max-time 30

# All tests
npx vitest run

# Type and lint clean
npx tsc --noEmit
npm run lint
```

Visually re-compare `/paddock` and `/factory` against `scratch/baseline/` snapshots from P-3. Must still match byte-for-byte.

- [ ] **Step 5.13: Commit**

```bash
git add src/components/strategy/post-race-results.tsx
git commit -m "feat(strategy-redesign): restyle post-race view (Task 5/5)

Restyle PostRaceResults to .post-hero/.post-podium/.post-table/
.fastest-card. Conditional stint analysis + standings swing rows
per open-question resolution; fallback layouts applied where data
is not computed.

Strategy redesign complete. All /strategy surfaces now render in
Broadcast pit-wall aesthetic. Paddock, Factory, and other Kinetic
routes untouched.

Spec §5.3, §9 Step 5."
```

---

## Post-Implementation: Memory Update

After all 5 tasks are committed and verified:

- [ ] **Step M-1: Update memory with completed workstream (NOT a git commit)**

Update `C:\Users\kapsi\.claude\projects\c--Users-kapsi-OneDrive-Masa-st--f1-simulation\memory\project_frontend_redesign.md` to record Strategy redesign as complete and flag the next page target (likely Paddock per CLAUDE.md page list).

Update `MEMORY.md` index if the entry title changes.

**Note:** These files live OUTSIDE the project repo (in the user's global Claude memory directory). Do **not** `git add` or `git commit` them. They are personal memory and are not version-controlled in this project.

---

## Risk Register (Cross-Task)

| Risk | When it triggers | Recovery |
|---|---|---|
| Task 2 activates `theme="broadcast"` but one of the six `PageShell` sites is missed | Visible when that specific phase route is opened (pre-race / post-race / error / start-race) | Grep `<PageShell` in `strategy/page.tsx`, confirm every hit has `theme="broadcast"` |
| A restyled component accidentally breaks a data prop or callback | `npx vitest run` or a manual race run shows regression | Revert the single commit, re-examine the diff; keep prop signatures identical |
| New Broadcast oklch colors don't render correctly in an older browser | Visible via local screenshot | All modern evergreen browsers support oklch; if a legacy target surfaces, add rgb() fallbacks in `broadcast.css` |
| Tailwind class audit passes but a `className="bg-[var(--bg-primary)]"` inline still leaks | Grep command in Step 5.11 catches it | Add the inline arbitrary-value pattern to the audit grep if needed |
| Task 4 tab state persists across phase transitions incorrectly | Manual race run after Task 4 shows wrong initial tab on re-entry | Reset `activeTab` via `useEffect` on `phase` prop change |
| Task 5 stint/standings fallback layouts look empty | Screenshot comparison | Use §5.3 fallback (widened classification table or snapshot tile) — layout rebalances automatically |
| Dual-write Tailwind config doubles the production CSS bundle temporarily | Measured once post-Task 1 (check `npm run build` CSS output size) | Acceptable for this phase; cleanup commit in a later v1.1 phase removes old buckets |
| Reference HTML uses React 18 UMD + Babel standalone; our app is React 19 + TypeScript | `new-designs/` files are visual source material, never imported at runtime | All restyling is manual Tailwind-class authoring against the reference CSS. No runtime dependency on `new-designs/` |

---

## Out-of-Scope (Do Not Touch)

- Any file under `src/engine/`, `src/stores/`, `src/workers/`, `src/hooks/`, `src/types/`
- Schema migrations, IndexedDB persistence, worker protocol
- New features, new game data, new charts that don't already exist
- Kinetic-styled pages outside `/strategy` (Paddock, Factory, Driver Office, Financial HQ, Calendar, Regulations, Settings)
- `src/app/layout.tsx` (fonts are already wired)
- `src/app/globals.css`
- Any file under `tests/` — Pipeline B does not write tests; `verify` runs the existing suite

### Data access discipline

All race-data in UI flows through either `useRaceSimulation()` (for live-race components) or the existing store slice (for pre/post-race). **Never read from `gameStore.raceRuntime` directly** — that field is the race worker's authoritative buffer outside `world` (frozen per AGENTS.md §0.1 / IP-04 Option A). UI components have no business knowing about it. If you need a field that `useRaceSimulation()` doesn't expose, STOP and check in with the user — that's a contract question, not a UI task.
