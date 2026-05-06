# Drivers Redesign — IP-09a Engine + Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the engine surface for the drivers page redesign — career stats, world titles, narrative pulse, scout signal, scouting reports — with a schema migration and real-world seed values for the 2026 grid. Sets the data contract that IP-09b (UI rebuild) consumes.

**Architecture:** Four new pure functions under `src/engine/drivers/` (`career-stats.ts`, `pulse.ts`, `scout-signal.ts`, `apply-scouting-report.ts`). Each is a `(state) → state` transform with no side effects, no `Math.random()`, no browser APIs, no imports from stores/hooks/components. Wired into the existing post-race / season-end / init paths without changing any orchestrator function signatures. New persisted fields land via a v12 → v13 schema migration that defaults values for existing saves and runs the helpers once so loaded saves render correctly.

**Tech Stack:** TypeScript strict mode, Vitest for tests, `idb` for IndexedDB persistence, Zustand for store state.

**Spec:** [`docs/superpowers/specs/2026-05-06-drivers-page-redesign-design.md`](../specs/2026-05-06-drivers-page-redesign-design.md)

**Routing:** This entire plan belongs to the `sim-engine` agent per `AGENTS.md`. Pipeline D (Persistence / Schema Migration) variant.

---

## Pre-flight: Seed-value audit

### Task A: Lock the real-world seed values

**Why first:** Spec §6 Q1 requires this audit before any code is written so the table in Task 11 doesn't get edited mid-implementation.

**Files:** none yet — this produces a reference table consumed by Task 11.

- [ ] **Step 1: Cross-check all 22 active drivers + 6 reserves against public records (statsf1.com, wikipedia, formula1.com)**

For each driver, record `worldTitles`, `careerWins`, `careerPodiums`, `careerStarts` as of end-of-2025 season. Use ±5 fuzz on `careerStarts` for drivers below 50 starts; round to nearest 5. Annotate any uncertain value inline.

The headline reference values from the spec (locked as of 2025 EOS):

| ID | Name | Titles | Wins | Podiums | Starts |
|---|---|---|---|---|---|
| verstappen | Max Verstappen | 4 | 64 | 116 | 218 |
| hamilton | Lewis Hamilton | 7 | 105 | 202 | 356 |
| alonso | Fernando Alonso | 2 | 32 | 106 | 406 |
| russell | George Russell | 0 | 4 | 18 | 137 |
| leclerc | Charles Leclerc | 0 | 8 | 44 | 158 |
| norris | Lando Norris | 0 | 5 | 25 | 137 |
| piastri | Oscar Piastri | 0 | 2 | 10 | 56 |
| sainz | Carlos Sainz | 0 | 4 | 27 | 217 |
| albon | Alex Albon | 0 | 0 | 2 | 119 |
| hulkenberg | Nico Hülkenberg | 0 | 0 | 1 | 230 |
| perez | Sergio Perez | 0 | 6 | 39 | 281 |
| bottas | Valtteri Bottas | 0 | 10 | 67 | 246 |
| ocon | Esteban Ocon | 0 | 1 | 4 | 167 |
| gasly | Pierre Gasly | 0 | 1 | 5 | 167 |
| stroll | Lance Stroll | 0 | 0 | 3 | 184 |
| lawson | Liam Lawson | 0 | 0 | 0 | 16 |
| bearman | Oliver Bearman | 0 | 0 | 0 | 12 |
| bortoleto | Gabriel Bortoleto | 0 | 0 | 0 | 23 |
| antonelli | Andrea Kimi Antonelli | 0 | 0 | 0 | 23 |
| hadjar | Isack Hadjar | 0 | 0 | 0 | 23 |
| lindblad | Arvid Lindblad | 0 | 0 | 0 | 0 |
| colapinto | Franco Colapinto | 0 | 0 | 0 | 32 |

Reserves and any other drivers in `DRIVERS` get audited with the same method. Drivers with no real-world counterpart (custom NPCs) start at 0/0/0/0.

- [ ] **Step 2: Save the audit table as a markdown comment block at the top of the seed file (Task 11 consumes it)**

No commit yet — the table goes inline with the seed update.

---

## IP-09a — Engine + Schema

### Task 1: Extend `Driver` type with new fields

**Files:**
- Modify: `src/types/driver.ts:66-114`

- [ ] **Step 1: Add `DriverPulse` and `ScoutSignal` types above the `Driver` interface**

Edit `src/types/driver.ts` to add (above `interface Driver`):

```ts
export interface DriverPulse {
  /** Short status, target ≤ 32 chars. Empty string before first init. */
  headline: string
  /** Factual one-liner assembled from current-season state. Empty string before first init. */
  detail: string
}

export type ScoutSignal = 'hot' | 'tracking' | 'available'
```

- [ ] **Step 2: Add new fields to `Driver` interface**

Inside `interface Driver`, add (preserve existing field order; new fields go at the end before the closing brace):

```ts
  /**
   * Running total of career race wins across all seasons. Incremented by
   * `applyRaceCareerDeltas` in `processPostRace` when finishing P1.
   * Pre-seeded from real-world EOS-2025 values for the 2026 grid; existing
   * saves default to 0 via the v12→v13 migration.
   */
  careerWins: number
  /** Career podiums (P1–P3). See `careerWins` for accumulation model. */
  careerPodiums: number
  /** Career race starts (every finished or DNF'd race counts). */
  careerStarts: number
  /**
   * Drivers' Championship titles won. Incremented by
   * `applySeasonEndCareerDeltas` when this driver finishes P1 in the final
   * standings.
   */
  worldTitles: number
  /**
   * Per-driver narrative status, regenerated each round and on game init by
   * `derivePulse`. See `src/engine/drivers/pulse.ts` for the 13-branch table.
   */
  pulse: DriverPulse
  /**
   * Optional URL to a driver portrait image. Null = render the stripe SVG
   * placeholder. UI is responsible for image hosting; engine treats this as
   * an opaque string.
   */
  portraitUrl: string | null
  /**
   * Scout pool signal — derived from observable state by `computeScoutSignal`.
   * Semantically meaningful when teamId === null OR isF2; computed for every
   * driver so the field is always populated.
   */
  scoutSignal: ScoutSignal
  /**
   * Count of player-filed scouting reports on this driver. Persists across
   * seasons. High counts upgrade `scoutSignal` per `computeScoutSignal`.
   * Incremented only via the `fileScoutingReport` store action.
   */
  scoutingReports: number
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: FAIL — every existing `Driver` literal in `src/data/drivers.ts`, fixtures, and tests is now missing required fields. This failure is intentional; we'll fix the seed file in Task 11 and fixtures as we go. Do **not** commit yet.

- [ ] **Step 4: Note: do not commit yet**

The repo will not type-check until Tasks 2–11 land. We commit at the end of Task 11.

---

### Task 2: Pure helper — `career-stats.ts`

**Files:**
- Create: `src/engine/drivers/career-stats.ts`
- Create: `tests/engine/drivers/career-stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/drivers/career-stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyRaceCareerDeltas,
  applySeasonEndCareerDeltas,
} from '@/engine/drivers/career-stats'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 25, teamId: 't1',
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 10, confidence: 80 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 10, careerPodiums: 25, careerStarts: 100, worldTitles: 1,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('applyRaceCareerDeltas', () => {
  it('increments careerStarts on every result (P1)', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 1)
    expect(result.careerStarts).toBe(101)
  })

  it('increments careerStarts on a DNF (position 21 sentinel)', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 21)
    expect(result.careerStarts).toBe(101)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(25)
  })

  it('increments careerWins and careerPodiums on P1', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 1)
    expect(result.careerWins).toBe(11)
    expect(result.careerPodiums).toBe(26)
  })

  it('increments careerPodiums but not careerWins on P3', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 3)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(26)
  })

  it('increments only careerStarts on P10', () => {
    const result = applyRaceCareerDeltas(baseDriver(), 10)
    expect(result.careerStarts).toBe(101)
    expect(result.careerWins).toBe(10)
    expect(result.careerPodiums).toBe(25)
  })

  it('returns a new object (no mutation)', () => {
    const driver = baseDriver()
    const result = applyRaceCareerDeltas(driver, 1)
    expect(result).not.toBe(driver)
    expect(driver.careerWins).toBe(10) // unchanged
  })
})

describe('applySeasonEndCareerDeltas', () => {
  it('increments worldTitles when finalStanding is 1', () => {
    const result = applySeasonEndCareerDeltas(baseDriver(), 1)
    expect(result.worldTitles).toBe(2)
  })

  it('does not increment worldTitles when finalStanding is 2 or worse', () => {
    expect(applySeasonEndCareerDeltas(baseDriver(), 2).worldTitles).toBe(1)
    expect(applySeasonEndCareerDeltas(baseDriver(), 22).worldTitles).toBe(1)
  })

  it('returns a new object (no mutation)', () => {
    const driver = baseDriver()
    const result = applySeasonEndCareerDeltas(driver, 1)
    expect(result).not.toBe(driver)
    expect(driver.worldTitles).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/drivers/career-stats.test.ts`
Expected: FAIL with "Cannot find module '@/engine/drivers/career-stats'"

- [ ] **Step 3: Write the implementation**

Create `src/engine/drivers/career-stats.ts`:

```ts
import type { Driver } from '@/types/driver'

/**
 * DNF sentinel value used by the form/result pipeline. Any position >= 21 is
 * treated as a DNF (matches `FORM_DNF` in `form-history.ts`). DNFs still
 * count as a career start.
 */
const DNF_THRESHOLD = 21

/**
 * Update career counters after a single race finish.
 *
 * Pure: returns a new Driver, does not mutate input.
 *
 * - `careerStarts` always increments (DNFs count as starts).
 * - `careerWins` increments iff finishingPosition === 1.
 * - `careerPodiums` increments iff 1 ≤ finishingPosition ≤ 3.
 *
 * Idempotency is the caller's responsibility: `processPostRace` already
 * gates per-driver updates on `seasonStats.lastProcessedRound`. This helper
 * is invoked from inside that guard so it cannot double-count.
 */
export function applyRaceCareerDeltas(driver: Driver, finishingPosition: number): Driver {
  const isDnf = finishingPosition >= DNF_THRESHOLD
  return {
    ...driver,
    careerStarts: driver.careerStarts + 1,
    careerWins: !isDnf && finishingPosition === 1
      ? driver.careerWins + 1
      : driver.careerWins,
    careerPodiums: !isDnf && finishingPosition >= 1 && finishingPosition <= 3
      ? driver.careerPodiums + 1
      : driver.careerPodiums,
  }
}

/**
 * Award a Drivers' Championship title at season end.
 *
 * Pure: returns a new Driver, does not mutate input.
 *
 * Called once per driver from `processSeasonEnd`. `finalStanding` is the
 * driver's final position in the Drivers' Championship after all rounds
 * have been processed (1 = champion).
 */
export function applySeasonEndCareerDeltas(driver: Driver, finalStanding: number): Driver {
  if (finalStanding !== 1) return driver
  return { ...driver, worldTitles: driver.worldTitles + 1 }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/drivers/career-stats.test.ts`
Expected: PASS, 9 tests green.

- [ ] **Step 5: Do not commit yet**

The repo doesn't type-check until later tasks land.

---

### Task 3: Pure helper — `pulse.ts`

**Files:**
- Create: `src/engine/drivers/pulse.ts`
- Create: `tests/engine/drivers/pulse.test.ts`

This is the largest helper — 13 ordered branches per spec §3.2.

- [ ] **Step 1: Write the failing tests, one branch per `describe` block**

Create `tests/engine/drivers/pulse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 25, teamId: 't1',
  attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
  mood: { motivation: 80, frustration: 20, confidence: 80 },
  contract: null, rivalries: [],
  seasonStats: { points: 50, wins: 1, podiums: 3, poles: 0, dnfs: 1, penalties: 0, bestFinish: 1, averageFinish: 6.0, lastProcessedRound: 8 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
  form: [3, 5, 1, 8], lastRaceResult: 8,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 100, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

const baseCtx = (overrides: Partial<PulseContext> = {}): PulseContext => ({
  championshipPositionByDriverId: { d1: 5 },
  championshipGapByDriverId: { d1: -50 },
  totalDriversInChampionship: 22,
  currentRound: 8,
  currentSeason: 1,
  ...overrides,
})

describe('derivePulse — branch order', () => {
  it('branch 1: reserve driver', () => {
    const r = derivePulse(baseDriver({ isReserve: true }), baseCtx())
    expect(r.headline).toBe('Reserve · race-ready')
    expect(r.detail).toBe('Simulator pace tracking · awaiting call-up window')
  })

  it('branch 2: free agent F2', () => {
    const r = derivePulse(
      baseDriver({ teamId: null, isF2: true, age: 19, scoutingReports: 7 }),
      baseCtx(),
    )
    expect(r.headline).toBe('F2 prospect — on the radar')
    expect(r.detail).toBe('7 scouting reports filed · 19 years old')
  })

  it('branch 3: free agent veteran', () => {
    const r = derivePulse(
      baseDriver({ teamId: null, isF2: false, careerStarts: 130, careerWins: 4, careerPodiums: 12 }),
      baseCtx(),
    )
    expect(r.headline).toBe('Free agent · seeking seat')
    expect(r.detail).toBe('130 career starts · 4W / 12P')
  })

  it('branch 4: championship leader', () => {
    const r = derivePulse(
      baseDriver({ seasonStats: { points: 200, wins: 4, podiums: 6, poles: 3, dnfs: 1, penalties: 0, bestFinish: 1, averageFinish: 2.4, lastProcessedRound: 8 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 1 }, championshipGapByDriverId: { d1: 30 } }),
    )
    expect(r.headline).toBe('Leading the championship')
    expect(r.detail).toBe('4W in 8 · +30 on P2 · 1 DNF')
  })

  it('branch 5: P2 within 25 pts', () => {
    const r = derivePulse(
      baseDriver({ seasonStats: { points: 168, wins: 4, podiums: 6, poles: 3, dnfs: 1, penalties: 0, bestFinish: 1, averageFinish: 2.4, lastProcessedRound: 8 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 2 }, championshipGapByDriverId: { d1: -14 } }),
    )
    expect(r.headline).toBe('On championship pace')
    expect(r.detail).toBe('4W in 8 · trailing leader by 14 pts · 1 DNF')
  })

  it('branch 6: hot streak (3+ podiums in last 4)', () => {
    const r = derivePulse(
      baseDriver({ form: [2, 1, 3, 4], seasonStats: { points: 80, wins: 1, podiums: 3, poles: 0, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 2.5, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 4 }, championshipGapByDriverId: { d1: -60 } }),
    )
    expect(r.headline).toBe('On a hot streak')
    expect(r.detail).toBe('3 podiums in last 4 · best P1')
  })

  it('branch 7: DNF in last 2 races', () => {
    const r = derivePulse(
      baseDriver({ form: [3, 5, 21, 21], seasonStats: { points: 30, wins: 0, podiums: 1, poles: 0, dnfs: 2, penalties: 0, bestFinish: 3, averageFinish: 8, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 8 } }),
    )
    expect(r.headline).toBe('Reliability under fire')
    expect(r.detail).toBe('2 DNFs this season · last race DNF')
  })

  it('branch 8: stewards circling (>= 9 active points)', () => {
    const r = derivePulse(
      baseDriver({
        penaltyPoints: [
          { points: 4, issuedSeason: 1, issuedRound: 5, offenceType: 'causingCollision', raceId: 'r5' },
          { points: 3, issuedSeason: 1, issuedRound: 6, offenceType: 'speedingPitLane', raceId: 'r6' },
          { points: 3, issuedSeason: 1, issuedRound: 7, offenceType: 'ignoredFlags', raceId: 'r7' },
        ],
        warningsThisSeason: 2,
      }),
      baseCtx(),
    )
    expect(r.headline).toBe('Stewards circling')
    expect(r.detail).toBe('10 active penalty points · 2 warnings')
  })

  it('branch 9: rookie campaign', () => {
    const r = derivePulse(
      baseDriver({
        attributes: { pace: 78, racecraft: 70, experience: 30, mentality: 65, marketability: 60, developmentPotential: 90 },
        age: 21,
        seasonStats: { points: 14, wins: 0, podiums: 0, poles: 0, dnfs: 1, penalties: 3, bestFinish: 7, averageFinish: 12, lastProcessedRound: 6 },
      }),
      baseCtx({ championshipPositionByDriverId: { d1: 14 } }),
    )
    expect(r.headline).toBe('Rookie campaign — finding rhythm')
    expect(r.detail).toBe('P7 best · 3 penalties · qualifying ahead of race-day')
  })

  it('branch 10: pressure building (frustration >= 70)', () => {
    const r = derivePulse(
      baseDriver({
        mood: { motivation: 60, frustration: 75, confidence: 50 },
        lastRaceResult: 12,
      }),
      baseCtx({ championshipPositionByDriverId: { d1: 9 } }),
    )
    expect(r.headline).toBe('Pressure building')
    expect(r.detail).toBe('P9 · last race P12 · mood deteriorating')
  })

  it('branch 11: locked in', () => {
    const r = derivePulse(
      baseDriver({
        mood: { motivation: 90, frustration: 10, confidence: 88 },
        seasonStats: { points: 60, wins: 1, podiums: 2, poles: 0, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 5, lastProcessedRound: 6 },
      }),
      baseCtx({ championshipPositionByDriverId: { d1: 6 } }),
    )
    expect(r.headline).toBe('Locked in')
    expect(r.detail).toBe('P6 · 60 pts · 1W in 6')
  })

  it('branch 12: midfield grind (P11+)', () => {
    const r = derivePulse(
      baseDriver({ seasonStats: { points: 4, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 9, averageFinish: 13, lastProcessedRound: 6 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 13 } }),
    )
    expect(r.headline).toBe('Midfield grind')
    expect(r.detail).toBe('P13 · 4 pts · best P9')
  })

  it('branch 13: fallback (P5 default driver)', () => {
    const r = derivePulse(baseDriver(), baseCtx({ championshipPositionByDriverId: { d1: 5 } }))
    expect(r.headline).toBe('Chasing form')
    expect(r.detail).toBe('P5 · 50 pts · 8 rounds in')
  })
})

describe('derivePulse — determinism', () => {
  it('same input produces byte-identical output', () => {
    const driver = baseDriver()
    const ctx = baseCtx()
    const a = derivePulse(driver, ctx)
    const b = derivePulse(driver, ctx)
    expect(a).toEqual(b)
    expect(a).not.toBe(b) // new object each call
  })
})

describe('derivePulse — edge cases', () => {
  it('handles missing championship position (undefined → fallback)', () => {
    const r = derivePulse(baseDriver(), baseCtx({ championshipPositionByDriverId: {} }))
    expect(r.headline).toBeDefined()
    expect(r.detail).toBeDefined()
  })

  it('singularizes "1 DNF" but pluralizes "2 DNFs"', () => {
    const a = derivePulse(
      baseDriver({ form: [3, 5, 21, 21], seasonStats: { points: 30, wins: 0, podiums: 1, poles: 0, dnfs: 1, penalties: 0, bestFinish: 3, averageFinish: 8, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 8 } }),
    )
    expect(a.detail).toContain('1 DNF this season')

    const b = derivePulse(
      baseDriver({ form: [3, 5, 21, 21], seasonStats: { points: 30, wins: 0, podiums: 1, poles: 0, dnfs: 2, penalties: 0, bestFinish: 3, averageFinish: 8, lastProcessedRound: 4 } }),
      baseCtx({ championshipPositionByDriverId: { d1: 8 } }),
    )
    expect(b.detail).toContain('2 DNFs this season')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/drivers/pulse.test.ts`
Expected: FAIL with "Cannot find module '@/engine/drivers/pulse'"

- [ ] **Step 3: Write the implementation**

Create `src/engine/drivers/pulse.ts`:

```ts
import type { Driver, DriverPulse } from '@/types/driver'

const DNF_THRESHOLD = 21
const DETAIL_MAX = 96

export interface PulseContext {
  championshipPositionByDriverId: Record<string, number>
  championshipGapByDriverId: Record<string, number>
  totalDriversInChampionship: number
  currentRound: number
  currentSeason: number
}

/**
 * Per-driver narrative status. Pure, deterministic, branched on observable
 * state. Branch order matters — first match wins. See spec §3.2 for the
 * full table.
 *
 * Never calls Math.random or PRNG. Same input → byte-equal output.
 */
export function derivePulse(driver: Driver, ctx: PulseContext): DriverPulse {
  const pos = ctx.championshipPositionByDriverId[driver.id]
  const gap = ctx.championshipGapByDriverId[driver.id]
  const stats = driver.seasonStats
  const round = ctx.currentRound
  const dnfsRecent = driver.form.slice(-2).filter(p => p >= DNF_THRESHOLD).length
  const podiumsLast4 = driver.form.slice(-4).filter(p => p >= 1 && p <= 3).length
  const activePts = driver.penaltyPoints.reduce((s, e) => s + e.points, 0)

  // Branch 1: reserve
  if (driver.isReserve) {
    return finalize('Reserve · race-ready', 'Simulator pace tracking · awaiting call-up window')
  }
  // Branch 2: free agent F2
  if (driver.teamId === null && driver.isF2) {
    return finalize(
      'F2 prospect — on the radar',
      `${driver.scoutingReports} scouting reports filed · ${driver.age} years old`,
    )
  }
  // Branch 3: free agent veteran
  if (driver.teamId === null && !driver.isF2) {
    return finalize(
      'Free agent · seeking seat',
      `${driver.careerStarts} career starts · ${driver.careerWins}W / ${driver.careerPodiums}P`,
    )
  }
  // Branch 4: championship leader
  if (pos === 1) {
    return finalize(
      'Leading the championship',
      `${stats.wins}W in ${round} · +${gap} on P2 · ${stats.dnfs} ${plural('DNF', stats.dnfs)}`,
    )
  }
  // Branch 5: P2/P3 within 25 pts of leader
  if ((pos === 2 || pos === 3) && gap !== undefined && gap >= -25) {
    return finalize(
      'On championship pace',
      `${stats.wins}W in ${round} · trailing leader by ${Math.abs(gap)} pts · ${stats.dnfs} ${plural('DNF', stats.dnfs)}`,
    )
  }
  // Branch 6: hot streak (3+ podiums in last 4)
  if (podiumsLast4 >= 3) {
    return finalize(
      'On a hot streak',
      `${podiumsLast4} podiums in last 4 · best P${stats.bestFinish}`,
    )
  }
  // Branch 7: DNF in last 2 races
  if (dnfsRecent >= 1 && stats.dnfs >= 2) {
    const lastResult = driver.lastRaceResult === null ? 'DNF' : `P${driver.lastRaceResult}`
    return finalize(
      'Reliability under fire',
      `${stats.dnfs} ${plural('DNF', stats.dnfs)} this season · last race ${lastResult}`,
    )
  }
  // Branch 8: stewards circling (>= 9 active penalty points)
  if (activePts >= 9) {
    return finalize(
      'Stewards circling',
      `${activePts} active penalty points · ${driver.warningsThisSeason} warnings`,
    )
  }
  // Branch 9: rookie campaign
  if (driver.attributes.experience < 50 && driver.age <= 23) {
    return finalize(
      'Rookie campaign — finding rhythm',
      `P${stats.bestFinish} best · ${stats.penalties} penalties · qualifying ahead of race-day`,
    )
  }
  // Branch 10: pressure building
  if (driver.mood.frustration >= 70) {
    const lastResult = driver.lastRaceResult === null ? 'DNF' : `P${driver.lastRaceResult}`
    return finalize(
      'Pressure building',
      `P${pos ?? '?'} · last race ${lastResult} · mood deteriorating`,
    )
  }
  // Branch 11: locked in
  if (driver.mood.confidence >= 80 && driver.mood.motivation >= 80) {
    return finalize(
      'Locked in',
      `P${pos ?? '?'} · ${stats.points} pts · ${stats.wins}W in ${round}`,
    )
  }
  // Branch 12: midfield grind
  if (pos !== undefined && pos >= 11) {
    return finalize(
      'Midfield grind',
      `P${pos} · ${stats.points} pts · best P${stats.bestFinish}`,
    )
  }
  // Branch 13: fallback
  return finalize(
    'Chasing form',
    `P${pos ?? '?'} · ${stats.points} pts · ${round} rounds in`,
  )
}

function plural(word: string, n: number): string {
  return n === 1 ? word : `${word}s`
}

function finalize(headline: string, detail: string): DriverPulse {
  if (detail.length <= DETAIL_MAX) return { headline, detail }
  // Truncate after the last "·" that fits within the cap.
  const cap = detail.slice(0, DETAIL_MAX)
  const lastDot = cap.lastIndexOf(' · ')
  return {
    headline,
    detail: lastDot > 0 ? detail.slice(0, lastDot) : cap,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/drivers/pulse.test.ts`
Expected: PASS, all branches green.

- [ ] **Step 5: Do not commit yet**

---

### Task 4: Pure helper — `scout-signal.ts`

**Files:**
- Create: `src/engine/drivers/scout-signal.ts`
- Create: `tests/engine/drivers/scout-signal.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/drivers/scout-signal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 22, teamId: null,
  attributes: { pace: 80, racecraft: 75, experience: 30, mentality: 70, marketability: 60, developmentPotential: 80 },
  mood: { motivation: 80, frustration: 10, confidence: 70 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: true,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('computeScoutSignal', () => {
  it('hot when scoutingReports >= 8', () => {
    expect(computeScoutSignal(baseDriver({ scoutingReports: 8 }))).toBe('hot')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 12 }))).toBe('hot')
  })

  it('hot when pace >= 85 AND devPotential >= 85', () => {
    expect(computeScoutSignal(baseDriver({
      attributes: { pace: 85, racecraft: 70, experience: 30, mentality: 70, marketability: 60, developmentPotential: 85 },
      scoutingReports: 0,
    }))).toBe('hot')
  })

  it('not hot when pace 85 but devPotential 84', () => {
    expect(computeScoutSignal(baseDriver({
      attributes: { pace: 85, racecraft: 70, experience: 30, mentality: 70, marketability: 60, developmentPotential: 84 },
      scoutingReports: 0,
    }))).toBe('tracking') // F2 + devPot 84 hits branch 4
  })

  it('tracking when scoutingReports >= 4 (and < 8)', () => {
    expect(computeScoutSignal(baseDriver({ scoutingReports: 4 }))).toBe('tracking')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 7 }))).toBe('tracking')
  })

  it('tracking when isF2 AND devPotential >= 75', () => {
    expect(computeScoutSignal(baseDriver({ isF2: true, attributes: {
      pace: 70, racecraft: 60, experience: 20, mentality: 70, marketability: 50, developmentPotential: 75,
    } }))).toBe('tracking')
  })

  it('available otherwise', () => {
    expect(computeScoutSignal(baseDriver({
      isF2: false,
      attributes: { pace: 70, racecraft: 65, experience: 60, mentality: 70, marketability: 55, developmentPotential: 50 },
      scoutingReports: 0,
    }))).toBe('available')
  })

  it('exact threshold tests', () => {
    expect(computeScoutSignal(baseDriver({ scoutingReports: 7 }))).toBe('tracking')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 8 }))).toBe('hot')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 3, isF2: false }))).toBe('available')
    expect(computeScoutSignal(baseDriver({ scoutingReports: 4, isF2: false }))).toBe('tracking')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/drivers/scout-signal.test.ts`
Expected: FAIL with "Cannot find module '@/engine/drivers/scout-signal'"

- [ ] **Step 3: Write the implementation**

Create `src/engine/drivers/scout-signal.ts`:

```ts
import type { Driver, ScoutSignal } from '@/types/driver'

/**
 * Compute the scout-pool signal for a driver. Pure function.
 *
 * Branch order (first match wins):
 *   1. scoutingReports >= 8           → hot
 *   2. pace >= 85 && devPot >= 85     → hot
 *   3. scoutingReports >= 4           → tracking
 *   4. isF2 && devPot >= 75           → tracking
 *   5. otherwise                      → available
 *
 * Computed for every driver but semantically meaningful only for free agents
 * (teamId === null) or F2 prospects. Contracted drivers carry the signal
 * silently for type safety.
 */
export function computeScoutSignal(driver: Driver): ScoutSignal {
  if (driver.scoutingReports >= 8) return 'hot'
  if (driver.attributes.pace >= 85 && driver.attributes.developmentPotential >= 85) return 'hot'
  if (driver.scoutingReports >= 4) return 'tracking'
  if (driver.isF2 && driver.attributes.developmentPotential >= 75) return 'tracking'
  return 'available'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/drivers/scout-signal.test.ts`
Expected: PASS, 7 tests green.

- [ ] **Step 5: Do not commit yet**

---

### Task 5: Pure helper — `apply-scouting-report.ts`

**Files:**
- Create: `src/engine/drivers/apply-scouting-report.ts`
- Create: `tests/engine/drivers/apply-scouting-report.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/drivers/apply-scouting-report.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyScoutingReport } from '@/engine/drivers/apply-scouting-report'
import type { Driver } from '@/types/driver'

const baseDriver = (overrides: Partial<Driver> = {}): Driver => ({
  id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
  nationality: 'X', age: 20, teamId: null,
  attributes: { pace: 80, racecraft: 75, experience: 30, mentality: 70, marketability: 60, developmentPotential: 80 },
  mood: { motivation: 80, frustration: 10, confidence: 70 },
  contract: null, rivalries: [],
  seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0, lastProcessedRound: 0 },
  peakAge: 28, declineRate: 0.4, isReserve: false, isF2: true,
  form: [], lastRaceResult: null,
  penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  careerWins: 0, careerPodiums: 0, careerStarts: 0, worldTitles: 0,
  pulse: { headline: '', detail: '' }, portraitUrl: null,
  scoutSignal: 'available', scoutingReports: 0,
  ...overrides,
})

describe('applyScoutingReport', () => {
  it('increments scoutingReports by 1', () => {
    const r = applyScoutingReport(baseDriver({ scoutingReports: 3 }))
    expect(r.scoutingReports).toBe(4)
  })

  it('recomputes scoutSignal after increment (3 → 4 = available → tracking)', () => {
    const r = applyScoutingReport(baseDriver({ scoutingReports: 3, isF2: false, attributes: {
      pace: 70, racecraft: 60, experience: 60, mentality: 70, marketability: 55, developmentPotential: 50,
    } }))
    expect(r.scoutingReports).toBe(4)
    expect(r.scoutSignal).toBe('tracking')
  })

  it('recomputes scoutSignal after increment (7 → 8 = tracking → hot)', () => {
    const r = applyScoutingReport(baseDriver({ scoutingReports: 7 }))
    expect(r.scoutingReports).toBe(8)
    expect(r.scoutSignal).toBe('hot')
  })

  it('returns a new object (no mutation)', () => {
    const driver = baseDriver({ scoutingReports: 0 })
    const r = applyScoutingReport(driver)
    expect(r).not.toBe(driver)
    expect(driver.scoutingReports).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/drivers/apply-scouting-report.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the implementation**

Create `src/engine/drivers/apply-scouting-report.ts`:

```ts
import type { Driver } from '@/types/driver'
import { computeScoutSignal } from './scout-signal'

/**
 * File one scouting report on a driver: increment the counter and recompute
 * the signal. Pure function — returns a new Driver, does not mutate.
 *
 * The store action `fileScoutingReport` is the only caller; it gates
 * eligibility (free agent or F2 only) before invoking this helper.
 */
export function applyScoutingReport(driver: Driver): Driver {
  const next = { ...driver, scoutingReports: driver.scoutingReports + 1 }
  return { ...next, scoutSignal: computeScoutSignal(next) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/drivers/apply-scouting-report.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Do not commit yet**

---

### Task 6: Wire helpers into `processPostRace`

**Files:**
- Modify: `src/engine/core/post-race-processor.ts:148-158, 280-308`

- [ ] **Step 1: Add new imports at the top**

Edit `src/engine/core/post-race-processor.ts`. Find the existing imports (lines 1-16) and add:

```ts
import { applyRaceCareerDeltas } from '@/engine/drivers/career-stats'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
```

- [ ] **Step 2: Wire `applyRaceCareerDeltas` into the per-driver guarded block**

Find the block ending around line 158 (the per-driver `return { ...driver, seasonStats: stats, ... }`). Replace the return with:

```ts
    const formSample = result.dnf ? FORM_DNF : result.position
    const updatedFromRace = {
      ...driver,
      seasonStats: stats,
      form: pushForm(driver.form, formSample),
      lastRaceResult: result.dnf ? null : result.position,
      penaltyPoints,
      warningsThisSeason,
      nextRaceGridDrop,
      banUntilRound,
    }
    return applyRaceCareerDeltas(updatedFromRace, result.position)
```

This keeps the change inside the existing `lastProcessedRound`-guarded path so career counters cannot double-count.

- [ ] **Step 3: After all per-driver updates, recompute pulse + scoutSignal for every driver**

Find the final `return { teams, drivers, finance, narrativeEvents, eventCooldowns }` (line 302). **Just before** that return, add:

```ts
  // Recompute per-driver narrative pulse and scout signal after all
  // mutations have settled. Both are pure derivations from observable state;
  // running them last ensures they reflect the final post-race world.
  const championship = computeChampionshipSummary(updatedDrivers)
  const pulseCtx: PulseContext = {
    championshipPositionByDriverId: championship.positionById,
    championshipGapByDriverId: championship.gapById,
    totalDriversInChampionship: updatedDrivers.length,
    currentRound,
    currentSeason,
  }
  updatedDrivers = updatedDrivers.map(driver => ({
    ...driver,
    pulse: derivePulse(driver, pulseCtx),
    scoutSignal: computeScoutSignal(driver),
  }))
```

- [ ] **Step 4: Add the `computeChampionshipSummary` helper at the bottom of the file (above `export function processPostRace`)**

Actually move the helper above `processPostRace`. At the end of the imports block, add:

```ts
function computeChampionshipSummary(drivers: Driver[]): {
  positionById: Record<string, number>
  gapById: Record<string, number>
} {
  const sorted = [...drivers]
    .filter(d => !d.isReserve && d.teamId !== null)
    .sort((a, b) => b.seasonStats.points - a.seasonStats.points)
  const positionById: Record<string, number> = {}
  const gapById: Record<string, number> = {}
  const leaderPts = sorted[0]?.seasonStats.points ?? 0
  const p2Pts = sorted[1]?.seasonStats.points ?? 0
  sorted.forEach((d, i) => {
    positionById[d.id] = i + 1
    if (i === 0) {
      gapById[d.id] = leaderPts - p2Pts // leader's gap = points clear of P2
    } else {
      gapById[d.id] = d.seasonStats.points - leaderPts // negative = behind
    }
  })
  return { positionById, gapById }
}
```

- [ ] **Step 5: Run type-check**

Run: `npx tsc --noEmit`
Expected: still failing on `data/drivers.ts` (Task 11 fixes that), but no new errors in `post-race-processor.ts`.

- [ ] **Step 6: Run the post-race-processor tests**

Run: `npx vitest run tests/engine/core/post-race-processor.test.ts`
Expected: existing tests may need fixture updates to add the new Driver fields. Update fixtures by spreading from a `baseDriver()` helper that includes the new defaults. Tests should pass after fixture updates.

- [ ] **Step 7: Do not commit yet**

---

### Task 7: Wire helpers into `processSeasonEnd`

**Files:**
- Modify: `src/engine/core/season-end-processor.ts`

- [ ] **Step 1: Read the existing `processSeasonEnd` to find where it computes final standings**

Run: `Read src/engine/core/season-end-processor.ts`

Locate the block where final standings are computed (likely sorting drivers by points). Note its exact line range.

- [ ] **Step 2: Add imports**

Add to the top:

```ts
import { applySeasonEndCareerDeltas } from '@/engine/drivers/career-stats'
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
```

- [ ] **Step 3: Award titles after standings are computed**

After the standings sort but **before** the function returns, add:

```ts
  // Award world titles based on final standings.
  const titleWinnerId = sortedByPoints[0]?.id
  const driversWithTitles = drivers.map(d => {
    const finalStanding = sortedByPoints.findIndex(s => s.id === d.id) + 1 || drivers.length
    return applySeasonEndCareerDeltas(d, finalStanding)
  })

  // Recompute pulse + scoutSignal for the new season opener.
  const pulseCtx: PulseContext = {
    championshipPositionByDriverId: {}, // new season — no positions yet
    championshipGapByDriverId: {},
    totalDriversInChampionship: driversWithTitles.length,
    currentRound: 0,
    currentSeason: nextSeason, // use the season-end-processor's "next season" variable name
  }
  const driversReady = driversWithTitles.map(d => ({
    ...d,
    pulse: derivePulse(d, pulseCtx),
    scoutSignal: computeScoutSignal(d),
  }))
```

Replace the local variable name (`sortedByPoints`, `nextSeason`) with whatever `season-end-processor.ts` actually uses. The intent is: after the existing season-end logic produces a sorted-by-points driver list, run the helpers.

- [ ] **Step 4: Update the return statement to use `driversReady` instead of `drivers`**

- [ ] **Step 5: Run type-check + season-end tests**

Run: `npx tsc --noEmit`
Run: `npx vitest run tests/engine/core/season-end-processor.test.ts`
Expected: tests pass after fixture updates.

- [ ] **Step 6: Do not commit yet**

---

### Task 8: Wire helpers into `initializeGame`

**Files:**
- Modify: `src/engine/core/state-manager.ts:189-244`

- [ ] **Step 1: Add imports**

Add to the top:

```ts
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
```

- [ ] **Step 2: Compute pulse + scoutSignal for each driver after the initial map (line 204-208)**

Replace:

```ts
  const drivers: Driver[] = DRIVERS.map(d => ({
    ...d,
    form: [],
    lastRaceResult: null,
  }))
```

With:

```ts
  const driversWithRuntime: Driver[] = DRIVERS.map(d => ({
    ...d,
    form: [],
    lastRaceResult: null,
  }))
  // Synthetic first-init pulse + scoutSignal pass. Career stats are
  // pre-seeded in `data/drivers.ts`; we do not synthesize them here.
  const initCtx: PulseContext = {
    championshipPositionByDriverId: {},
    championshipGapByDriverId: {},
    totalDriversInChampionship: driversWithRuntime.length,
    currentRound: 1,
    currentSeason: 1,
  }
  const drivers: Driver[] = driversWithRuntime.map(d => ({
    ...d,
    pulse: derivePulse(d, initCtx),
    scoutSignal: computeScoutSignal(d),
  }))
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: still failing on `data/drivers.ts` until Task 11.

- [ ] **Step 4: Do not commit yet**

---

### Task 9: Add `fileScoutingReport` action to game store

**Files:**
- Modify: `src/stores/game-store.ts`
- Create: `tests/stores/file-scouting-report.test.ts`

- [ ] **Step 1: Read the existing `game-store.ts` to find the action pattern**

Run: `Read src/stores/game-store.ts`

Locate the actions section (likely a series of `setX(...)` or `applyY(...)` thin-dispatch functions inside the Zustand `create()` call). Note the existing pattern for actions that mutate `world.drivers`.

- [ ] **Step 2: Write the failing test**

Create `tests/stores/file-scouting-report.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'

describe('fileScoutingReport store action', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame() // or whatever exists
  })

  it('increments scoutingReports on a free-agent driver', () => {
    // Seed a fixture world with one free agent (teamId: null, scoutingReports: 0)
    const fixture = makeFixtureWorldWithFreeAgent()
    useGameStore.setState({ world: fixture })

    useGameStore.getState().fileScoutingReport('free-agent-1')

    const after = useGameStore.getState().world!.drivers.find(d => d.id === 'free-agent-1')!
    expect(after.scoutingReports).toBe(1)
  })

  it('updates scoutSignal after enough reports', () => {
    const fixture = makeFixtureWorldWithFreeAgent({ scoutingReports: 7 }) // one shy of hot
    useGameStore.setState({ world: fixture })

    useGameStore.getState().fileScoutingReport('free-agent-1')

    const after = useGameStore.getState().world!.drivers.find(d => d.id === 'free-agent-1')!
    expect(after.scoutSignal).toBe('hot')
  })

  it('no-ops on a contracted driver (gates eligibility)', () => {
    const fixture = makeFixtureWorldWithContractedDriver()
    useGameStore.setState({ world: fixture })

    useGameStore.getState().fileScoutingReport('contracted-1')

    const after = useGameStore.getState().world!.drivers.find(d => d.id === 'contracted-1')!
    expect(after.scoutingReports).toBe(0)
  })
})

// Helpers — implement using a minimal fixture builder. See existing tests
// in tests/stores/ for patterns.
function makeFixtureWorldWithFreeAgent(overrides = {}) { /* ... */ }
function makeFixtureWorldWithContractedDriver() { /* ... */ }
```

(Adapt fixture helpers to match the patterns used in other `tests/stores/*.test.ts` files; if a builder exists, reuse it.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/stores/file-scouting-report.test.ts`
Expected: FAIL — `fileScoutingReport` is not on the store.

- [ ] **Step 4: Add the action**

In `src/stores/game-store.ts`, add to the actions section:

```ts
  fileScoutingReport: (driverId: string) => set(state => {
    if (!state.world) return state
    const driver = state.world.drivers.find(d => d.id === driverId)
    if (!driver) return state
    // Eligibility gate: free agent or F2 only
    if (driver.teamId !== null && !driver.isF2) return state
    const updated = applyScoutingReport(driver)
    return {
      ...state,
      world: {
        ...state.world,
        drivers: state.world.drivers.map(d => d.id === driverId ? updated : d),
      },
    }
  }),
```

Add the import at the top:

```ts
import { applyScoutingReport } from '@/engine/drivers/apply-scouting-report'
```

Add the action signature to the store interface (search for `interface GameStore` or similar):

```ts
  fileScoutingReport: (driverId: string) => void
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/stores/file-scouting-report.test.ts`
Expected: PASS, 3 tests green.

- [ ] **Step 6: Do not commit yet**

---

### Task 10: Schema migration v12 → v13

**Files:**
- Modify: `src/engine/core/save-system.ts:14, 145-321 (MIGRATIONS map)`
- Create: `tests/engine/core/migration-v12-v13.test.ts`

- [ ] **Step 1: Read the existing migrations to find the pattern**

Run: `Read src/engine/core/save-system.ts` (offset 145, limit 200)

Note: `MIGRATIONS[N]` upgrades a save written at v(N) to v(N+1). Current `SCHEMA_VERSION` is 12, so `MIGRATIONS[11]` is the latest. We're adding `MIGRATIONS[12]` (v12 → v13) and bumping `SCHEMA_VERSION` to 13.

- [ ] **Step 2: Write the failing migration test**

Create `tests/engine/core/migration-v12-v13.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MIGRATIONS, SCHEMA_VERSION } from '@/engine/core/save-system'

describe('migration v12 → v13', () => {
  it('SCHEMA_VERSION is 13', () => {
    expect(SCHEMA_VERSION).toBe(13)
  })

  it('MIGRATIONS[12] exists', () => {
    expect(typeof MIGRATIONS[12]).toBe('function')
  })

  it('defaults all new Driver fields on every driver', () => {
    const v12Save = makeV12Save()
    const v13 = MIGRATIONS[12](v12Save)
    for (const driver of v13.drivers) {
      expect(driver.careerWins).toBe(0)
      expect(driver.careerPodiums).toBe(0)
      expect(driver.careerStarts).toBe(0)
      expect(driver.worldTitles).toBe(0)
      expect(driver.portraitUrl).toBeNull()
      expect(driver.scoutingReports).toBe(0)
    }
  })

  it('populates pulse and scoutSignal via helpers (deterministic)', () => {
    const v12Save = makeV12SaveWithChampionshipLeader('verstappen')
    const v13 = MIGRATIONS[12](v12Save)
    const verstappen = v13.drivers.find((d: any) => d.id === 'verstappen')!
    // Branch #4 (championship leader): "Leading the championship"
    expect(verstappen.pulse.headline).toBe('Leading the championship')
    expect(verstappen.scoutSignal).toBe('available') // contracted driver
  })

  it('does not mutate input', () => {
    const v12 = makeV12Save()
    const snapshot = JSON.stringify(v12)
    MIGRATIONS[12](v12)
    expect(JSON.stringify(v12)).toBe(snapshot)
  })
})

function makeV12Save() {
  // Minimal fixture: gameState + drivers without the new fields.
  return {
    gameState: { season: 1, currentRound: 5, phase: 'management', playerTeamId: 't1', scenario: 'standard', seed: 42, totalRaces: 22 },
    teams: [],
    drivers: [
      {
        id: 'd1', firstName: 'A', lastName: 'B', shortName: 'AB',
        nationality: 'X', age: 25, teamId: 't1',
        attributes: { pace: 80, racecraft: 80, experience: 60, mentality: 70, marketability: 60, developmentPotential: 70 },
        mood: { motivation: 80, frustration: 20, confidence: 70 },
        contract: null, rivalries: [],
        seasonStats: { points: 50, wins: 1, podiums: 3, poles: 0, dnfs: 0, penalties: 0, bestFinish: 1, averageFinish: 5, lastProcessedRound: 5 },
        peakAge: 28, declineRate: 0.4, isReserve: false, isF2: false,
        form: [3, 5, 1, 8], lastRaceResult: 8,
        penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
      },
    ],
    calendar: [], finance: {}, narrativeEvents: [], storyArcs: [],
    recommendations: [], stagedStrategies: {}, staffMarket: [], poachingAttempts: [],
  } as any
}

function makeV12SaveWithChampionshipLeader(driverId: string) {
  const save = makeV12Save()
  save.drivers[0].id = driverId
  save.drivers[0].seasonStats.points = 200
  save.drivers[0].seasonStats.wins = 4
  save.drivers[0].seasonStats.dnfs = 1
  return save
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/engine/core/migration-v12-v13.test.ts`
Expected: FAIL — `SCHEMA_VERSION` is 12 and `MIGRATIONS[12]` is undefined.

- [ ] **Step 4: Implement the migration**

In `src/engine/core/save-system.ts`:

a) Bump `SCHEMA_VERSION`:

```ts
export const SCHEMA_VERSION = 13
```

b) Add to imports at the top:

```ts
import { derivePulse, type PulseContext } from '@/engine/drivers/pulse'
import { computeScoutSignal } from '@/engine/drivers/scout-signal'
```

c) Add the migration block to the `MIGRATIONS` object. Place it after the existing `11:` entry:

```ts
  /**
   * v12 → v13 (IP-09a Drivers redesign): Adds career stats (`careerWins`,
   * `careerPodiums`, `careerStarts`, `worldTitles`), narrative `pulse`,
   * `portraitUrl`, `scoutSignal`, and `scoutingReports` on every driver.
   * All counters default to 0 (existing saves do not retroactively get
   * real-world numbers — only fresh games seeded via `data/drivers.ts`).
   * After defaulting, runs `derivePulse` and `computeScoutSignal` so
   * loaded saves render correctly without waiting for the next
   * post-race tick. See spec §3.4.
   */
  12: (data) => {
    const drivers = data.drivers.map(d => ({
      ...d,
      careerWins: 0,
      careerPodiums: 0,
      careerStarts: 0,
      worldTitles: 0,
      pulse: { headline: '', detail: '' },
      portraitUrl: null,
      scoutSignal: 'available' as const,
      scoutingReports: 0,
    }))
    // Compute championship summary so pulse can branch on position/gap.
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
    const ctx: PulseContext = {
      championshipPositionByDriverId: positionById,
      championshipGapByDriverId: gapById,
      totalDriversInChampionship: drivers.length,
      currentRound: data.gameState?.currentRound ?? 1,
      currentSeason: data.gameState?.season ?? 1,
    }
    return {
      ...data,
      drivers: drivers.map(d => ({
        ...d,
        pulse: derivePulse(d, ctx),
        scoutSignal: computeScoutSignal(d),
      })),
    }
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/core/migration-v12-v13.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 6: Run the full migration regression test**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: existing tests pass; the migration chain v1→v2→…→v13 succeeds.

- [ ] **Step 7: Do not commit yet**

---

### Task 11: Pre-seed real-world values in `src/data/drivers.ts`

**Files:**
- Modify: `src/data/drivers.ts` (every entry in the DRIVERS array)

- [ ] **Step 1: For each driver in `DRIVERS`, add the new fields**

Use the audit table from Task A. For Verstappen (line 36-44) the additions are:

```ts
  {
    id: 'verstappen', firstName: 'Max', lastName: 'Verstappen', shortName: 'VER',
    nationality: 'Dutch', age: 28, teamId: 'red-bull',
    attributes: { pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 20 },
    mood: { motivation: 85, frustration: 15, confidence: 95 },
    contract: { salary: 55_000_000, termEndSeason: 3, performanceBonuses: [{ condition: 'WDC', value: 10_000_000 }], releaseClause: 200_000_000 },
    seasonStats: emptyStats(), rivalries: [], peakAge: 28, declineRate: 0.5, isReserve: false, isF2: false,
    penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
    careerWins: 64, careerPodiums: 116, careerStarts: 218, worldTitles: 4,
    pulse: { headline: '', detail: '' }, portraitUrl: null,
    scoutSignal: 'available', scoutingReports: 0,
  },
```

Repeat for all 28 entries using the values from Task A's audit table.

For the empty-pulse placeholder: every driver gets `pulse: { headline: '', detail: '' }` and `scoutSignal: 'available'` and `scoutingReports: 0`. `state-manager.initializeGame` and `processPostRace` overwrite these on first observation.

- [ ] **Step 2: Add an audit-source comment block at the top of the DRIVERS array**

Above `export const DRIVERS: DriverData[] = [` add:

```ts
/**
 * Career stats and world titles seeded from public records as of end-of-2025
 * season (statsf1.com / wikipedia). Values within ±5 on careerStarts for
 * drivers below 50 starts are rounded to nearest 5. NPC drivers (no
 * real-world counterpart) seed to 0/0/0/0.
 *
 * `pulse`, `scoutSignal`, `scoutingReports` are placeholder values that the
 * orchestrator overwrites on first observation (see state-manager.ts and
 * post-race-processor.ts).
 *
 * See `docs/superpowers/specs/2026-05-06-drivers-page-redesign-design.md`
 * §3.6 for the full audit table.
 */
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS — every Driver literal now satisfies the extended type.

- [ ] **Step 4: Run all engine drivers tests**

Run: `npx vitest run tests/engine/drivers tests/engine/core tests/data tests/stores`
Expected: PASS green.

- [ ] **Step 5: Run dependency analyzer to verify no engine boundary violations**

Run: `python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine`
Expected: clean — no engine file imports from stores/hooks/components/browser APIs.

- [ ] **Step 6: Commit IP-09a engine work**

```bash
git add src/types/driver.ts \
        src/engine/drivers/career-stats.ts \
        src/engine/drivers/pulse.ts \
        src/engine/drivers/scout-signal.ts \
        src/engine/drivers/apply-scouting-report.ts \
        src/engine/core/post-race-processor.ts \
        src/engine/core/season-end-processor.ts \
        src/engine/core/state-manager.ts \
        src/engine/core/save-system.ts \
        src/stores/game-store.ts \
        src/data/drivers.ts \
        tests/engine/drivers/ \
        tests/engine/core/migration-v12-v13.test.ts \
        tests/stores/file-scouting-report.test.ts

git commit -m "$(cat <<'EOF'
feat(drivers): IP-09a engine + schema for drivers redesign

- Driver type: career stats, worldTitles, pulse, portraitUrl, scoutSignal,
  scoutingReports
- Pure helpers: career-stats, pulse (13-branch template), scout-signal,
  apply-scouting-report
- Wiring: post-race-processor (career deltas + pulse/signal recompute),
  season-end-processor (title award + recompute), state-manager
  (init pass)
- Store: fileScoutingReport thin-dispatch action
- Schema v12 → v13 migration with deterministic helper invocation
- Real-world EOS-2025 seed values for 22 drivers + reserves

Plan: docs/superpowers/plans/2026-05-06-drivers-redesign-ip-09a-engine.md
Spec: docs/superpowers/specs/2026-05-06-drivers-page-redesign-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Update persistence-contract.md docs

**Files:**
- Modify: `docs/architecture/persistence-contract.md`

- [ ] **Step 1: Read the current persistence contract**

Run: `Read docs/architecture/persistence-contract.md`

- [ ] **Step 2: In §1 (Persisted fields), add the new Driver fields under the Driver entry**

Add bullets:

```markdown
- `careerWins: number` — running total across seasons. Pre-seeded for the 2026 grid; existing saves default to 0 via v12→v13 migration.
- `careerPodiums: number`
- `careerStarts: number`
- `worldTitles: number` — Drivers' Championships won. Incremented at season end.
- `pulse: { headline: string; detail: string }` — narrative status, regenerated each round and at game init by `derivePulse`.
- `portraitUrl: string | null` — optional driver portrait URL; null = stripe placeholder.
- `scoutSignal: 'hot' | 'tracking' | 'available'` — derived signal; meaningful for free agents/F2.
- `scoutingReports: number` — count of player-filed reports.
```

- [ ] **Step 3: Update the schema-version section to reference v13**

Find the schema-version table or paragraph and add the v13 row pointing to the IP-09a spec.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/persistence-contract.md
git commit -m "$(cat <<'EOF'
docs(persistence): document v13 driver fields (IP-09a)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: IP-09a verification gate

- [ ] **Step 1: Run the full type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Run all engine + store + data tests**

Run: `npx vitest run tests/engine tests/stores tests/data`
Expected: green.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Engine purity check**

Run: `python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine`
Expected: no illegal imports.

- [ ] **Step 5: Use `superpowers:verification-before-completion` skill**

Confirm before handing off to IP-09b:
- TypeScript clean
- Engine tests pass
- Engine purity intact (no Math.random, no browser APIs, no store/hook/component imports)
- Schema migration v12→v13 lands with deterministic helper invocation
- `docs/architecture/persistence-contract.md` updated
- All commits on branch (or main, depending on workflow)

---

## What's next

IP-09a is complete. Proceed to:
[`docs/superpowers/plans/2026-05-06-drivers-redesign-ip-09b-ui.md`](2026-05-06-drivers-redesign-ip-09b-ui.md) — UI rebuild against `new-designs/drivers/`.
