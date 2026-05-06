# Drivers Redesign — IP-09b UI Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/drivers` page reference-accurate against `new-designs/drivers/` (Drivers Page.html, drivers.css, drivers-data.js). Apply a broadcast sub-theme scoped to this route only — the rest of the app stays Kinetic Command.

**Architecture:** All new components are functional React components reading from Zustand via `useShallow` selectors — none import from `src/engine/**` (types-only imports allowed). Game data composition lives in a new hook `useDriversPageData` that derives presentation-only values (peer averages, championship gaps, rivalry index) from `world`. Sub-theme tokens live in a CSS file imported only by `src/app/drivers/layout.tsx`. JetBrains Mono is loaded via `next/font/google` so it's only fetched when the user visits `/drivers`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind 4, Zustand 5 with `useShallow`, Vitest + React Testing Library + jsdom.

**Spec:** [`docs/superpowers/specs/2026-05-06-drivers-page-redesign-design.md`](../specs/2026-05-06-drivers-page-redesign-design.md)
**Prereq:** [`docs/superpowers/plans/2026-05-06-drivers-redesign-ip-09a-engine.md`](2026-05-06-drivers-redesign-ip-09a-engine.md) — must be merged before starting.

**Routing:** This entire plan belongs to the `ui-interface` agent per `AGENTS.md`. Pipeline B (UI-only).

---

## Pre-flight

### Task 0: Confirm IP-09a has landed

- [ ] **Step 1: Verify the engine commits are on the working branch**

Run: `git log --oneline -5`
Expected: see `feat(drivers): IP-09a engine + schema for drivers redesign` in recent history.

- [ ] **Step 2: Verify type and tests are green**

Run: `npx tsc --noEmit`
Run: `npx vitest run tests/engine/drivers tests/stores/file-scouting-report.test.ts`
Expected: clean.

- [ ] **Step 3: Read the visual reference**

Run: `Read new-designs/drivers/drivers.css` (full)
Run: `Read new-designs/drivers/Drivers Page.html` (full)
Run: `Read new-designs/drivers/drivers-data.js` (full)

These are the visual source of truth. Any mismatch between this plan and the reference files is resolved in favor of the reference files.

---

## IP-09b — UI Rebuild

### Task 14: Sub-theme tokens — `drivers-broadcast.css`

**Files:**
- Create: `src/styles/drivers-broadcast.css`

This file holds **all** broadcast-theme tokens scoped under `.drivers-broadcast`, plus all `.drv-*`, `.attr-*`, `.mood-*`, `.contract-*`, `.penalty-*`, `.scout-*` selectors copied from the reference CSS. The reference uses CSS variables that are not in our app's Tailwind setup; rather than fight the reference, we adopt its variables verbatim under our scope class.

- [ ] **Step 1: Create the file with the token block + reference styles**

Create `src/styles/drivers-broadcast.css`. Start with the token definitions:

```css
/*
 * Drivers page broadcast sub-theme. Scoped to `.drivers-broadcast`. Loaded
 * only via src/app/drivers/layout.tsx — does NOT belong in globals.
 *
 * Reference: new-designs/drivers/drivers.css
 * Spec: docs/superpowers/specs/2026-05-06-drivers-page-redesign-design.md §4.1
 */
.drivers-broadcast {
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --bg-void: oklch(0.13 0.005 250);
  --bg-base: oklch(0.16 0.006 250);
  --bg-paper: oklch(0.18 0.007 250);
  --bg-raised: oklch(0.22 0.008 250);
  --bg-hi: oklch(0.26 0.01 250);

  --ink-hi: oklch(0.96 0.01 250);
  --ink-body: oklch(0.82 0.01 250);
  --ink-mute: oklch(0.62 0.01 250);
  --ink-dim: oklch(0.45 0.01 250);

  --line-hair: oklch(0.28 0.005 250 / 0.7);
  --line-sub: oklch(0.34 0.006 250);
  --line-strong: oklch(0.42 0.008 250);

  --sig-cyan: oklch(0.78 0.16 220);
  --sig-amber: oklch(0.78 0.18 80);
  --sig-green: oklch(0.78 0.18 148);
  --sig-red: oklch(0.65 0.22 28);
  --sig-red-dk: oklch(0.42 0.18 28);

  /* --team and --team-dark are set inline on the page root from the player
     team's color via React style prop. Defaults provided here as fallback. */
  --team: var(--sig-cyan);
  --team-dark: oklch(0.28 0.10 220);

  background: var(--bg-void);
  color: var(--ink-body);
  font-family: var(--font-display);
  min-height: 100%;
}
```

- [ ] **Step 2: Append every selector from `new-designs/drivers/drivers.css` under the `.drivers-broadcast` namespace**

Copy `new-designs/drivers/drivers.css` content into the file. Wrap every top-level selector by prefixing `.drivers-broadcast`. For example:

Reference:
```css
.drv-wrap { max-width: 1400px; ... }
```

Becomes:
```css
.drivers-broadcast .drv-wrap { max-width: 1400px; ... }
```

For deeply nested selectors and pseudo-elements, prepend `.drivers-broadcast` to the leftmost class:

```css
.drv-tab.active .t-bar { ... }
```

becomes

```css
.drivers-broadcast .drv-tab.active .t-bar { ... }
```

This guarantees no token bleeds into the rest of the app.

- [ ] **Step 3: Commit**

```bash
git add src/styles/drivers-broadcast.css
git commit -m "$(cat <<'EOF'
feat(drivers): broadcast sub-theme stylesheet (IP-09b)

Scoped under .drivers-broadcast — loaded only by /drivers route.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Route layout — `src/app/drivers/layout.tsx`

**Files:**
- Create: `src/app/drivers/layout.tsx`

- [ ] **Step 1: Create the layout file**

```tsx
import type { ReactNode } from 'react'
import { JetBrains_Mono, Space_Grotesk, Inter } from 'next/font/google'
import '@/styles/drivers-broadcast.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export default function DriversLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`drivers-broadcast ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${inter.variable}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: clean (`Inter` and `Space_Grotesk` may already be loaded by the root layout — check `src/app/layout.tsx`. If they are, drop them from the route layout to avoid double-loading.)

- [ ] **Step 3: Commit**

```bash
git add src/app/drivers/layout.tsx
git commit -m "$(cat <<'EOF'
feat(drivers): route layout loads broadcast sub-theme + JetBrains Mono

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Pure presentation utils — `drivers-page.ts`

**Files:**
- Create: `src/lib/utils/drivers-page.ts`
- Create: `tests/lib/drivers-page.test.ts`

These helpers compute peer averages, championship summaries, rivalry index, and scout sort score from `world` data. Pure functions, no React, no engine imports.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/drivers-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  computePeerAttributes,
  computeChampionshipSummary,
  buildRivalryIndex,
  scoutScore,
} from '@/lib/utils/drivers-page'
import type { Driver, DriverAttributes } from '@/types/driver'
import type { Team } from '@/types/team'

const baseDriver = (id: string, overrides: Partial<Driver> = {}): Driver => ({
  id, firstName: id.toUpperCase(), lastName: 'X', shortName: id.slice(0, 3).toUpperCase(),
  nationality: 'X', age: 25, teamId: 't1',
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 20, confidence: 80 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('computePeerAttributes', () => {
  it('returns mean of every attribute across active non-reserve drivers', () => {
    const drivers = [
      baseDriver('a', { attributes: { pace: 90, racecraft: 80, experience: 70, mentality: 60, marketability: 50, developmentPotential: 40 } }),
      baseDriver('b', { attributes: { pace: 80, racecraft: 70, experience: 60, mentality: 50, marketability: 40, developmentPotential: 30 } }),
    ]
    const peer = computePeerAttributes(drivers)
    expect(peer.pace).toBe(85)
    expect(peer.racecraft).toBe(75)
    expect(peer.experience).toBe(65)
    expect(peer.mentality).toBe(55)
    expect(peer.marketability).toBe(45)
    expect(peer.developmentPotential).toBe(35)
  })

  it('excludes reserves and free agents from the average', () => {
    const drivers = [
      baseDriver('a', { attributes: { pace: 90 } as DriverAttributes }),
      baseDriver('reserve', { isReserve: true, attributes: { pace: 30 } as DriverAttributes }),
      baseDriver('free', { teamId: null, attributes: { pace: 10 } as DriverAttributes }),
    ]
    const peer = computePeerAttributes(drivers)
    expect(peer.pace).toBe(90)
  })
})

describe('computeChampionshipSummary', () => {
  it('ranks drivers by points and computes gaps', () => {
    const drivers = [
      baseDriver('a', { seasonStats: { ...baseDriver('a').seasonStats, points: 100 } }),
      baseDriver('b', { seasonStats: { ...baseDriver('b').seasonStats, points: 75 } }),
      baseDriver('c', { seasonStats: { ...baseDriver('c').seasonStats, points: 50 } }),
    ]
    const s = computeChampionshipSummary(drivers)
    expect(s.positionById['a']).toBe(1)
    expect(s.positionById['b']).toBe(2)
    expect(s.positionById['c']).toBe(3)
    expect(s.gapById['a']).toBe(25)  // leader: gap to P2
    expect(s.gapById['b']).toBe(-25) // behind leader
    expect(s.gapById['c']).toBe(-50)
  })
})

describe('buildRivalryIndex', () => {
  it('resolves targetDriverId to display fields', () => {
    const teams: Team[] = [{ id: 't1', name: 'Team One', shortName: 'T1' } as any]
    const drivers = [
      baseDriver('me', { rivalries: [{ targetDriverId: 'rival1', intensity: 70, cause: 'Q3 contact' }] }),
      baseDriver('rival1', { firstName: 'L', lastName: 'Norris', shortName: 'NOR', teamId: 't1' }),
    ]
    const idx = buildRivalryIndex(drivers, teams)
    expect(idx['rival1'].code).toBe('NOR')
    expect(idx['rival1'].name).toBe('L. Norris')
    expect(idx['rival1'].teamName).toBe('Team One')
  })
})

describe('scoutScore', () => {
  it('higher pace + devPot ranks higher', () => {
    const a = baseDriver('a', { attributes: { pace: 90, racecraft: 80, experience: 30, mentality: 70, marketability: 60, developmentPotential: 90 } })
    const b = baseDriver('b', { attributes: { pace: 70, racecraft: 60, experience: 30, mentality: 70, marketability: 50, developmentPotential: 60 } })
    expect(scoutScore(a) > scoutScore(b)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/drivers-page.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/utils/drivers-page.ts`:

```ts
import type { Driver, DriverAttributes } from '@/types/driver'
import type { Team } from '@/types/team'

/**
 * Average each attribute across active, non-reserve, contracted drivers.
 * Used to render the peer-comparison overlay on the attributes radar.
 *
 * Returns zeroed attributes if the input has no eligible drivers (avoids
 * NaN poisoning the UI).
 */
export function computePeerAttributes(drivers: Driver[]): DriverAttributes {
  const active = drivers.filter(d => !d.isReserve && d.teamId !== null)
  if (active.length === 0) {
    return { pace: 0, racecraft: 0, experience: 0, mentality: 0, marketability: 0, developmentPotential: 0 }
  }
  const sum = active.reduce<DriverAttributes>(
    (acc, d) => ({
      pace: acc.pace + d.attributes.pace,
      racecraft: acc.racecraft + d.attributes.racecraft,
      experience: acc.experience + d.attributes.experience,
      mentality: acc.mentality + d.attributes.mentality,
      marketability: acc.marketability + d.attributes.marketability,
      developmentPotential: acc.developmentPotential + d.attributes.developmentPotential,
    }),
    { pace: 0, racecraft: 0, experience: 0, mentality: 0, marketability: 0, developmentPotential: 0 },
  )
  const n = active.length
  return {
    pace: Math.round(sum.pace / n),
    racecraft: Math.round(sum.racecraft / n),
    experience: Math.round(sum.experience / n),
    mentality: Math.round(sum.mentality / n),
    marketability: Math.round(sum.marketability / n),
    developmentPotential: Math.round(sum.developmentPotential / n),
  }
}

export interface ChampionshipSummary {
  positionById: Record<string, number>
  gapById: Record<string, number>
}

/**
 * Rank active drivers by points and build per-driver position + gap maps.
 * Leader's gap = points clear of P2. Others = points behind leader (negative).
 */
export function computeChampionshipSummary(drivers: Driver[]): ChampionshipSummary {
  const sorted = [...drivers]
    .filter(d => !d.isReserve && d.teamId !== null)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  const positionById: Record<string, number> = {}
  const gapById: Record<string, number> = {}
  const leaderPts = sorted[0]?.seasonStats.points ?? 0
  const p2Pts = sorted[1]?.seasonStats.points ?? 0
  sorted.forEach((d, i) => {
    positionById[d.id] = i + 1
    gapById[d.id] = i === 0 ? leaderPts - p2Pts : d.seasonStats.points - leaderPts
  })
  return { positionById, gapById }
}

export interface RivalryDisplay {
  code: string
  name: string
  teamName: string
}

/**
 * Resolve `Driver.rivalries[*].targetDriverId` to display-ready strings by
 * looking up the target driver and their team. Returns a flat index keyed
 * by targetDriverId for fast component-level resolution.
 */
export function buildRivalryIndex(drivers: Driver[], teams: Team[]): Record<string, RivalryDisplay> {
  const driverById = new Map(drivers.map(d => [d.id, d]))
  const teamById = new Map(teams.map(t => [t.id, t]))
  const idx: Record<string, RivalryDisplay> = {}
  for (const d of drivers) {
    for (const r of d.rivalries) {
      if (idx[r.targetDriverId]) continue
      const target = driverById.get(r.targetDriverId)
      if (!target) continue
      const team = target.teamId ? teamById.get(target.teamId) : null
      idx[r.targetDriverId] = {
        code: target.shortName,
        name: `${target.firstName.charAt(0)}. ${target.lastName}`,
        teamName: team?.name ?? 'Free Agent',
      }
    }
  }
  return idx
}

/**
 * Composite score for sorting the scout pool. Higher = more interesting.
 * Pure presentation — does not affect engine state.
 */
export function scoutScore(driver: Driver): number {
  return driver.attributes.pace + driver.attributes.developmentPotential
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/drivers-page.test.ts`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/drivers-page.ts tests/lib/drivers-page.test.ts
git commit -m "$(cat <<'EOF'
feat(drivers): presentation utils for drivers page (IP-09b)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Selector hook — `useDriversPageData`

**Files:**
- Create: `src/hooks/use-drivers-page-data.ts`
- Create: `tests/hooks/use-drivers-page-data.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/use-drivers-page-data.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDriversPageData } from '@/hooks/use-drivers-page-data'
import { useGameStore } from '@/stores/game-store'

describe('useDriversPageData', () => {
  beforeEach(() => {
    // Set up a deterministic fixture world
  })

  it('returns null when no world is loaded', () => {
    useGameStore.setState({ world: null })
    const { result } = renderHook(() => useDriversPageData())
    expect(result.current).toBeNull()
  })

  it('returns roster (CAR-01, CAR-02, RESERVE) for the player team', () => {
    // Seed fixture world with player team having 2 active drivers + 1 reserve
    const fixture = makeFixtureWorld()
    useGameStore.setState({ world: fixture })
    const { result } = renderHook(() => useDriversPageData())
    expect(result.current!.roster.car01).toBeDefined()
    expect(result.current!.roster.car02).toBeDefined()
    expect(result.current!.roster.reserve).toBeDefined()
  })

  it('returns peer attributes derived across active drivers', () => {
    const fixture = makeFixtureWorld()
    useGameStore.setState({ world: fixture })
    const { result } = renderHook(() => useDriversPageData())
    expect(result.current!.peerAttributes.pace).toBeGreaterThan(0)
  })

  it('returns free agents sorted by composite scout score (desc)', () => {
    const fixture = makeFixtureWorldWithFreeAgents()
    useGameStore.setState({ world: fixture })
    const { result } = renderHook(() => useDriversPageData())
    const fa = result.current!.freeAgents
    for (let i = 1; i < fa.length; i++) {
      const prev = fa[i - 1].attributes.pace + fa[i - 1].attributes.developmentPotential
      const curr = fa[i].attributes.pace + fa[i].attributes.developmentPotential
      expect(prev >= curr).toBe(true)
    }
  })
})

function makeFixtureWorld() { /* minimal world builder */ }
function makeFixtureWorldWithFreeAgents() { /* minimal world builder with 3+ free agents */ }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/use-drivers-page-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/use-drivers-page-data.ts`:

```ts
'use client'

import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import {
  computePeerAttributes,
  computeChampionshipSummary,
  buildRivalryIndex,
  scoutScore,
} from '@/lib/utils/drivers-page'
import type { Driver, DriverAttributes } from '@/types/driver'
import type { Team } from '@/types/team'
import type { RivalryDisplay } from '@/lib/utils/drivers-page'

export interface DriversPageData {
  playerTeam: Team
  roster: {
    car01: Driver | null
    car02: Driver | null
    reserve: Driver | null
  }
  freeAgents: Driver[]
  peerAttributes: DriverAttributes
  championshipPositionByDriverId: Record<string, number>
  championshipGapByDriverId: Record<string, number>
  rivalryIndex: Record<string, RivalryDisplay>
  season: number
  currentRound: number
  nextRound: { id: string; name: string } | null
  constructorPosition: number
  rosterCount: { active: number; reserve: number }
  fileScoutingReport: (driverId: string) => void
  approachDriver: (driverId: string) => void
  openContractNegotiation: (driverId: string) => void
}

export function useDriversPageData(): DriversPageData | null {
  return useGameStore(useShallow(state => {
    if (!state.world) return null
    const world = state.world
    const playerTeam = world.teams.find(t => t.id === world.gameState.playerTeamId)
    if (!playerTeam) return null

    const playerDrivers = world.drivers.filter(d => d.teamId === playerTeam.id && !d.isReserve)
    const reserveDriver = world.drivers.find(d => d.teamId === playerTeam.id && d.isReserve) ?? null

    const peerAttributes = computePeerAttributes(world.drivers)
    const championship = computeChampionshipSummary(world.drivers)
    const rivalryIndex = buildRivalryIndex(world.drivers, world.teams)
    const freeAgents = world.drivers
      .filter(d => d.teamId === null)
      .sort((a, b) => scoutScore(b) - scoutScore(a))

    const teamsByPoints = [...world.teams].sort((a, b) =>
      (b.constructorPosition ?? 99) - (a.constructorPosition ?? 99),
    )
    const constructorPosition = playerTeam.constructorPosition ?? 0

    const nextRoundEntry = world.calendar.find(r => r.round === world.gameState.currentRound + 1)
      ?? world.calendar.find(r => r.round === world.gameState.currentRound)
    const nextRound = nextRoundEntry
      ? { id: `R${String(nextRoundEntry.round).padStart(2, '0')}`, name: nextRoundEntry.circuitName ?? nextRoundEntry.name ?? '' }
      : null

    return {
      playerTeam,
      roster: {
        car01: playerDrivers[0] ?? null,
        car02: playerDrivers[1] ?? null,
        reserve: reserveDriver,
      },
      freeAgents,
      peerAttributes,
      championshipPositionByDriverId: championship.positionById,
      championshipGapByDriverId: championship.gapById,
      rivalryIndex,
      season: world.gameState.season,
      currentRound: world.gameState.currentRound,
      nextRound,
      constructorPosition,
      rosterCount: {
        active: playerDrivers.length,
        reserve: reserveDriver ? 1 : 0,
      },
      fileScoutingReport: state.fileScoutingReport,
      approachDriver: state.approachDriver,
      openContractNegotiation: state.openContractNegotiation,
    }
  }))
}
```

If `state.approachDriver` and `state.openContractNegotiation` don't exist yet, Task 29 adds them as stubs. Until then the type-check will fail; that's expected.

- [ ] **Step 4: Note: stub actions land in Task 29**

The hook will type-error until the stub actions are added. Continue building components (which use the hook's types) — type-check fully after Task 29.

- [ ] **Step 5: Do not commit yet**

---

### Task 18: `<PageHeader>` component

**Files:**
- Create: `src/components/drivers/page-header.tsx`
- Create: `tests/components/drivers/page-header.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/drivers/page-header'

describe('<PageHeader>', () => {
  it('renders eyebrow with team name + season + round', () => {
    render(<PageHeader teamName="VANTAGE GP" season={2026} round={8}
      nextRound={{ id: 'R09', name: 'MONTRÉAL' }} constructorPos={2} rosterCount={{ active: 2, reserve: 1 }} />)
    expect(screen.getByText(/VANTAGE GP/)).toBeInTheDocument()
    expect(screen.getByText(/S2026/)).toBeInTheDocument()
    expect(screen.getByText(/R08/)).toBeInTheDocument()
  })

  it('renders next event meta', () => {
    render(<PageHeader teamName="X" season={1} round={1}
      nextRound={{ id: 'R02', name: 'MONACO' }} constructorPos={5} rosterCount={{ active: 2, reserve: 1 }} />)
    expect(screen.getByText(/MONACO/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement**

Create `src/components/drivers/page-header.tsx`:

```tsx
'use client'

interface PageHeaderProps {
  teamName: string
  season: number
  round: number
  nextRound: { id: string; name: string } | null
  constructorPos: number
  rosterCount: { active: number; reserve: number }
}

export function PageHeader({ teamName, season, round, nextRound, constructorPos, rosterCount }: PageHeaderProps) {
  return (
    <div className="drv-head">
      <div>
        <div className="h-eyebrow">◉ DRIVERS · {teamName.toUpperCase()} · S{season} R{String(round).padStart(2, '0')}</div>
        <div className="h-title">Driver Command</div>
      </div>
      <div className="h-meta">
        <div>
          <span className="k">NEXT EVENT</span>
          <span className="v">{nextRound ? `${nextRound.id} · ${nextRound.name}` : '—'}</span>
        </div>
        <div>
          <span className="k">CONSTRUCTORS</span>
          <span className="v amber">P{constructorPos}</span>
        </div>
        <div>
          <span className="k">ROSTER</span>
          <span className="v green">{rosterCount.active}+{rosterCount.reserve}R</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/components/drivers/page-header.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/drivers/page-header.tsx tests/components/drivers/page-header.test.tsx
git commit -m "feat(drivers): PageHeader component (IP-09b)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: `<DriverTabs>` component

**Files:**
- Create: `src/components/drivers/driver-tabs.tsx`
- Create: `tests/components/drivers/driver-tabs.test.tsx`
- Create: `src/lib/utils/driver-ovr.ts` (shared OVR helper)

- [ ] **Step 1: Write the OVR helper test + implementation**

Create `tests/lib/driver-ovr.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeDriverOvr } from '@/lib/utils/driver-ovr'

describe('computeDriverOvr', () => {
  it('matches the formula in new-designs/drivers/Drivers Page.html', () => {
    const ovr = computeDriverOvr({
      pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 50,
    })
    // (97*1.3 + 96*1.2 + 92*0.8 + 90*0.7 + 95*0.3 + 50*0.2) / 4.5
    // = 126.1 + 115.2 + 73.6 + 63 + 28.5 + 10 = 416.4 / 4.5 = 92.53… → 93
    expect(ovr).toBe(93)
  })
})
```

Create `src/lib/utils/driver-ovr.ts`:

```ts
import type { DriverAttributes } from '@/types/driver'

/**
 * Composite "overall" rating used in the broadcast UI. Formula matches
 * the reference design (new-designs/drivers/Drivers Page.html).
 *
 * Pure, presentation-only. Engine state never depends on this number.
 */
export function computeDriverOvr(a: DriverAttributes): number {
  return Math.round(
    (a.pace * 1.3 + a.racecraft * 1.2 + a.experience * 0.8 +
      a.mentality * 0.7 + a.marketability * 0.3 + a.developmentPotential * 0.2) / 4.5,
  )
}
```

Run: `npx vitest run tests/lib/driver-ovr.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the DriverTabs test**

Create `tests/components/drivers/driver-tabs.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriverTabs } from '@/components/drivers/driver-tabs'

const mkDriver = (id: string, name: string, isReserve = false) => ({
  id, firstName: name, lastName: 'X', shortName: id.slice(0, 3).toUpperCase(),
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  isReserve,
} as any)

describe('<DriverTabs>', () => {
  it('renders 4 tabs (CAR-01, CAR-02, RESERVE, SCOUT)', () => {
    render(<DriverTabs
      roster={{ car01: mkDriver('a', 'Alice'), car02: mkDriver('b', 'Bob'), reserve: mkDriver('c', 'Carl', true) }}
      scoutCount={5}
      teamColor="oklch(0.62 0.20 265)"
      active="CAR-01"
      onChange={vi.fn()}
    />)
    expect(screen.getByText(/ALICE X/)).toBeInTheDocument()
    expect(screen.getByText(/BOB X/)).toBeInTheDocument()
    expect(screen.getByText(/CARL X/)).toBeInTheDocument()
    expect(screen.getByText(/SCOUT POOL/)).toBeInTheDocument()
  })

  it('calls onChange with tab id on click', () => {
    const onChange = vi.fn()
    render(<DriverTabs
      roster={{ car01: mkDriver('a', 'Alice'), car02: mkDriver('b', 'Bob'), reserve: null }}
      scoutCount={0}
      teamColor="oklch(0.62 0.20 265)"
      active="CAR-01"
      onChange={onChange}
    />)
    fireEvent.click(screen.getByText(/SCOUT POOL/))
    expect(onChange).toHaveBeenCalledWith('SCOUT')
  })
})
```

- [ ] **Step 3: Implement**

Create `src/components/drivers/driver-tabs.tsx`:

```tsx
'use client'

import type { Driver } from '@/types/driver'
import { computeDriverOvr } from '@/lib/utils/driver-ovr'

export type TabId = 'CAR-01' | 'CAR-02' | 'RESERVE' | 'SCOUT'

interface DriverTabsProps {
  roster: { car01: Driver | null; car02: Driver | null; reserve: Driver | null }
  scoutCount: number
  teamColor: string
  active: TabId
  onChange: (id: TabId) => void
}

export function DriverTabs({ roster, scoutCount, teamColor, active, onChange }: DriverTabsProps) {
  const items: Array<{ id: TabId; slot: string; name: string; ovr: number; isScout: boolean }> = [
    roster.car01 && { id: 'CAR-01' as const, slot: 'CAR-01', name: `${roster.car01.firstName.toUpperCase()} ${roster.car01.lastName.toUpperCase()}`, ovr: computeDriverOvr(roster.car01.attributes), isScout: false },
    roster.car02 && { id: 'CAR-02' as const, slot: 'CAR-02', name: `${roster.car02.firstName.toUpperCase()} ${roster.car02.lastName.toUpperCase()}`, ovr: computeDriverOvr(roster.car02.attributes), isScout: false },
    roster.reserve && { id: 'RESERVE' as const, slot: 'RESERVE', name: `${roster.reserve.firstName.toUpperCase()} ${roster.reserve.lastName.toUpperCase()}`, ovr: computeDriverOvr(roster.reserve.attributes), isScout: false },
    { id: 'SCOUT' as const, slot: 'DIVISION', name: 'SCOUT POOL', ovr: scoutCount, isScout: true },
  ].filter(Boolean) as Array<{ id: TabId; slot: string; name: string; ovr: number; isScout: boolean }>

  return (
    <div className="drv-tabs" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(it => {
        const isActive = active === it.id
        const teamVar = it.isScout ? 'var(--sig-cyan)' : teamColor
        return (
          <button
            key={it.id}
            className={`drv-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(it.id)}
            style={{ ['--team' as string]: teamVar }}
          >
            <span className="t-bar" />
            <span className="t-body">
              <span className="t-slot">{it.slot}</span>
              <span className="t-name">{it.name}</span>
            </span>
            <span className="t-stat">
              <span className="ovr">{it.ovr}</span>
              {it.isScout ? 'AVAILABLE' : 'OVR'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run tests/components/drivers/driver-tabs.test.tsx tests/lib/driver-ovr.test.ts`

```bash
git add src/components/drivers/driver-tabs.tsx \
        src/lib/utils/driver-ovr.ts \
        tests/components/drivers/driver-tabs.test.tsx \
        tests/lib/driver-ovr.test.ts
git commit -m "feat(drivers): DriverTabs + computeDriverOvr (IP-09b)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: `<DriverPortrait>` component

**Files:**
- Create: `src/components/drivers/driver-portrait.tsx`
- Create: `tests/components/drivers/driver-portrait.test.tsx`

- [ ] **Step 1: Write the test**

Test the placeholder renders SVG stripes when `portraitUrl` is null, and renders an `<img>` when set.

- [ ] **Step 2: Implement** (mirror the JSX in `new-designs/drivers/Drivers Page.html` `function DriverPortrait`).

```tsx
'use client'

import type { Driver } from '@/types/driver'

export function DriverPortrait({ driver, color }: { driver: Driver; color: string }) {
  if (driver.portraitUrl) {
    return (
      <div className="portrait-frame">
        <img src={driver.portraitUrl} alt={`${driver.firstName} ${driver.lastName}`} className="portrait-img" />
      </div>
    )
  }
  return (
    <div className="portrait-frame">
      <svg className="portrait-stripes" viewBox="0 0 100 120" preserveAspectRatio="none">
        <defs>
          <pattern id={`stripes-${driver.shortName}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100" height="120" fill={color} fillOpacity="0.12" />
        <rect width="100" height="120" fill={`url(#stripes-${driver.shortName})`} />
      </svg>
      <div className="portrait-label">
        <span className="pl-tag">PORTRAIT</span>
        <span className="pl-id">{driver.firstName.toUpperCase()} {driver.lastName.toUpperCase()}</span>
        <span className="pl-meta">DROP IMAGE · 3:4 RECOMMENDED</span>
      </div>
      <div className="portrait-corner tl" />
      <div className="portrait-corner tr" />
      <div className="portrait-corner bl" />
      <div className="portrait-corner br" />
    </div>
  )
}
```

- [ ] **Step 3: Add `.portrait-img` rule to `drivers-broadcast.css`** (full-cover absolute positioning).

- [ ] **Step 4: Run tests, commit.**

---

### Task 21: `<AttrRadar>` component

**Files:**
- Create: `src/components/drivers/attr-radar.tsx`
- Create: `tests/components/drivers/attr-radar.test.tsx`

Mirror `function AttrRadar` from the reference HTML. Props: `{ attrs, peer, color }`. Test that paths are computed correctly and 6 labels render.

- [ ] **Step 1: Write tests**
- [ ] **Step 2: Implement** (copy radar logic from reference HTML)
- [ ] **Step 3: Run tests, commit.**

---

### Task 22: `<FormBars>` component

**Files:**
- Create: `src/components/drivers/form-bars.tsx`
- Create: `tests/components/drivers/form-bars.test.tsx`

Mirror the form-bars block from `<DriverHero>` in the reference. Props: `{ form: number[], lastRaceResult: number | null }`. Color-codes podium/points/midfield/back.

- [ ] **Step 1-3: Tests, implement, commit.**

---

### Task 23: `<DriverHero>` component

**Files:**
- Create: `src/components/drivers/driver-hero.tsx`
- Create: `tests/components/drivers/driver-hero.test.tsx`

Composes `<DriverPortrait>` + `<FormBars>`. Two-column layout: helmet column + ID column. Props:

```ts
{
  driver: Driver
  team: Team
  championshipPosition: number | null
  championshipGap: number | null
}
```

The page-level wiring in Task 30 resolves `championshipPositionByDriverId[driver.id]` before passing as scalars (per spec §4.3).

- [ ] **Step 1: Write tests** — covering:
  - World-title stars render only when `worldTitles > 0`
  - Career row renders only when `careerStarts > 0`
  - Championship row renders for active drivers; reserve variant renders "RESERVE STATUS"
  - 8-column stats grid renders correct values

- [ ] **Step 2: Implement** — copy JSX from reference `function DriverHero`. Use `computeDriverOvr` for the OVR badge.

- [ ] **Step 3: Run tests, commit.**

---

### Task 24: `<AttributesCard>` component

**Files:**
- Create: `src/components/drivers/attributes-card.tsx`
- Create: `tests/components/drivers/attributes-card.test.tsx`

Composes `<AttrRadar>` + horizontal bars with peer-delta chips. Props:

```ts
{ driver: Driver; peer: DriverAttributes; teamColor: string }
```

- [ ] **Step 1: Test** — peer delta computes `+5` / `-3`; bars render 6 attrs.
- [ ] **Step 2: Implement** — copy from reference `function AttributesCard`.
- [ ] **Step 3: Run tests, commit.**

---

### Task 25: `<MoodCard>` component

**Files:**
- Create: `src/components/drivers/mood-card.tsx`
- Create: `tests/components/drivers/mood-card.test.tsx`

Props:

```ts
{ driver: Driver; rivalryIndex: Record<string, RivalryDisplay> }
```

3-cell mood strip + rivalries list. Empty state for no rivalries. Use `moodTone(key, value)` and `moodLabel(key, value)` helpers from the reference.

- [ ] **Step 1: Test** — empty rivalries → dashed empty state; populated → rows resolve via index.
- [ ] **Step 2: Implement** — copy from reference `function MoodCard`. Extract `moodTone`/`moodLabel` to `src/lib/utils/mood-display.ts` (small helper file).
- [ ] **Step 3: Run tests, commit.**

---

### Task 26: `<ContractCard>` component (replaces `contract-panel.tsx`)

**Files:**
- Create: `src/components/drivers/contract-card.tsx`
- Create: `tests/components/drivers/contract-card.test.tsx`

Props:

```ts
{
  driver: Driver
  currentSeason: number
  onNegotiate: () => void
  onRelease: () => void
}
```

- [ ] **Step 1: Test** — null contract → free-agent fallback; `termEndSeason <= 1` → amber EOS pill; bonuses list; release-clause "None" when null; buttons fire callbacks.
- [ ] **Step 2: Implement** — copy from reference `function ContractCard`. Add `formatM` helper.
- [ ] **Step 3: Run tests, commit.**

---

### Task 27: `<PenaltyCard>` component (replaces `penalty-record-section.tsx`)

**Files:**
- Create: `src/components/drivers/penalty-card.tsx`
- Create: `src/lib/utils/penalty-expiry.ts`
- Create: `tests/lib/penalty-expiry.test.ts`
- Create: `tests/components/drivers/penalty-card.test.tsx`

Extract the expiry computation as a testable helper.

- [ ] **Step 1: Write penalty-expiry test**

```ts
import { describe, expect, it } from 'vitest'
import { computeExpiryRound } from '@/lib/utils/penalty-expiry'

describe('computeExpiryRound', () => {
  it('R5 + 22 rounds = R5 next season', () => {
    const e = computeExpiryRound(5, 2026, 22)
    expect(e.round).toBe(5)
    expect(e.season).toBe(2027)
  })

  it('R21 + 22 = R21 next season (not R43)', () => {
    const e = computeExpiryRound(21, 2026, 22)
    expect(e.round).toBe(21)
    expect(e.season).toBe(2027)
  })
})
```

Implement `src/lib/utils/penalty-expiry.ts`:

```ts
export function computeExpiryRound(
  issuedRound: number,
  issuedSeason: number,
  rollingWindow: number,
): { round: number; season: number } {
  const expRound = ((issuedRound + rollingWindow - 1) % 22) + 1
  const expSeason = issuedSeason + Math.floor((issuedRound + rollingWindow - 1) / 22)
  return { round: expRound, season: expSeason }
}
```

- [ ] **Step 2: Write the component test**

Cover: clean state, warning band states (3/6/9/12 thresholds), ban banner, grid-drop banner, entries sorted newest first, expiry round computed correctly via helper.

- [ ] **Step 3: Implement** the component. Copy from reference `function PenaltyCard`. Use `computeExpiryRound` instead of inlining the formula.

- [ ] **Step 4: Run tests, commit.**

---

### Task 28: `<ScoutPanel>` component (rewrite)

**Files:**
- Modify: `src/components/drivers/scout-panel.tsx` (rewrite)
- Create: `tests/components/drivers/scout-panel.test.tsx`

Props:

```ts
{
  scouts: Driver[]
  onApproach: (id: string) => void
  onFileReport: (id: string) => void
}
```

- [ ] **Step 1: Test** — sorted by composite; signal pills color correctly; `File Report` increments displayed count and may upgrade signal; `Approach` calls callback.
- [ ] **Step 2: Implement** — copy from reference `function ScoutPanel`. The header strip shows `total / F2 count / veteran count / recommended`. Each row uses `Driver.scoutSignal` and `Driver.scoutingReports`.
- [ ] **Step 3: Run tests, commit.**

---

### Task 29: Stub actions in game store

**Files:**
- Modify: `src/stores/game-store.ts` (add `approachDriver`, `openContractNegotiation` stubs)
- Modify: `docs/architecture/current-state-baseline.md` (document stubs as known-temporary)

- [ ] **Step 1: Add stubs to the store**

```ts
  approachDriver: (driverId: string) => {
    // STUB — IP-09b: free-agent negotiation flow not yet implemented.
    // Tracked in current-state-baseline.md.
    console.info('[stub] approachDriver', driverId)
    // Optionally call useUiStore.getState().showToast(...) if a toast slice exists.
  },
  openContractNegotiation: (driverId: string) => {
    // STUB — IP-09b: contract renegotiation flow not yet implemented.
    console.info('[stub] openContractNegotiation', driverId)
  },
```

Add the signatures to the store interface.

- [ ] **Step 2: Document stubs**

In `docs/architecture/current-state-baseline.md`, add a "Known stubs" section:

```markdown
## Known stubs (IP-09b)

- `gameStore.approachDriver(driverId)` — fires `console.info` only; no world mutation. Will be replaced when the free-agent negotiation flow ships.
- `gameStore.openContractNegotiation(driverId)` — same shape as above. Will be replaced when the contract renegotiation flow ships.
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: clean. The hook in Task 17 now compiles.

- [ ] **Step 4: Commit**

```bash
git add src/stores/game-store.ts docs/architecture/current-state-baseline.md
git commit -m "feat(drivers): stub actions for approachDriver/openContractNegotiation (IP-09b)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 30: Compose `src/app/drivers/page.tsx`

**Files:**
- Modify: `src/app/drivers/page.tsx` (full rewrite)
- Create: `tests/components/drivers/drivers-page.test.tsx`

- [ ] **Step 1: Write the smoke test**

```tsx
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DriversPage from '@/app/drivers/page'
import { useGameStore } from '@/stores/game-store'

describe('DriversPage smoke', () => {
  it('renders without crashing for a fixture world', () => {
    useGameStore.setState({ world: makeFixtureWorld() })
    render(<DriversPage />)
    expect(screen.getByText('Driver Command')).toBeInTheDocument()
  })

  it('switches tab to scout pool on click', () => {
    useGameStore.setState({ world: makeFixtureWorld() })
    render(<DriversPage />)
    fireEvent.click(screen.getByText(/SCOUT POOL/))
    expect(screen.getByText(/SCOUTED|FREE AGENT|F2/i)).toBeInTheDocument()
  })
})

function makeFixtureWorld() { /* ... */ }
```

- [ ] **Step 2: Rewrite the page**

```tsx
'use client'

import { useState } from 'react'
import { PageShell } from '@/components/layout/page-shell'
import { useDriversPageData } from '@/hooks/use-drivers-page-data'
import { PageHeader } from '@/components/drivers/page-header'
import { DriverTabs, type TabId } from '@/components/drivers/driver-tabs'
import { DriverHero } from '@/components/drivers/driver-hero'
import { AttributesCard } from '@/components/drivers/attributes-card'
import { MoodCard } from '@/components/drivers/mood-card'
import { ContractCard } from '@/components/drivers/contract-card'
import { PenaltyCard } from '@/components/drivers/penalty-card'
import { ScoutPanel } from '@/components/drivers/scout-panel'

export default function DriversPage() {
  const data = useDriversPageData()
  const [activeTab, setActiveTab] = useState<TabId>('CAR-01')

  if (!data) return null

  const driver =
    activeTab === 'CAR-01' ? data.roster.car01 :
    activeTab === 'CAR-02' ? data.roster.car02 :
    activeTab === 'RESERVE' ? data.roster.reserve : null

  const teamStyle: React.CSSProperties = {
    ['--team' as string]: data.playerTeam.color,
    ['--team-dark' as string]: data.playerTeam.colorDark ?? data.playerTeam.color,
  }

  return (
    <PageShell>
      <div className="drv-wrap" style={teamStyle}>
        <PageHeader
          teamName={data.playerTeam.name}
          season={data.season}
          round={data.currentRound}
          nextRound={data.nextRound}
          constructorPos={data.constructorPosition}
          rosterCount={data.rosterCount}
        />
        <DriverTabs
          roster={data.roster}
          scoutCount={data.freeAgents.length}
          teamColor={data.playerTeam.color}
          active={activeTab}
          onChange={setActiveTab}
        />
        {activeTab === 'SCOUT' ? (
          <ScoutPanel
            scouts={data.freeAgents}
            onApproach={data.approachDriver}
            onFileReport={data.fileScoutingReport}
          />
        ) : driver ? (
          <>
            <DriverHero
              driver={driver}
              team={data.playerTeam}
              championshipPosition={data.championshipPositionByDriverId[driver.id] ?? null}
              championshipGap={data.championshipGapByDriverId[driver.id] ?? null}
            />
            <div className="drv-grid">
              <AttributesCard driver={driver} peer={data.peerAttributes} teamColor={data.playerTeam.color} />
              <MoodCard driver={driver} rivalryIndex={data.rivalryIndex} />
              <ContractCard
                driver={driver}
                currentSeason={data.season}
                onNegotiate={() => data.openContractNegotiation(driver.id)}
                onRelease={() => { /* future */ }}
              />
            </div>
            <div className="drv-grid" style={{ marginTop: 14, gridTemplateColumns: '1fr' }}>
              <PenaltyCard driver={driver} currentSeason={data.season} currentRound={data.currentRound} />
            </div>
          </>
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-dim)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            No driver assigned to this slot
          </div>
        )}
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 3: Run tests + dev server smoke**

Run: `npx vitest run tests/components/drivers tests/hooks/use-drivers-page-data.test.ts tests/lib/drivers-page.test.ts`
Expected: green.

Run: `npm run dev` (background)
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/drivers --max-time 30`
Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add src/app/drivers/page.tsx tests/components/drivers/drivers-page.test.tsx
git commit -m "feat(drivers): rewrite /drivers page composition root (IP-09b)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 31: Delete obsolete components

**Files:**
- Delete: `src/components/drivers/driver-profile.tsx`
- Delete: `src/components/drivers/mood-tracker.tsx`
- Delete: `src/components/drivers/contract-panel.tsx`
- Delete: `src/components/drivers/penalty-record-section.tsx`
- Delete: any obsolete test files for the above

- [ ] **Step 1: Confirm no other file imports the obsolete components**

Run: `Grep "driver-profile|mood-tracker|contract-panel|penalty-record-section" src tests`
Expected: empty (or only matches inside files we're deleting / tests of deleted files).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/drivers/driver-profile.tsx
rm src/components/drivers/mood-tracker.tsx
rm src/components/drivers/contract-panel.tsx
rm src/components/drivers/penalty-record-section.tsx
```

Delete corresponding test files if any exist.

- [ ] **Step 3: Run type-check + full test suite**

Run: `npx tsc --noEmit`
Run: `npx vitest run`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(drivers): remove obsolete components after IP-09b rebuild

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 32: Visual review pass 1

- [ ] **Step 1: Open the reference and the live page side-by-side**

Open `new-designs/drivers/Drivers Page.html` directly in a browser.
Open `http://localhost:3000/drivers` in a second window.

- [ ] **Step 2: Diff visually at 1440×900**

Capture screenshots of both at the same viewport. Compare:
- Spacing (padding, gap, margin)
- Typography (font weight, size, letter-spacing, line-height)
- Color accuracy (oklch tokens render same hue across both)
- Border-radius, dashed-vs-solid lines
- Alignment of cells, columns, hero halves
- Form-bar heights and color classes
- Penalty band coloring transitions
- Tab active-state glow and bar visibility

- [ ] **Step 3: List visible mismatches as `# todo` comments inline in the relevant component file**

For each mismatch, add a `// FIXME(visual): <description>` comment near the offending JSX/CSS. Do NOT fix yet — gather them all first.

- [ ] **Step 4: Save the screenshots to a temporary scratch directory**

```bash
mkdir -p tmp/visual-review
# Save both screenshots as ip-09b-pass1-reference.png and ip-09b-pass1-live.png
```

- [ ] **Step 5: Do not commit yet — proceed to Task 33 to apply fixes.**

---

### Task 33: Visual review pass 2

- [ ] **Step 1: Resolve every `FIXME(visual)` comment**

Apply CSS or JSX changes one mismatch at a time. After each fix, refresh the live page and verify the diff against the reference shrinks.

- [ ] **Step 2: Re-screenshot at 1440×900**

Confirm the second pass is closer to reference than pass 1.

- [ ] **Step 3: Stop when differences are minimal**

"Minimal" = no spacing off by more than 2px, no font-weight mismatch, no color hue discrepancy, no missing element. Per `CLAUDE.md` frontend rules.

- [ ] **Step 4: Run type-check + lint + tests**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npx vitest run`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish(drivers): IP-09b visual review fixes

Two screenshot passes against new-designs/drivers/Drivers Page.html.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 34: Final IP-09 verification + code review

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: green.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: HTTP smoke**

Run: `npm run dev` (background)
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/drivers --max-time 30`
Expected: `200`.

- [ ] **Step 4: Engine purity check (final pass — should still be clean from IP-09a)**

Run: `python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine`
Expected: no illegal imports.

- [ ] **Step 5: Invoke `code-reviewer` agent on the full IP-09 (a + b combined)**

Use the `code-reviewer` subagent (see `.claude/agents/code-reviewer.md`). Hand it:
- Spec path: `docs/superpowers/specs/2026-05-06-drivers-page-redesign-design.md`
- Plan paths: `docs/superpowers/plans/2026-05-06-drivers-redesign-ip-09a-engine.md`, `docs/superpowers/plans/2026-05-06-drivers-redesign-ip-09b-ui.md`
- Diff: `git diff main..HEAD`

Reviewer produces CRITICAL/HIGH/MEDIUM/LOW findings.

- [ ] **Step 6: Action findings via `superpowers:receiving-code-review`**

Resolve every CRITICAL and HIGH finding. MEDIUM/LOW at discretion. Do not let findings sit unaddressed.

- [ ] **Step 7: Final commit / PR**

If working on a feature branch, open the PR. Title: `feat(drivers): IP-09 drivers page redesign (a engine + b UI)`. Body summarizes spec, plans, and acceptance-criteria coverage.

---

## Acceptance criteria check (from spec §7)

Before marking IP-09 complete, walk the spec's acceptance-criteria list and confirm each item:

1. ☐ `/drivers` rendered against fresh game shows new layout with team color accents
2. ☐ Verstappen hero shows `★★★★ 4× WORLD CHAMPION` and career trio `64 / 116 / 218`
3. ☐ Rookie hero shows neither stars nor career row
4. ☐ Attributes card shows fill in team color, peer marker dashed amber, delta chip
5. ☐ Mood card empty rivalries shows dashed empty state
6. ☐ Contract card `termEndSeason === 1` shows amber EOS pill
7. ☐ Penalty card 9+ points shows warning band, segments, entries, warnings, grid drop
8. ☐ Scout File Report increments displayed count + may upgrade pill
9. ☐ `/drivers` returns HTTP 200, no console errors
10. ☐ Pre-v13 save loads with new fields populated and correct types
11. ☐ Engine purity: dependency_analyzer reports no illegal imports
12. ☐ Vitest all green across `tests/engine/drivers`, `tests/components/drivers`, `tests/hooks`, `tests/lib`, migration test
13. ☐ `tsc --noEmit` and `npm run lint` clean
14. ☐ Visual diff vs `new-designs/drivers/Drivers Page.html` minimal across two passes

When all 14 boxes are ticked, IP-09 is done.

---

## What's next (out of scope, see spec §8)

Future workstreams that build on this:
- Real contract negotiation flow (replaces `openContractNegotiation` stub)
- Real free-agent negotiation flow (replaces `approachDriver` stub)
- Driver portrait image pipeline (already field-supported via `portraitUrl`)
- Scout-network economy
- Rivalry editing / event-driven creation
- Mobile/responsive layout
- Migrating Paddock/Factory/Strategy/Finance to broadcast sub-theme
