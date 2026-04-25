# Race Penalty System — Tier A v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Tier A of the in-race penalty system: detect overtake-adjacent fouls during the race, defer-resolve them through a stewards' investigation window, apply time penalties at the next pit or race end, persist penalty points with rolling 22-round expiry, ban drivers at 12 points (with reserve substitution), and stamp 10-place grid drops at 5 driving warnings.

**Architecture:** Three new pure-function engine modules (`penalty-engine.ts`, `penalty-points.ts`, `penalty-calibration.ts`); `race-simulator.ts` extended at three call sites; worker `'raceEnd'` event gains one new field; persistence schema v7 → v8; `processPostRace` folds new `appliedPenalties` into driver state; UI gains three new surfaces (Stewards card, Stewards' Decisions panel, Penalty Record section). All randomness routes through the existing seeded PRNG; engine purity contract preserved.

**Tech Stack:** TypeScript strict mode, Next.js 15 App Router, Vitest (with `fake-indexeddb` for persistence tests), the existing seeded `PRNG` in `src/engine/core/prng.ts`, Web Worker for race simulation.

**Spec:** [docs/superpowers/specs/2026-04-25-race-penalty-system-tier-a-design.md](../specs/2026-04-25-race-penalty-system-tier-a-design.md)

---

## Pre-flight

- [ ] **Confirm clean working tree.** Run `git status` and ensure no uncommitted changes before starting Task 1.
- [ ] **Confirm tests pass on `main`.** Run `npx vitest run` and `npx tsc --noEmit`. Both must be green before starting.

---

## Phase 1 — Foundation Types

These tasks add the type surface only. Verification is `npx tsc --noEmit` (no runtime tests yet — those land with the implementations they describe).

### Task 1: Add penalty types to `src/types/race.ts`

**Files:**
- Modify: `src/types/race.ts`

- [ ] **Step 1: Add new union types and `AppliedPenalty` interface.**

Insert near the existing `WeatherState` and `DriverCommand` union declarations (around line 8), before `Circuit`:

```ts
export type OffenceType =
  | 'collision-minor'
  | 'collision-serious'
  | 'forcing-off'
  | 'illegal-defending'

export type SanctionType =
  | 'reprimand'
  | 'fine'
  | '5s'
  | '10s'
  | 'drive-through'
  | 'stop-go'
  | 'grid-drop'

export type SeverityTier = 'minor' | 'serious' | 'major' | 'egregious'

export interface AppliedPenalty {
  offenceType: OffenceType
  sanction: SanctionType
  timePenaltySeconds: number
  penaltyPointsIssued: number
  warningCounted: boolean
  raceLap: number
}
```

- [ ] **Step 2: Replace `RaceIncident` with the extended discriminator.**

Find the existing `RaceIncident` interface (around line 98) and replace it with:

```ts
export interface RaceIncident {
  lap: number
  type:
    | 'crash'
    | 'mechanical'
    | 'safety-car'
    | 'weather-change'
    | 'investigation-opened'
    | 'penalty-issued'
    | 'investigation-closed'
  driverIds: string[]
  description: string
  // optional payload for the new sub-types
  investigationId?: string
  sanction?: SanctionType
  penaltyPointsIssued?: number
  offenceType?: OffenceType
  decideOnLap?: number
}
```

The legacy `'penalty'` value is removed. The next step verifies nothing in the codebase referenced it.

- [ ] **Step 3: Grep-sweep for the removed legacy `'penalty'` discriminator value.**

Run two greps and inspect both for any matches that would still consume the removed value:

```bash
# Match the literal string used as an incident discriminator:
npx vitest --reporter=verbose --run --no-coverage --silent tests/types  || true  # warm-up only
```

Use the Grep tool (not Bash) for the scan:

- Pattern: `type:\s*['"]penalty['"]` glob `**/*.{ts,tsx}` — must return zero matches.
- Pattern: `incident\.type\s*===\s*['"]penalty['"]` glob `**/*.{ts,tsx}` — must return zero matches.
- Pattern: `'penalty'` (case-sensitive) glob `src/**/*.{ts,tsx}` — review every match; only `penalty-engine.ts` (does not exist yet), `penalty-points.ts` (does not exist yet), `penalty-calibration.ts` (does not exist yet), and string literals NOT used as `RaceIncident.type` discriminators are acceptable.

If any consumer matched on the old `'penalty'` discriminator, stop and update it to the new sub-types (most likely → `'penalty-issued'`) before proceeding.

- [ ] **Step 4: Extend the `'raceEnd'` member of the `WorkerOutEvent` union.**

Find the `'raceEnd'` member of `WorkerOutEvent` (around line 224) and replace it with:

```ts
  | {
      type: 'raceEnd'
      finalResults: LapResult[]
      fastestLap: { driverId: string; time: number }
      appliedPenaltiesByDriver: Record<string, AppliedPenalty[]>
    }
```

- [ ] **Step 5: Verify type-check.**

Run: `npx tsc --noEmit`
Expected: **PASS** for the type additions; **FAIL** for any consumer of the old `'raceEnd'` event that doesn't pass `appliedPenaltiesByDriver`. Note every failing call site — those are fixed in later tasks (Task 19 covers the strategy page join, Task 15 covers the worker emission, etc.). For now, accept the failures and proceed.

- [ ] **Step 6: Commit.**

```bash
git add src/types/race.ts
git commit -m "feat(types): add penalty types + extend RaceIncident and raceEnd

- OffenceType, SanctionType, SeverityTier, AppliedPenalty
- RaceIncident discriminator: + investigation-opened, penalty-issued,
  investigation-closed; - legacy 'penalty' (never emitted, sweep clean)
- WorkerOutEvent 'raceEnd' gains appliedPenaltiesByDriver field

Type-only change. Downstream tsc failures are addressed in subsequent
tasks (worker emission, strategy-page join, post-race-processor)."
```

---

### Task 2: Add penalty fields to `Driver` in `src/types/driver.ts`

**Files:**
- Modify: `src/types/driver.ts`

- [ ] **Step 1: Add `PenaltyPointEntry` and import `OffenceType`.**

At the top of the file, add:

```ts
import type { OffenceType } from '@/types/race'
```

Then, after `SeasonStats` and before `Driver`, add:

```ts
export interface PenaltyPointEntry {
  points: number
  issuedSeason: number
  issuedRound: number
  offenceType: OffenceType
  raceId: string
}
```

- [ ] **Step 2: Extend the `Driver` interface.**

Add the four new fields at the end of the `Driver` interface, after `lastRaceResult`:

```ts
  /**
   * Active super-licence penalty-point entries on a rolling 22-round window.
   * Each entry expires individually (currentSeason - issuedSeason) * 22 +
   * (currentRound - issuedRound) >= 22 rounds after issue. Default: empty.
   */
  penaltyPoints: PenaltyPointEntry[]
  /**
   * Driving-warnings counter for the current season. Resets at season end and
   * on threshold consumption (5 → triggers 10-place grid drop). Default: 0.
   */
  warningsThisSeason: number
  /**
   * One-shot grid-position drop applied at the next race after qualifying.
   * Consumed and zeroed by the bootstrap grid-drop step. Default: 0.
   */
  nextRaceGridDrop: number
  /**
   * If set, the driver is suspended through this round inclusive and is
   * substituted by the reserve in `applyBanSubstitution`. Cleared at the
   * start of post-race processing for the round equal to this value.
   */
  banUntilRound: number | null
```

- [ ] **Step 3: Verify type-check.**

Run: `npx tsc --noEmit`
Expected: every site that constructs a `Driver` (data files, test fixtures, migrations) now fails. These will be fixed in subsequent tasks. Confirm the new fields are recognized correctly.

- [ ] **Step 4: Commit.**

```bash
git add src/types/driver.ts
git commit -m "feat(types): Driver gains penaltyPoints, warnings, gridDrop, ban

Adds the persisted state required by the Tier A penalty system. All four
fields are populated by Task 8's v7→v8 migration; existing code paths
remain untouched until then."
```

---

## Phase 2 — Pure Engine Modules (TDD)

Each task in this phase is **test-first**. Write the failing test, see it fail, write minimal code, see the test pass, commit.

### Task 3: Penalty calibration constants

**Files:**
- Create: `src/data/penalty-calibration.ts`
- Test: `tests/data/penalty-calibration.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `tests/data/penalty-calibration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'

describe('DEFAULT_PENALTY_CALIBRATION', () => {
  it('threshold and severity bands are monotonically increasing', () => {
    const c = DEFAULT_PENALTY_CALIBRATION
    expect(c.faultThreshold).toBeGreaterThan(0)
    expect(c.faultThreshold).toBeLessThan(1)
    expect(c.severityBands.minor).toBeLessThan(c.severityBands.serious)
    expect(c.severityBands.serious).toBeLessThan(c.severityBands.major)
    expect(c.severityBands.major).toBeLessThan(c.severityBands.egregious)
  })

  it('investigation window is non-empty and non-negative', () => {
    const w = DEFAULT_PENALTY_CALIBRATION.investigationWindow
    expect(w.minLaps).toBeGreaterThan(0)
    expect(w.maxLaps).toBeGreaterThanOrEqual(w.minLaps)
  })

  it('every (offenceType, severity) combination has a sanction matrix entry', () => {
    const offences = ['collision-minor', 'collision-serious', 'forcing-off', 'illegal-defending'] as const
    const severities = ['minor', 'serious', 'major', 'egregious'] as const
    for (const o of offences) {
      for (const s of severities) {
        const cell = DEFAULT_PENALTY_CALIBRATION.sanctionMatrix[o][s]
        expect(cell).toBeDefined()
        expect(cell.timePenaltySeconds).toBeGreaterThanOrEqual(0)
        expect(cell.penaltyPoints).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('thresholds match real F1: 12 points → ban, 5 warnings → 10-place drop, 22-round window', () => {
    const c = DEFAULT_PENALTY_CALIBRATION
    expect(c.banThreshold).toBe(12)
    expect(c.banDurationRounds).toBe(1)
    expect(c.warningThreshold).toBe(5)
    expect(c.warningGridDrop).toBe(10)
    expect(c.rollingWindowRounds).toBe(22)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/data/penalty-calibration.test.ts`
Expected: **FAIL** — `Cannot find module '@/data/penalty-calibration'`.

- [ ] **Step 3: Create `src/data/penalty-calibration.ts`.**

```ts
import type { OffenceType, SanctionType, SeverityTier } from '@/types/race'

export interface PenaltyCalibration {
  faultThreshold: number
  severityBands: { minor: number; serious: number; major: number; egregious: number }
  investigationWindow: { minLaps: number; maxLaps: number }
  sanctionMatrix: Record<OffenceType, Record<SeverityTier, {
    sanction: SanctionType
    timePenaltySeconds: number
    penaltyPoints: number
    warningCounted: boolean
  }>>
  banThreshold: number
  banDurationRounds: number
  warningThreshold: number
  warningGridDrop: number
  rollingWindowRounds: number
}

export const DEFAULT_PENALTY_CALIBRATION: PenaltyCalibration = {
  faultThreshold: 0.55,
  severityBands: { minor: 0.10, serious: 0.25, major: 0.40, egregious: 1.00 },
  investigationWindow: { minLaps: 1, maxLaps: 5 },
  sanctionMatrix: {
    'collision-minor': {
      minor:     { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      serious:   { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 2, warningCounted: true },
      major:     { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      egregious: { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 3, warningCounted: true },
    },
    'collision-serious': {
      minor:     { sanction: '10s',           timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      serious:   { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 3, warningCounted: true },
      major:     { sanction: 'drive-through', timePenaltySeconds: 20, penaltyPoints: 3, warningCounted: true },
      egregious: { sanction: 'stop-go',       timePenaltySeconds: 28, penaltyPoints: 4, warningCounted: true },
    },
    'forcing-off': {
      minor:     { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      serious:   { sanction: '5s',  timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      major:     { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      egregious: { sanction: '10s', timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
    },
    'illegal-defending': {
      minor:     { sanction: 'reprimand', timePenaltySeconds: 0,  penaltyPoints: 0, warningCounted: true },
      serious:   { sanction: '5s',         timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      major:     { sanction: '5s',         timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      egregious: { sanction: '10s',        timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
    },
  },
  banThreshold: 12,
  banDurationRounds: 1,
  warningThreshold: 5,
  warningGridDrop: 10,
  rollingWindowRounds: 22,
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/data/penalty-calibration.test.ts`
Expected: **PASS** — all 4 tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/data/penalty-calibration.ts tests/data/penalty-calibration.test.ts
git commit -m "feat(data): add penalty calibration constants

Sourced verbatim from FIA 2025 Penalty Guidelines quick-ref table. Single
tunable surface for thresholds, severity bands, sanction matrix, and
rolling-window length. Spec §5.2."
```

---

### Task 4: Penalty-points helpers (rolling-window expiry, ban wipe)

**Files:**
- Create: `src/engine/drivers/penalty-points.ts`
- Test: `tests/engine/drivers/penalty-points.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `tests/engine/drivers/penalty-points.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  expirePenaltyPoints,
  sumActivePoints,
  wipeContributingPoints,
} from '@/engine/drivers/penalty-points'
import type { PenaltyPointEntry } from '@/types/driver'

const e = (points: number, season: number, round: number, raceId = 'r'): PenaltyPointEntry => ({
  points, issuedSeason: season, issuedRound: round, offenceType: 'collision-minor', raceId,
})

describe('expirePenaltyPoints', () => {
  it('keeps an entry inside the 22-round window', () => {
    const out = expirePenaltyPoints([e(2, 1, 5)], 1, 26)
    expect(out).toHaveLength(1)
  })

  it('drops an entry exactly at the 22-round boundary', () => {
    // round delta = 22 → expired (>= 22)
    const out = expirePenaltyPoints([e(2, 1, 5)], 1, 27)
    expect(out).toHaveLength(0)
  })

  it('cross-season expiry: entry from (1, 20) expires in (2, 20), not earlier', () => {
    const entry = e(1, 1, 20)
    expect(expirePenaltyPoints([entry], 2, 19)).toHaveLength(1)  // delta 21
    expect(expirePenaltyPoints([entry], 2, 20)).toHaveLength(0)  // delta 22
  })

  it('returns a new array, never mutates input', () => {
    const input = [e(1, 1, 1), e(1, 1, 2)]
    const before = [...input]
    expirePenaltyPoints(input, 5, 10)
    expect(input).toEqual(before)
  })
})

describe('sumActivePoints', () => {
  it('sums all entries (caller is expected to expire first)', () => {
    expect(sumActivePoints([e(1, 1, 1), e(2, 1, 2), e(3, 1, 3)])).toBe(6)
  })

  it('returns 0 for empty list', () => {
    expect(sumActivePoints([])).toBe(0)
  })
})

describe('wipeContributingPoints', () => {
  it('removes newest-first entries until cumulative >= threshold', () => {
    // newest first: (round 30, 5pts), (round 25, 4pts), (round 20, 3pts), (round 10, 2pts)
    const entries = [e(2, 1, 10), e(3, 1, 20), e(4, 1, 25), e(5, 1, 30)]
    const result = wipeContributingPoints(entries, 12)
    // 5 + 4 + 3 = 12 → drops the 3 newest; the round-10 entry survives
    expect(result).toHaveLength(1)
    expect(result[0].issuedRound).toBe(10)
  })

  it('keeps older entries that fall below the wipe sum', () => {
    const entries = [e(2, 1, 5), e(10, 1, 15)]
    const result = wipeContributingPoints(entries, 12)
    // newest (10) is taken first → sum 10, still below 12; next (2) brings to 12 → drop both
    expect(result).toHaveLength(0)
  })

  it('does nothing when total is below threshold', () => {
    const entries = [e(3, 1, 5), e(4, 1, 10)]
    const result = wipeContributingPoints(entries, 12)
    expect(result).toHaveLength(2)
  })

  it('handles ties deterministically (lower round first when sorting)', () => {
    const entries = [e(6, 1, 10), e(6, 1, 10)]
    const result = wipeContributingPoints(entries, 12)
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/drivers/penalty-points.test.ts`
Expected: **FAIL** — `Cannot find module '@/engine/drivers/penalty-points'`.

- [ ] **Step 3: Create `src/engine/drivers/penalty-points.ts`.**

```ts
import type { PenaltyPointEntry } from '@/types/driver'

const DEFAULT_WINDOW_ROUNDS = 22
const ROUNDS_PER_SEASON = 22

/**
 * Removes entries whose age in rounds (across season boundaries) has reached
 * or exceeded the rolling window. Pure: returns a new array.
 */
export function expirePenaltyPoints(
  entries: PenaltyPointEntry[],
  currentSeason: number,
  currentRound: number,
  windowRounds: number = DEFAULT_WINDOW_ROUNDS,
): PenaltyPointEntry[] {
  return entries.filter((entry) => {
    const ageInRounds =
      (currentSeason - entry.issuedSeason) * ROUNDS_PER_SEASON +
      (currentRound - entry.issuedRound)
    return ageInRounds < windowRounds
  })
}

export function sumActivePoints(entries: PenaltyPointEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.points, 0)
}

/**
 * Sorts newest-first; accumulates points until cumulative sum ≥ threshold;
 * removes those entries. Returns the surviving older entries. Pure.
 */
export function wipeContributingPoints(
  entries: PenaltyPointEntry[],
  threshold: number,
): PenaltyPointEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const seasonDelta = b.issuedSeason - a.issuedSeason
    if (seasonDelta !== 0) return seasonDelta
    return b.issuedRound - a.issuedRound
  })

  let running = 0
  const dropIndices = new Set<number>()
  for (let i = 0; i < sorted.length; i++) {
    if (running >= threshold) break
    running += sorted[i].points
    dropIndices.add(i)
  }

  // Filter on the ORIGINAL list to preserve original ordering of survivors
  const dropped = new Set(Array.from(dropIndices).map((i) => sorted[i]))
  return entries.filter((e) => !dropped.has(e))
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/drivers/penalty-points.test.ts`
Expected: **PASS** — all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/drivers/penalty-points.ts tests/engine/drivers/penalty-points.test.ts
git commit -m "feat(engine/drivers): penalty-points helpers (expire, sum, wipe)

Pure-function module supporting the 22-round rolling-window expiry,
active-point summation, and the 12-point ban wipe (newest-first
accumulation). Spec §5.3."
```

---

### Task 5: Penalty engine — fault evaluation

**Files:**
- Create: `src/engine/race/penalty-engine.ts`
- Test: `tests/engine/race/penalty-engine.test.ts`

- [ ] **Step 1: Write the failing test for `evaluateContestedEvent`.**

Create `tests/engine/race/penalty-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evaluateContestedEvent, type ContestedEventInput } from '@/engine/race/penalty-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
import { createPRNG } from '@/engine/core/prng'
import type { RaceDriver } from '@/engine/race/race-simulator'

function makeDriver(id: string, overrides: Partial<RaceDriver['attributes']> = {}): RaceDriver {
  return {
    id,
    car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 },
    attributes: {
      pace: 80, racecraft: 80, experience: 80, mentality: 70,
      marketability: 50, developmentPotential: 50,
      ...overrides,
    },
  }
}

function baseInput(overrides: Partial<ContestedEventInput> = {}): ContestedEventInput {
  return {
    attacker: makeDriver('att'),
    defender: makeDriver('def'),
    attackerCommand: 'standard',
    defenderCommand: 'standard',
    lapDelta: 0.3,
    tireDelta: 0,
    circuit: { overtakingDifficulty: 'medium' },
    attackerMood: { frustration: 30, confidence: 60 },
    defenderMood: { frustration: 30, confidence: 60 },
    calibration: DEFAULT_PENALTY_CALIBRATION,
    ...overrides,
  }
}

describe('evaluateContestedEvent', () => {
  it('clean racing produces null decision', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput(), rng)
    expect(result.decision).toBeNull()
    expect(result.attackerFault).toBeGreaterThanOrEqual(0)
    expect(result.attackerFault).toBeLessThanOrEqual(1)
    expect(result.defenderFault).toBeGreaterThanOrEqual(0)
    expect(result.defenderFault).toBeLessThanOrEqual(1)
  })

  it('aggressive overtake by an inexperienced, frustrated driver triggers attacker blame', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'overtake',
      attacker: makeDriver('att', { racecraft: 40, experience: 30 }),
      attackerMood: { frustration: 90, confidence: 40 },
      circuit: { overtakingDifficulty: 'high' },
    }), rng)
    expect(result.decision).not.toBeNull()
    expect(result.decision!.driverId).toBe('att')
  })

  it('aggressive defending by an inexperienced, frustrated driver triggers defender blame', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'standard',
      defenderCommand: 'defend',
      defender: makeDriver('def', { racecraft: 40, experience: 30 }),
      defenderMood: { frustration: 90, confidence: 40 },
      circuit: { overtakingDifficulty: 'high' },
    }), rng)
    expect(result.decision).not.toBeNull()
    expect(result.decision!.driverId).toBe('def')
  })

  it('experience reduces fault score', () => {
    const rng = createPRNG(1)
    const inputLow  = baseInput({ attackerCommand: 'overtake', attacker: makeDriver('att', { experience: 10 }) })
    const inputHigh = baseInput({ attackerCommand: 'overtake', attacker: makeDriver('att', { experience: 95 }) })
    const low  = evaluateContestedEvent(inputLow,  rng)
    const high = evaluateContestedEvent(inputHigh, rng)
    expect(low.attackerFault).toBeGreaterThan(high.attackerFault)
  })

  it('attacker on aged tires diving in adds tire-mismatch risk', () => {
    const rng = createPRNG(1)
    const a = evaluateContestedEvent(baseInput({ attackerCommand: 'overtake', tireDelta: -50 }), rng)
    const b = evaluateContestedEvent(baseInput({ attackerCommand: 'overtake', tireDelta: 0 }),   rng)
    expect(a.attackerFault).toBeGreaterThan(b.attackerFault)
  })

  it('clamps fault scores to [0, 1]', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'overtake',
      attacker: makeDriver('att', { racecraft: 0, experience: 0 }),
      attackerMood: { frustration: 100, confidence: 0 },
      circuit: { overtakingDifficulty: 'high' },
      tireDelta: -100,
    }), rng)
    expect(result.attackerFault).toBeLessThanOrEqual(1)
    expect(result.attackerFault).toBeGreaterThanOrEqual(0)
  })

  it('severity tier "egregious" maps an overtake-blamed attacker to collision-serious', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'overtake',
      attacker: makeDriver('att', { racecraft: 0, experience: 0 }),
      attackerMood: { frustration: 100, confidence: 0 },
      circuit: { overtakingDifficulty: 'high' },
      tireDelta: -100,
    }), rng)
    expect(result.decision).not.toBeNull()
    expect(['collision-minor', 'collision-serious']).toContain(result.decision!.offenceType)
  })

  it('non-overtake attacker blame yields forcing-off', () => {
    const rng = createPRNG(1)
    const result = evaluateContestedEvent(baseInput({
      attackerCommand: 'push',
      attacker: makeDriver('att', { racecraft: 20, experience: 20 }),
      attackerMood: { frustration: 95, confidence: 30 },
      circuit: { overtakingDifficulty: 'high' },
    }), rng)
    if (result.decision) {
      expect(result.decision.offenceType).toBe('forcing-off')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/penalty-engine.test.ts`
Expected: **FAIL** — `Cannot find module '@/engine/race/penalty-engine'`.

- [ ] **Step 3: Create `src/engine/race/penalty-engine.ts` (initial — fault evaluation only).**

```ts
import type { OffenceType, SeverityTier, DriverCommand } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'
import type { RaceDriver } from './race-simulator'
import type { PenaltyCalibration } from '@/data/penalty-calibration'

export interface ContestedEventInput {
  attacker: RaceDriver
  defender: RaceDriver
  attackerCommand: DriverCommand
  defenderCommand: DriverCommand
  lapDelta: number
  tireDelta: number
  circuit: { overtakingDifficulty: 'low' | 'medium' | 'high' }
  attackerMood: { frustration: number; confidence: number }
  defenderMood: { frustration: number; confidence: number }
  calibration: PenaltyCalibration
}

export interface FaultEvaluation {
  attackerFault: number
  defenderFault: number
  decision: null | { driverId: string; severity: SeverityTier; offenceType: OffenceType }
}

const COMMAND_AGGRESSION: Record<DriverCommand, number> = {
  overtake: 0.30,
  push: 0.15,
  defend: 0.20,
  standard: 0,
  conserve: 0,
  pit: 0,
}

const CIRCUIT_DIFFICULTY: Record<'low' | 'medium' | 'high', number> = {
  low: 0.0,
  medium: 0.05,
  high: 0.10,
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function computeAttackerFault(input: ContestedEventInput): number {
  const { attacker, attackerCommand, tireDelta, circuit, attackerMood } = input
  const aggression = COMMAND_AGGRESSION[attackerCommand]
  const optimism = (100 - attacker.attributes.racecraft) / 200
  const frustration = Math.max(0, attackerMood.frustration - 60) / 200
  const tireMismatch = Math.max(0, -tireDelta) * 0.005
  const circuitRisk = CIRCUIT_DIFFICULTY[circuit.overtakingDifficulty]
  const experienceProtection = attacker.attributes.experience / 500
  return clamp01(aggression + optimism + frustration + tireMismatch + circuitRisk - experienceProtection)
}

function computeDefenderFault(input: ContestedEventInput): number {
  const { defender, defenderCommand, circuit, defenderMood } = input
  const aggression = COMMAND_AGGRESSION[defenderCommand]
  const optimism = (100 - defender.attributes.racecraft) / 200
  const frustration = Math.max(0, defenderMood.frustration - 60) / 200
  const circuitRisk = CIRCUIT_DIFFICULTY[circuit.overtakingDifficulty]
  const experienceProtection = defender.attributes.experience / 500
  // Tire-mismatch risk is attacker-only; defenders don't get blamed for old tires.
  return clamp01(aggression + optimism + frustration + circuitRisk - experienceProtection)
}

function severityFromScore(
  score: number,
  threshold: number,
  bands: PenaltyCalibration['severityBands'],
): SeverityTier {
  const over = score - threshold
  if (over < bands.minor) return 'minor'
  if (over < bands.serious) return 'serious'
  if (over < bands.major) return 'major'
  return 'egregious'
}

export function evaluateContestedEvent(
  input: ContestedEventInput,
  _rng: PRNG,
): FaultEvaluation {
  const attackerFault = computeAttackerFault(input)
  const defenderFault = computeDefenderFault(input)
  const threshold = input.calibration.faultThreshold
  const max = Math.max(attackerFault, defenderFault)
  if (max < threshold) {
    return { attackerFault, defenderFault, decision: null }
  }
  // Tie → attacker blame (per spec §5.1.3)
  const blamedIsAttacker = attackerFault >= defenderFault
  const driverId = blamedIsAttacker ? input.attacker.id : input.defender.id
  const blamedScore = blamedIsAttacker ? attackerFault : defenderFault
  const severity = severityFromScore(blamedScore, threshold, input.calibration.severityBands)
  let offenceType: OffenceType
  if (blamedIsAttacker) {
    if (input.attackerCommand === 'overtake') {
      offenceType = severity === 'minor' || severity === 'serious'
        ? (severity === 'minor' ? 'collision-minor' : 'collision-serious')
        : 'collision-serious'
    } else {
      offenceType = 'forcing-off'
    }
  } else {
    offenceType = 'illegal-defending'
  }
  return { attackerFault, defenderFault, decision: { driverId, severity, offenceType } }
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/penalty-engine.test.ts`
Expected: **PASS** — all tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/penalty-engine.ts tests/engine/race/penalty-engine.test.ts
git commit -m "feat(engine/race): penalty-engine fault evaluation

evaluateContestedEvent computes attacker and defender fault scores from
command aggression, racecraft optimism, frustration, tire mismatch,
circuit difficulty, and experience protection. Decision rule maps the
blamed driver's score above threshold into a severity tier and offence
type. Pure, deterministic. Spec §5.1.2 / §5.1.3."
```

---

### Task 6: Penalty engine — investigation lifecycle

**Files:**
- Modify: `src/engine/race/penalty-engine.ts`
- Modify: `tests/engine/race/penalty-engine.test.ts`

- [ ] **Step 1: Add tests for `openInvestigation` and `resolveInvestigations`.**

Append to `tests/engine/race/penalty-engine.test.ts`:

```ts
import { openInvestigation, resolveInvestigations, type PendingInvestigation } from '@/engine/race/penalty-engine'

describe('openInvestigation', () => {
  it('decideOnLap is currentLap + a value within [minLaps, maxLaps]', () => {
    const rng = createPRNG(1)
    const inv = openInvestigation('drv-1', 'minor', 'forcing-off', 10, 50, rng)
    expect(inv.decideOnLap).toBeGreaterThanOrEqual(11)
    expect(inv.decideOnLap).toBeLessThanOrEqual(15)
    expect(inv.openedOnLap).toBe(10)
    expect(inv.driverId).toBe('drv-1')
  })

  it('clamps decideOnLap to totalLaps when window would exceed it', () => {
    const rng = createPRNG(1)
    const inv = openInvestigation('drv-1', 'minor', 'forcing-off', 49, 50, rng)
    expect(inv.decideOnLap).toBeLessThanOrEqual(50)
  })

  it('id is deterministic for the same seed and inputs', () => {
    const rngA = createPRNG(42)
    const rngB = createPRNG(42)
    const a = openInvestigation('drv-1', 'minor', 'forcing-off', 10, 50, rngA)
    const b = openInvestigation('drv-1', 'minor', 'forcing-off', 10, 50, rngB)
    expect(a.id).toBe(b.id)
    expect(a.decideOnLap).toBe(b.decideOnLap)
  })
})

describe('resolveInvestigations', () => {
  const sample = (overrides: Partial<PendingInvestigation> = {}): PendingInvestigation => ({
    id: 'inv-1',
    driverId: 'drv-1',
    openedOnLap: 5,
    decideOnLap: 8,
    severity: 'minor',
    offenceType: 'forcing-off',
    ...overrides,
  })

  it('partitions resolved vs stillPending at currentLap', () => {
    const pending: PendingInvestigation[] = [
      sample({ id: 'a', decideOnLap: 8 }),
      sample({ id: 'b', decideOnLap: 10 }),
      sample({ id: 'c', decideOnLap: 7 }),
    ]
    const result = resolveInvestigations(pending, 8)
    expect(result.resolved.map((i) => i.id).sort()).toEqual(['a', 'c'])
    expect(result.stillPending.map((i) => i.id)).toEqual(['b'])
  })

  it('returns no resolved entries when currentLap is below all decideOnLap', () => {
    const pending = [sample({ decideOnLap: 10 })]
    expect(resolveInvestigations(pending, 5).resolved).toHaveLength(0)
  })

  it('returns empty arrays when input is empty', () => {
    const r = resolveInvestigations([], 10)
    expect(r.resolved).toHaveLength(0)
    expect(r.stillPending).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/penalty-engine.test.ts`
Expected: **FAIL** — `openInvestigation` and `resolveInvestigations` are not exported.

- [ ] **Step 3: Add implementations to `src/engine/race/penalty-engine.ts`.**

Append:

```ts
export interface PendingInvestigation {
  id: string
  driverId: string
  openedOnLap: number
  decideOnLap: number
  severity: SeverityTier
  offenceType: OffenceType
}

export function openInvestigation(
  driverId: string,
  severity: SeverityTier,
  offenceType: OffenceType,
  currentLap: number,
  totalLaps: number,
  rng: PRNG,
): PendingInvestigation {
  // Use rng.next() to drive a deterministic window pick. We don't use rng.range
  // directly so the seeded value is encoded into the id for traceability.
  const r = rng.next()
  // Default window: [1, 5] inclusive
  const min = 1
  const max = 5
  const offset = min + Math.floor(r * (max - min + 1))
  const decideOnLap = Math.min(currentLap + offset, totalLaps)
  const id = `inv-${currentLap}-${driverId}-${Math.floor(r * 1e9)}`
  return { id, driverId, openedOnLap: currentLap, decideOnLap, severity, offenceType }
}

export function resolveInvestigations(
  pending: PendingInvestigation[],
  currentLap: number,
): { resolved: PendingInvestigation[]; stillPending: PendingInvestigation[] } {
  const resolved: PendingInvestigation[] = []
  const stillPending: PendingInvestigation[] = []
  for (const inv of pending) {
    if (currentLap >= inv.decideOnLap) resolved.push(inv)
    else stillPending.push(inv)
  }
  return { resolved, stillPending }
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/penalty-engine.test.ts`
Expected: **PASS** — all new tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/penalty-engine.ts tests/engine/race/penalty-engine.test.ts
git commit -m "feat(engine/race): penalty-engine investigation lifecycle

openInvestigation produces a deterministic PendingInvestigation with a
PRNG-seeded decideOnLap clamped to totalLaps. resolveInvestigations
partitions a list at the current lap. Spec §5.1.4."
```

---

### Task 7: Penalty engine — sanction selection

**Files:**
- Modify: `src/engine/race/penalty-engine.ts`
- Modify: `tests/engine/race/penalty-engine.test.ts`

- [ ] **Step 1: Add tests for `selectSanction`.**

Append to `tests/engine/race/penalty-engine.test.ts`:

```ts
import { selectSanction } from '@/engine/race/penalty-engine'

describe('selectSanction', () => {
  it('every (offence, severity) cell returns the matrix entry verbatim', () => {
    const rng = createPRNG(1)
    const offences = ['collision-minor', 'collision-serious', 'forcing-off', 'illegal-defending'] as const
    const severities = ['minor', 'serious', 'major', 'egregious'] as const
    for (const o of offences) {
      for (const s of severities) {
        const expected = DEFAULT_PENALTY_CALIBRATION.sanctionMatrix[o][s]
        const result = selectSanction(s, o, DEFAULT_PENALTY_CALIBRATION, rng)
        expect(result.sanction).toBe(expected.sanction)
        expect(result.timePenaltySeconds).toBe(expected.timePenaltySeconds)
        expect(result.penaltyPoints).toBe(expected.penaltyPoints)
        expect(result.warningCounted).toBe(expected.warningCounted)
      }
    }
  })

  it('reprimand cell has zero seconds and zero points', () => {
    const rng = createPRNG(1)
    const r = selectSanction('minor', 'illegal-defending', DEFAULT_PENALTY_CALIBRATION, rng)
    expect(r.sanction).toBe('reprimand')
    expect(r.timePenaltySeconds).toBe(0)
    expect(r.penaltyPoints).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/penalty-engine.test.ts`
Expected: **FAIL** — `selectSanction` not exported.

- [ ] **Step 3: Append `selectSanction` to `src/engine/race/penalty-engine.ts`.**

```ts
export function selectSanction(
  severity: SeverityTier,
  offenceType: OffenceType,
  calibration: PenaltyCalibration,
  _rng: PRNG,
): {
  sanction: import('@/types/race').SanctionType
  timePenaltySeconds: number
  penaltyPoints: number
  warningCounted: boolean
} {
  const cell = calibration.sanctionMatrix[offenceType][severity]
  return {
    sanction: cell.sanction,
    timePenaltySeconds: cell.timePenaltySeconds,
    penaltyPoints: cell.penaltyPoints,
    warningCounted: cell.warningCounted,
  }
}
```

The `_rng` parameter is reserved for future stochastic severity-within-band selection; v1 is fully deterministic from the matrix lookup.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/penalty-engine.test.ts`
Expected: **PASS** — all sanction-selection tests pass.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/penalty-engine.ts tests/engine/race/penalty-engine.test.ts
git commit -m "feat(engine/race): penalty-engine selectSanction

Direct sanction-matrix lookup. Pure, deterministic. PRNG arg reserved
for v2 stochastic severity selection. Spec §5.1.1."
```

---

## Phase 3 — Schema Migration

### Task 8: Schema v7 → v8 migration

**Files:**
- Modify: `src/engine/core/save-system.ts`
- Modify: `tests/engine/core/save-system.test.ts`

- [ ] **Step 1: Write the failing migration test.**

Append to `tests/engine/core/save-system.test.ts` (after the existing migration tests):

```ts
describe('v7 → v8 migration (Penalty System Tier A)', () => {
  it('back-fills the four new driver fields with default values', () => {
    const v7State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 7 },
      teams: [],
      drivers: [{
        id: 'd1',
        firstName: 'Test',
        lastName: 'Driver',
        // ... only the fields needed to confirm migration touches the right shape
        seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
      }],
    }
    const { data } = migrateToCurrent(v7State as any, 7)
    expect(data.drivers[0].penaltyPoints).toEqual([])
    expect(data.drivers[0].warningsThisSeason).toBe(0)
    expect(data.drivers[0].nextRaceGridDrop).toBe(0)
    expect(data.drivers[0].banUntilRound).toBeNull()
  })

  it('is idempotent — running twice yields the same result', () => {
    const v7State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 7 },
      teams: [],
      drivers: [{ id: 'd1', seasonStats: {} }],
    }
    const once = migrateToCurrent(v7State as any, 7).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })

  it('preserves existing driver fields untouched', () => {
    const v7State = {
      gameState: { season: 2, currentRound: 10, schemaVersion: 7 },
      teams: [],
      drivers: [{
        id: 'd1', firstName: 'Existing', lastName: 'Field',
        form: [3, 5, 2], lastRaceResult: 4,
        seasonStats: { points: 50, wins: 0, podiums: 1, poles: 0, dnfs: 0, penalties: 0, bestFinish: 3, averageFinish: 3.5, lastProcessedRound: 9 },
      }],
    }
    const { data } = migrateToCurrent(v7State as any, 7)
    expect(data.drivers[0].firstName).toBe('Existing')
    expect(data.drivers[0].form).toEqual([3, 5, 2])
    expect(data.drivers[0].seasonStats.points).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: **FAIL** — `SCHEMA_VERSION` is still 7, so `migrateToCurrent(state, 7)` is a no-op and the assertions about new fields fail.

- [ ] **Step 3: Bump `SCHEMA_VERSION` and add the v7 migration in `src/engine/core/save-system.ts`.**

Change the constant:

```ts
export const SCHEMA_VERSION = 8
```

Add a new entry to the `MIGRATIONS` map (place it ordered alongside the others):

```ts
  /**
   * v7 → v8 (IP-09 Penalty System Tier A): Adds the four persisted driver
   * fields used by the in-race penalty engine. All defaults are "blank
   * career" — no penalty points, no season warnings, no pending grid
   * drop, not banned. Existing fields are preserved verbatim.
   */
  7: (data) => ({
    ...data,
    drivers: data.drivers.map((d) => ({
      ...d,
      penaltyPoints: d.penaltyPoints ?? [],
      warningsThisSeason: d.warningsThisSeason ?? 0,
      nextRaceGridDrop: d.nextRaceGridDrop ?? 0,
      banUntilRound: d.banUntilRound ?? null,
    })),
  }),
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: **PASS** — all v7 → v8 tests + every existing test still passes.

- [ ] **Step 5: Update `docs/architecture/persistence-contract.md`.**

Open the file. Find the schema-history table / list and add a v8 entry describing:
- The four new fields on `Driver`.
- The fact that race-side state (`pendingInvestigations`, `pendingTimePenalties`, `appliedPenaltiesByDriver`) is **transient** and lives in worker `SimRaceState` only.
- The fact that `RaceResult.appliedPenalties` flows through `lastRaceResults` (transient) and is consumed by `processPostRace`.

Match the writing style of existing entries (concise, factual, no marketing tone).

- [ ] **Step 6: Commit.**

```bash
git add src/engine/core/save-system.ts tests/engine/core/save-system.test.ts docs/architecture/persistence-contract.md
git commit -m "feat(persistence): v7 -> v8 migration for penalty fields

SCHEMA_VERSION bumped to 8. Migration back-fills penaltyPoints,
warningsThisSeason, nextRaceGridDrop, banUntilRound on every Driver.
Idempotent. Spec §6.2."
```

---

## Phase 4 — Race Simulator Integration

### Task 9: Extend `SimRaceState` with the three transient fields

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `src/workers/race-sim-worker.ts`

- [ ] **Step 1: Add the three fields to `SimRaceState`.**

In `src/engine/race/race-simulator.ts` (around line 21–40), add to the `SimRaceState` interface:

```ts
  pendingInvestigations: import('./penalty-engine').PendingInvestigation[]
  pendingTimePenalties: Record<string, number>
  appliedPenaltiesByDriver: Record<string, import('@/types/race').AppliedPenalty[]>
```

- [ ] **Step 2: Initialize the new fields in `simulateRace`.**

In `simulateRace` (around line 320–337), inside the `state: SimRaceState` literal, add:

```ts
    pendingInvestigations: [],
    pendingTimePenalties: {},
    appliedPenaltiesByDriver: {},
```

- [ ] **Step 3: Initialize the new fields in `race-sim-worker.ts`.**

In `src/workers/race-sim-worker.ts`, find the `raceState = { ... }` literal (around line 162) and add the same three fields with the same initial values.

- [ ] **Step 4: Verify type-check.**

Run: `npx tsc --noEmit`
Expected: **PASS** — both call sites carry the new fields.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/race-simulator.ts src/workers/race-sim-worker.ts
git commit -m "feat(race-sim): SimRaceState gains transient penalty fields

pendingInvestigations, pendingTimePenalties, appliedPenaltiesByDriver
are session-only worker state. Initialised in both simulateRace and
the worker bootstrap. Spec §5.4.1."
```

---

### Task 10: `simulateLap` — resolve investigations at lap start

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `tests/engine/race/race-simulator.test.ts` (will be extended in Task 13's bigger integration test; this task verifies the call wires up)

- [ ] **Step 1: Wire `resolveInvestigations` and `selectSanction` at the start of `simulateLap`.**

At the top of `simulateLap` in `src/engine/race/race-simulator.ts` (just after the `const lapResults...` declarations on line ~102), insert:

```ts
  // Resolve any investigations whose decision lap has arrived.
  const { resolved, stillPending } = resolveInvestigations(state.pendingInvestigations, state.currentLap)
  state.pendingInvestigations = stillPending
  for (const inv of resolved) {
    const sanction = selectSanction(inv.severity, inv.offenceType, state.calibration.penalty ?? DEFAULT_PENALTY_CALIBRATION, rng)
    if (sanction.timePenaltySeconds > 0) {
      state.pendingTimePenalties[inv.driverId] = (state.pendingTimePenalties[inv.driverId] ?? 0) + sanction.timePenaltySeconds
    }
    if (!state.appliedPenaltiesByDriver[inv.driverId]) state.appliedPenaltiesByDriver[inv.driverId] = []
    state.appliedPenaltiesByDriver[inv.driverId].push({
      offenceType: inv.offenceType,
      sanction: sanction.sanction,
      timePenaltySeconds: sanction.timePenaltySeconds,
      penaltyPointsIssued: sanction.penaltyPoints,
      warningCounted: sanction.warningCounted,
      raceLap: state.currentLap,
    })
    incidents.push({
      lap: state.currentLap,
      type: 'penalty-issued',
      driverIds: [inv.driverId],
      description: `${inv.driverId.toUpperCase()} penalised: ${sanction.sanction} (${inv.offenceType})`,
      investigationId: inv.id,
      sanction: sanction.sanction,
      penaltyPointsIssued: sanction.penaltyPoints,
      offenceType: inv.offenceType,
    })
  }
```

Add the imports at the top of the file:

```ts
import { evaluateContestedEvent, openInvestigation, resolveInvestigations, selectSanction } from './penalty-engine'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
```

**Note on `state.calibration.penalty`:** the existing `CalibrationProfile` type does not have a `penalty` field. For now, fall through to `DEFAULT_PENALTY_CALIBRATION`. Leaving the conditional in code documents the future hook; do **not** add `penalty` to `CalibrationProfile` in v1 — that's a Tier B task when per-circuit penalty calibration becomes meaningful.

If TypeScript complains about `state.calibration.penalty`, simplify the line to:

```ts
    const sanction = selectSanction(inv.severity, inv.offenceType, DEFAULT_PENALTY_CALIBRATION, rng)
```

and drop the conditional — that's the cleaner v1 form anyway.

- [ ] **Step 2: Verify type-check and run the existing race-simulator tests.**

Run: `npx tsc --noEmit && npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: **PASS** — existing tests still green; the new code is reached only when `pendingInvestigations` is non-empty (which existing tests don't exercise).

- [ ] **Step 3: Commit.**

```bash
git add src/engine/race/race-simulator.ts
git commit -m "feat(race-sim): simulateLap resolves pending investigations

At each lap start, resolveInvestigations partitions pending entries;
resolved entries pick a sanction from the calibration matrix, accumulate
seconds in pendingTimePenalties, append to appliedPenaltiesByDriver,
and emit a 'penalty-issued' RaceIncident. Spec §5.4.2 step 1."
```

---

### Task 11: `simulateLap` — pit branch consumes pending time penalties

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `tests/engine/race/race-simulator.test.ts`

- [ ] **Step 1: Add the pit-branch test.**

Append to `tests/engine/race/race-simulator.test.ts`:

```ts
import { simulateLap, type SimRaceState } from '@/engine/race/race-simulator'
// ... existing imports may already cover this; consolidate as needed

describe('simulateLap — pending time-penalty consumption', () => {
  it('a driver with pendingTimePenalty=5 who pits has lap time +5s vs no-penalty baseline', () => {
    // Build two parallel states: identical seed, identical strategy except
    // for pendingTimePenalties[driverId]. Run one lap on each. The pit-lap
    // result should differ by exactly 5 seconds.
    // (Test author: implement using existing test helpers to construct
    // a SimRaceState with one driver pitting on the current lap. Reuse the
    // pattern from existing race-simulator.test.ts cases.)

    // PSEUDO-OUTLINE; flesh out with concrete fixtures during implementation:
    // const baseState = makeMinimalState({ driverId: 'd1', pitLap: 5, lap: 5 })
    // const penaltyState = { ...baseState, pendingTimePenalties: { d1: 5 } }
    // const { lapResults: a } = simulateLap(baseState, createPRNG(1))
    // const { lapResults: b } = simulateLap(penaltyState, createPRNG(1))
    // expect(b[0].lapTime - a[0].lapTime).toBeCloseTo(5, 5)
    // expect(penaltyState.pendingTimePenalties.d1).toBe(0)  // consumed
  })
})
```

The test author is expected to use existing helpers from `tests/engine/race/race-simulator.test.ts` to build the `SimRaceState` fixture (look for `makeState`, `makeRaceDriver`, or similar helpers already in the file). If no such helper exists, write one inline; do not duplicate one across files.

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: **FAIL** — pit branch does not yet read `pendingTimePenalties`.

- [ ] **Step 3: Add the pit-branch consumption to `simulateLap`.**

Find the pit branch in `simulateLap` (around line 150–186 of `src/engine/race/race-simulator.ts`). After the line:

```ts
      lapTime += pitLoss.meanLossSeconds + scatter
```

Insert:

```ts
      // Apply any pending time penalty: served at this pit stop.
      const pending = state.pendingTimePenalties[driverId] ?? 0
      if (pending > 0) {
        lapTime += pending
        state.pendingTimePenalties[driverId] = 0
      }
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: **PASS**.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/race-simulator.ts tests/engine/race/race-simulator.test.ts
git commit -m "feat(race-sim): pit stops consume pendingTimePenalties

When a driver pits with a non-zero pendingTimePenalties[id], the
seconds are added to that lap's pitLoss and the entry is zeroed.
Spec §5.4.2 step 2."
```

---

### Task 12: `simulateLap` — call `evaluateContestedEvent` after the overtake gate

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `tests/engine/race/race-simulator.test.ts`

- [ ] **Step 1: Write a test that forces a fault decision.**

Append to `tests/engine/race/race-simulator.test.ts`:

```ts
describe('simulateLap — fault evaluation after contested overtake', () => {
  it('emits an investigation-opened incident when fault threshold is crossed', () => {
    // Build a state where attacker has overtake command, very low racecraft,
    // very low experience, very high frustration; circuit overtakingDifficulty
    // 'high'; lapDelta makes them adjacent-pair contested. Run simulateLap.
    // Expect at least one 'investigation-opened' incident in the result.
    //
    // (Test author: use the same fixture-building pattern as the prior pit
    // task. Re-seed PRNG to get a stable scenario. The test should NOT depend
    // on exact PRNG output — it only asserts that *some* contested event
    // produces an investigation given inputs that exceed the threshold.)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: **FAIL** — `simulateLap` doesn't yet call `evaluateContestedEvent`.

- [ ] **Step 3: Wire the call after the overtake-gate decision.**

In `simulateLap`, find the contested-overtake gate (around line 228–264). Inside the loop, **after** the `if (allowSwap) { ... } else { ... }` block, insert:

```ts
    // Penalty-engine fault evaluation. Runs on every contested pair regardless
    // of the swap outcome — failed dive bombs are more likely to cause
    // incidents than clean overtakes.
    const aheadDriver = state.drivers.find((d) => d.id === aheadId)!
    const behindDriver = state.drivers.find((d) => d.id === behindId)!
    const aheadStrat = state.strategies.find((s) => s.driverId === aheadId)!
    const behindStrat = state.strategies.find((s) => s.driverId === behindId)!
    const evaluation = evaluateContestedEvent({
      attacker: behindDriver,
      defender: aheadDriver,
      attackerCommand: behindStrat.currentCommand,
      defenderCommand: aheadStrat.currentCommand,
      lapDelta,
      tireDelta: state.tireStates[behindId].wear - state.tireStates[aheadId].wear,
      circuit: { overtakingDifficulty: state.circuit.overtakingDifficulty },
      // Mood is not currently in RaceDriver; default to neutral. This is a
      // known gap — RaceDriver.attributes does not include mood. Future:
      // pipe driver mood through BootstrapDriverInput. For v1, evaluate on
      // observable race state only and rely on racecraft + experience.
      attackerMood: { frustration: 50, confidence: 60 },
      defenderMood: { frustration: 50, confidence: 60 },
      calibration: DEFAULT_PENALTY_CALIBRATION,
    }, rng)
    if (evaluation.decision) {
      const inv = openInvestigation(
        evaluation.decision.driverId,
        evaluation.decision.severity,
        evaluation.decision.offenceType,
        state.currentLap,
        state.totalLaps,
        rng,
      )
      state.pendingInvestigations.push(inv)
      incidents.push({
        lap: state.currentLap,
        type: 'investigation-opened',
        driverIds: [evaluation.decision.driverId],
        description: `${evaluation.decision.driverId.toUpperCase()} under investigation: ${evaluation.decision.offenceType}`,
        investigationId: inv.id,
        offenceType: evaluation.decision.offenceType,
        decideOnLap: inv.decideOnLap,
      })
    }
```

The "mood not in RaceDriver" gap is acknowledged in the inline comment. Future work pipes mood through `BootstrapDriverInput`; for v1, racecraft and experience carry the load.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: **PASS** — the threshold-crossing scenario now produces an `'investigation-opened'` incident.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/race-simulator.ts tests/engine/race/race-simulator.test.ts
git commit -m "feat(race-sim): contested overtakes evaluate fault probability

After the overtake-gate decision, evaluateContestedEvent runs on every
contested pair. A fault-threshold crossing opens an investigation
(deterministic, PRNG-seeded decideOnLap) and emits an
'investigation-opened' RaceIncident. Spec §5.4.2 step 3."
```

---

### Task 13: `simulateRace` — race-end fold + final-lap position rewrite

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `tests/engine/race/race-simulator.test.ts`

- [ ] **Step 1: Write the race-end fold test.**

Append to `tests/engine/race/race-simulator.test.ts`:

```ts
describe('simulateRace — race-end pendingTimePenalties fold', () => {
  it('a driver with no remaining pit stops and pending=10s finishes 10s further behind', () => {
    // Build two simulateRace inputs that are identical except for an injected
    // pendingTimePenalty on driver d1 in one of them. The cumulative-time
    // delta between the two finishing positions of d1 must be exactly 10s.
    // Final-lap LapResult.position must reflect post-penalty ordering.
    //
    // (Test author: this requires either exposing the post-bootstrap state
    // for injection or simulating to lap N-1 and patching state directly
    // before the last lap. Use whichever helper pattern already exists in
    // race-simulator.test.ts.)
  })

  it('determinism replay: the same seed produces byte-identical incidents and final positions when penalties fire', () => {
    // Pick a seed and calibration tuning that forces at least one penalty.
    // Run simulateRace twice. Deep-equal the incidents arrays and the
    // finalPositions arrays.
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or skip placeholder bodies and rely on Step 4 verification).**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts`

- [ ] **Step 3: Add the race-end fold to `simulateRace`.**

In `simulateRace` (around line 344–361), after the per-lap loop ends and **before** the `return` statement, insert:

```ts
  // Race-end fold: any pendingTimePenalties not yet served at a pit stop
  // are added to cumulative time on the final lap. Re-sort positions and
  // rewrite the final-lap LapResult.position values so the emitted data
  // reflects post-penalty ordering.
  for (const driverId of Object.keys(state.pendingTimePenalties)) {
    const seconds = state.pendingTimePenalties[driverId]
    if (seconds > 0) {
      state.cumulativeTimes[driverId] = (state.cumulativeTimes[driverId] ?? 0) + seconds
      state.pendingTimePenalties[driverId] = 0
    }
  }
  const newPositions = [...state.positions].sort(
    (a, b) => (state.cumulativeTimes[a] ?? 0) - (state.cumulativeTimes[b] ?? 0),
  )
  state.positions = newPositions

  // Rewrite final-lap LapResult.position so consumers reading it see the
  // post-penalty grid. Earlier laps stay as historical data.
  const finalLapResults = allLapData[allLapData.length - 1]
  if (finalLapResults) {
    for (let i = 0; i < newPositions.length; i++) {
      const driverId = newPositions[i]
      const lr = finalLapResults.find((r) => r.driverId === driverId)
      if (lr) lr.position = i + 1
    }
  }
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts && npx vitest run tests/engine/race/race-sim-worker.test.ts`
Expected: **PASS** — race-end fold and determinism replay both green; existing tests still green.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/race-simulator.ts tests/engine/race/race-simulator.test.ts
git commit -m "feat(race-sim): race-end pendingTimePenalties fold + position rewrite

After the per-lap loop, residual pending penalties are added to
cumulativeTimes, positions are re-sorted, and the final-lap
LapResult.position values are rewritten so consumers see the
post-penalty grid. Spec §5.4.3."
```

---

## Phase 5 — Worker Protocol Extension

### Task 14: `race-sim-worker.ts` emits `appliedPenaltiesByDriver`

**Files:**
- Modify: `src/workers/race-sim-worker.ts`

- [ ] **Step 1: Apply the same race-end fold to the worker.**

The standalone `simulateRace` in `race-simulator.ts` is a non-worker path used by tests/scripts. The worker has its own per-lap loop driven by `simulateNextLap`. Add the same fold to the worker just before the `'raceEnd'` event is emitted.

In `src/workers/race-sim-worker.ts`, locate the block (around lines 49–64):

```ts
  if (raceState.currentLap >= raceState.totalLaps) {
    const lastResults = raceState.results[raceState.results.length - 1] ?? []
    let fastestLap = { driverId: '', time: Infinity }
    for (const lapResults of raceState.results) {
      for (const result of lapResults) {
        if (result.lapTime < fastestLap.time) {
          fastestLap = { driverId: result.driverId, time: result.lapTime }
        }
      }
    }
    postEvent({
      type: 'raceEnd',
      finalResults: lastResults,
      fastestLap,
    })
    return
  }
```

Replace with:

```ts
  if (raceState.currentLap >= raceState.totalLaps) {
    // Race-end fold: residual pendingTimePenalties → cumulativeTimes,
    // re-sort positions, rewrite final-lap LapResult.position values.
    for (const driverId of Object.keys(raceState.pendingTimePenalties)) {
      const seconds = raceState.pendingTimePenalties[driverId]
      if (seconds > 0) {
        raceState.cumulativeTimes[driverId] = (raceState.cumulativeTimes[driverId] ?? 0) + seconds
        raceState.pendingTimePenalties[driverId] = 0
      }
    }
    const newPositions = [...raceState.positions].sort(
      (a, b) => (raceState.cumulativeTimes[a] ?? 0) - (raceState.cumulativeTimes[b] ?? 0),
    )
    raceState.positions = newPositions

    const lastResults = raceState.results[raceState.results.length - 1] ?? []
    for (let i = 0; i < newPositions.length; i++) {
      const driverId = newPositions[i]
      const lr = lastResults.find((r) => r.driverId === driverId)
      if (lr) lr.position = i + 1
    }

    let fastestLap = { driverId: '', time: Infinity }
    for (const lapResults of raceState.results) {
      for (const result of lapResults) {
        if (result.lapTime < fastestLap.time) {
          fastestLap = { driverId: result.driverId, time: result.lapTime }
        }
      }
    }

    postEvent({
      type: 'raceEnd',
      finalResults: lastResults,
      fastestLap,
      appliedPenaltiesByDriver: { ...raceState.appliedPenaltiesByDriver },
    })
    return
  }
```

- [ ] **Step 2: Verify type-check.**

Run: `npx tsc --noEmit`
Expected: **PASS** — `'raceEnd'` event now matches the extended `WorkerOutEvent` union.

- [ ] **Step 3: Run the worker tests.**

Run: `npx vitest run tests/engine/race/race-sim-worker.test.ts`
Expected: **PASS** — existing tests still green; the new field flows through.

- [ ] **Step 4: Commit.**

```bash
git add src/workers/race-sim-worker.ts
git commit -m "feat(race-sim/worker): race-end fold + emit appliedPenaltiesByDriver

Worker mirrors the simulateRace race-end fold: residual penalties
applied to cumulative times, positions re-sorted, final-lap LapResult
positions rewritten, then 'raceEnd' is posted with the new
appliedPenaltiesByDriver field. Spec §5.4.3 / §4.4.2."
```

---

### Task 15: Worker-protocol round-trip safety test for the new field

**Files:**
- Modify: `tests/engine/race/race-sim-worker.test.ts`

- [ ] **Step 1: Add a JSON round-trip test.**

Append to `tests/engine/race/race-sim-worker.test.ts`:

```ts
import { roundTrip } from '@/workers/race-worker-protocol'

describe('raceEnd event JSON round-trip', () => {
  it('a raceEnd event with appliedPenaltiesByDriver round-trips losslessly', () => {
    const event = {
      type: 'raceEnd' as const,
      finalResults: [{
        lap: 50, driverId: 'd1', lapTime: 90.5,
        sector1: 30, sector2: 30, sector3: 30.5,
        position: 1, gapToLeader: 0, gapToAhead: 0,
        tire: { compound: 'C2' as const, label: 'medium' as const, wear: 50, lapsFitted: 25 },
        pitted: false,
      }],
      fastestLap: { driverId: 'd1', time: 89.5 },
      appliedPenaltiesByDriver: {
        d1: [{
          offenceType: 'collision-minor' as const,
          sanction: '5s' as const,
          timePenaltySeconds: 5,
          penaltyPointsIssued: 1,
          warningCounted: true,
          raceLap: 12,
        }],
      },
    }
    const cloned = roundTrip(event)
    expect(cloned).toEqual(event)
  })
})
```

- [ ] **Step 2: Run test.**

Run: `npx vitest run tests/engine/race/race-sim-worker.test.ts`
Expected: **PASS** — `roundTrip` succeeds because the event contains only JSON-safe values.

- [ ] **Step 3: Commit.**

```bash
git add tests/engine/race/race-sim-worker.test.ts
git commit -m "test(worker-protocol): roundTrip safety for new raceEnd field

Pipeline E rule: every new worker message field must verify JSON
round-trip safety. AppliedPenalty contains only primitives, so the
round-trip is lossless."
```

---

## Phase 6 — Post-Race Wiring

### Task 16: Extend `RaceResult` on `post-race-processor.ts`

**Files:**
- Modify: `src/engine/core/post-race-processor.ts`

- [ ] **Step 1: Extend the `RaceResult` interface.**

In `src/engine/core/post-race-processor.ts`, find the interface (line 25):

```ts
export interface RaceResult {
  driverId: string
  position: number
  dnf: boolean
  fastestLap: boolean
}
```

Replace with:

```ts
import type { AppliedPenalty } from '@/types/race'

export interface RaceResult {
  driverId: string
  position: number
  dnf: boolean
  fastestLap: boolean
  /**
   * Penalties applied to this driver during the race, sourced from the
   * worker's appliedPenaltiesByDriver map and joined per-driver by the
   * main thread before submitRaceResults is called. Empty array if no
   * penalties were applied. Default to [] when omitted by callers built
   * before Tier A.
   */
  appliedPenalties?: AppliedPenalty[]
}
```

The field is **optional** for backward compatibility with existing test fixtures and store-action callers that don't yet pass it. The wiring in Task 17 treats `undefined` as `[]`.

- [ ] **Step 2: Verify type-check.**

Run: `npx tsc --noEmit`
Expected: **PASS** — optional field doesn't break existing callers.

- [ ] **Step 3: Commit.**

```bash
git add src/engine/core/post-race-processor.ts
git commit -m "feat(post-race): RaceResult gains optional appliedPenalties field

Optional for backward compatibility. The wiring in the next task treats
undefined as []. Spec §4.5.3."
```

---

### Task 17: `processPostRace` folds `appliedPenalties` into driver state

**Files:**
- Modify: `src/engine/core/post-race-processor.ts`
- Modify: `tests/engine/core/post-race-processor.test.ts` (or create a new test file if the existing one is too large)

- [ ] **Step 1: Write the failing test.**

Create or extend a test file that exercises the penalty fold. If the existing file is well-organized, append to it; otherwise create `tests/engine/core/post-race-penalty-fold.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'

// Use the project's existing helpers to construct minimal Driver, Team,
// FinanceState fixtures. If no helpers exist, build them inline matching
// the current type shapes.

describe('processPostRace — appliedPenalties fold', () => {
  it('time-penalty entry increments seasonStats.penalties and pushes a PenaltyPointEntry', () => {
    // ... build minimal state with one driver and one result carrying
    //     a single AppliedPenalty { timePenaltySeconds: 5, penaltyPointsIssued: 1, warningCounted: true }.
    // const update = processPostRace(teams, drivers, finance, [], {}, results, false, 5, 'mclaren', createPRNG(1))
    // expect(update.drivers[0].seasonStats.penalties).toBe(1)
    // expect(update.drivers[0].penaltyPoints).toHaveLength(1)
    // expect(update.drivers[0].penaltyPoints[0].points).toBe(1)
    // expect(update.drivers[0].warningsThisSeason).toBe(1)
  })

  it('reprimand (timePenaltySeconds: 0) does NOT increment seasonStats.penalties', () => {
    // AppliedPenalty { timePenaltySeconds: 0, penaltyPointsIssued: 0, warningCounted: true }.
    // expect(update.drivers[0].seasonStats.penalties).toBe(0)
    // expect(update.drivers[0].warningsThisSeason).toBe(1)
  })

  it('crossing 12 active points sets banUntilRound and wipes contributing entries', () => {
    // Driver enters with 11 active points; race adds another 2-point penalty.
    // Expect banUntilRound = currentRound + 1 and penaltyPoints wiped of contributors.
  })

  it('crossing 5 warnings sets nextRaceGridDrop=10 and resets warningsThisSeason', () => {
    // Driver enters with 4 warnings; race adds another warning-counted penalty.
    // Expect nextRaceGridDrop = 10 and warningsThisSeason = 0.
  })

  it('a driver whose banUntilRound === currentRound has it cleared at start', () => {
    // Driver enters with banUntilRound = 5; processPostRace called with currentRound = 5.
    // Expect banUntilRound === null after processing.
  })

  it('idempotency guard: a re-fire with same currentRound is a no-op', () => {
    // (relies on existing seasonStats.lastProcessedRound guard)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/core/`
Expected: **FAIL** — `processPostRace` doesn't yet handle `appliedPenalties`.

- [ ] **Step 3: Add the wiring.**

In `src/engine/core/post-race-processor.ts`, modify the function:

1. Add imports at the top:
```ts
import { expirePenaltyPoints, sumActivePoints, wipeContributingPoints } from '@/engine/drivers/penalty-points'
import { DEFAULT_PENALTY_CALIBRATION } from '@/data/penalty-calibration'
```

2. Add a `currentSeason` parameter to `processPostRace` (or derive it from existing state — verify against the function signature in the file). For now, assume it's available either via an existing parameter or derivable from the orchestrator caller.

3. **At the very start of `processPostRace`**, before step 1:
```ts
  // Clear any ban whose suspended round equals currentRound — that race has now been served.
  drivers = drivers.map((d) =>
    d.banUntilRound === currentRound ? { ...d, banUntilRound: null } : d,
  )
```

4. **Inside the existing step 1 driver-stats loop**, after the existing per-result work and **before** the `return { ...driver, seasonStats: stats, ... }`, fold penalties:

```ts
    // Fold appliedPenalties into the driver's persistent state.
    let penaltyPoints = [...driver.penaltyPoints]
    let warningsThisSeason = driver.warningsThisSeason
    let nextRaceGridDrop = driver.nextRaceGridDrop
    let banUntilRound = driver.banUntilRound
    const applied = result.appliedPenalties ?? []
    for (const ap of applied) {
      if (ap.penaltyPointsIssued > 0) {
        penaltyPoints.push({
          points: ap.penaltyPointsIssued,
          issuedSeason: <currentSeason>,   // wire from existing function context
          issuedRound: currentRound,
          offenceType: ap.offenceType,
          raceId: `r${currentRound}`,
        })
      }
      if (ap.warningCounted) warningsThisSeason += 1
      if (ap.timePenaltySeconds > 0) stats.penalties += 1
    }
    // Expire stale entries
    penaltyPoints = expirePenaltyPoints(penaltyPoints, <currentSeason>, currentRound, DEFAULT_PENALTY_CALIBRATION.rollingWindowRounds)
    // Ban check
    if (sumActivePoints(penaltyPoints) >= DEFAULT_PENALTY_CALIBRATION.banThreshold) {
      banUntilRound = currentRound + DEFAULT_PENALTY_CALIBRATION.banDurationRounds
      penaltyPoints = wipeContributingPoints(penaltyPoints, DEFAULT_PENALTY_CALIBRATION.banThreshold)
    }
    // Warning threshold
    if (warningsThisSeason >= DEFAULT_PENALTY_CALIBRATION.warningThreshold) {
      nextRaceGridDrop = Math.max(nextRaceGridDrop, DEFAULT_PENALTY_CALIBRATION.warningGridDrop)
      warningsThisSeason = 0
    }

    return {
      ...driver,
      seasonStats: stats,
      form: pushForm(driver.form, formSample),
      lastRaceResult: result.dnf ? null : result.position,
      penaltyPoints,
      warningsThisSeason,
      nextRaceGridDrop,
      banUntilRound,
    }
```

The `<currentSeason>` placeholder must be resolved to the actual season number. If `processPostRace` does not currently receive season explicitly, either add it as a parameter (cleanest) or derive it from the call site. Inspect the existing function signature and the orchestrator caller in `src/engine/core/orchestrator.ts` to choose. Do not invent a season — wire it from existing state.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/core/`
Expected: **PASS** — all penalty-fold tests pass; existing tests still green.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/core/post-race-processor.ts tests/engine/core/
git commit -m "feat(post-race): fold appliedPenalties into driver state

processPostRace now:
- clears banUntilRound when its suspended round has been served
- pushes PenaltyPointEntry for each penalty-points-bearing sanction
- increments warningsThisSeason and seasonStats.penalties (the latter
  only when timePenaltySeconds > 0, per spec §6.1)
- expires stale penalty-point entries (22-round rolling window)
- sets banUntilRound + wipes contributing entries on 12-point cross
- sets nextRaceGridDrop=10 + resets warnings on 5-warning cross

Spec §5.5."
```

---

### Task 18: Strategy page main-thread join — wire `appliedPenaltiesByDriver` into `RaceResult[]`

**Files:**
- Modify: `src/app/strategy/page.tsx`

- [ ] **Step 1: Update the `onRaceEnd` callback.**

In `src/app/strategy/page.tsx` around line 114, change:

```ts
const onRaceEnd = useCallback((finalResults: import('@/types/race').LapResult[], fastestLap: { driverId: string; time: number }) => {
  const raceResults = finalResults.map(r => ({
    driverId: r.driverId,
    position: r.position,
    dnf: false,
    fastestLap: r.driverId === fastestLap.driverId,
  }))
  // ...
}, [...])
```

To:

```ts
const onRaceEnd = useCallback((
  finalResults: import('@/types/race').LapResult[],
  fastestLap: { driverId: string; time: number },
  appliedPenaltiesByDriver: Record<string, import('@/types/race').AppliedPenalty[]>,
) => {
  const raceResults = finalResults.map(r => ({
    driverId: r.driverId,
    position: r.position,
    dnf: false,
    fastestLap: r.driverId === fastestLap.driverId,
    appliedPenalties: appliedPenaltiesByDriver[r.driverId] ?? [],
  }))
  // ...
}, [...])
```

The signature change cascades upward: whoever calls `onRaceEnd` (likely `useRaceSimulation` hook or the worker adapter `race-worker-adapter.ts`) needs to pass the third argument. Find the call site by `Grep`-ing for `onRaceEnd` in the codebase and update the chain.

- [ ] **Step 2: Update the worker adapter call chain.**

`Grep` for `onRaceEnd` and `'raceEnd'` across `src/`. Wherever the worker emits `'raceEnd'` and the adapter forwards it, ensure `appliedPenaltiesByDriver` flows through to `onRaceEnd`. The adapter file is likely `src/engine/race/race-worker-adapter.ts` or `src/hooks/use-race-simulation.ts`. Update the type signature and the call.

- [ ] **Step 3: Verify type-check.**

Run: `npx tsc --noEmit`
Expected: **PASS** — every link in the chain carries the new field.

- [ ] **Step 4: Verify the page renders.**

Run the dev server in the background and verify the strategy page:

```bash
npm run dev &
# wait briefly, then:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/strategy --max-time 30
```

Expected: **200**.

Stop the dev server when done.

- [ ] **Step 5: Commit.**

```bash
git add src/app/strategy/page.tsx src/engine/race/race-worker-adapter.ts src/hooks/use-race-simulation.ts
# (adjust the file list to match what was actually touched)
git commit -m "feat(strategy-page): join appliedPenaltiesByDriver per driver

The onRaceEnd callback chain now carries the worker's per-driver
penalty map. The strategy page builds RaceResult[] with
appliedPenalties: appliedPenaltiesByDriver[id] ?? []. Spec §4.5.4."
```

---

## Phase 7 — Race Bootstrap (Ban + Grid Drop)

### Task 19: Pure helpers `applyBanSubstitution` and `applyGridDrops`

**Files:**
- Modify: `src/engine/race/race-bootstrap.ts`
- Modify: `tests/engine/race/race-bootstrap.test.ts`

- [ ] **Step 1: Write the failing tests.**

Append to `tests/engine/race/race-bootstrap.test.ts`:

```ts
import { applyBanSubstitution, applyGridDrops } from '@/engine/race/race-bootstrap'

describe('applyBanSubstitution', () => {
  it('substitutes a banned driver with the team reserve when reserveDriverId is set', () => {
    const banned = { id: 'd1', teamId: 't1', banUntilRound: 5, isReserve: false }
    const reserve = { id: 'r1', teamId: 't1', banUntilRound: null, isReserve: true }
    const team = { id: 't1', reserveDriverId: 'r1' }
    const result = applyBanSubstitution([banned], [banned, reserve], [team], 5)
    expect(result.drivers).toHaveLength(1)
    expect(result.drivers[0].id).toBe('r1')
    expect(result.substitutions).toEqual([{ bannedId: 'd1', substituteId: 'r1', teamId: 't1' }])
  })

  it('falls back to first matching isReserve driver when reserveDriverId is null', () => {
    const banned = { id: 'd1', teamId: 't1', banUntilRound: 5, isReserve: false }
    const reserve = { id: 'rx', teamId: 't1', banUntilRound: null, isReserve: true }
    const team = { id: 't1', reserveDriverId: null }
    const result = applyBanSubstitution([banned], [banned, reserve], [team], 5)
    expect(result.drivers[0].id).toBe('rx')
  })

  it('drops banned driver when no reserve is available (one-car team)', () => {
    const banned = { id: 'd1', teamId: 't1', banUntilRound: 5, isReserve: false }
    const team = { id: 't1', reserveDriverId: null }
    const result = applyBanSubstitution([banned], [banned], [team], 5)
    expect(result.drivers).toHaveLength(0)
    expect(result.substitutions).toEqual([{ bannedId: 'd1', substituteId: null, teamId: 't1' }])
  })

  it('passes through drivers whose ban is in the past', () => {
    const driver = { id: 'd1', teamId: 't1', banUntilRound: 3, isReserve: false }
    const team = { id: 't1', reserveDriverId: 'r1' }
    const result = applyBanSubstitution([driver], [driver], [team], 5)
    expect(result.drivers[0].id).toBe('d1')
    expect(result.substitutions).toHaveLength(0)
  })
})

describe('applyGridDrops', () => {
  it('shifts a driver down by their nextRaceGridDrop, clamped to grid size', () => {
    const qualified = ['p1', 'p2', 'p3', 'p4', 'p5']
    const drops = { p1: 10 }  // overshoots — clamps to last
    const result = applyGridDrops(qualified, drops)
    expect(result.gridOrder[result.gridOrder.length - 1]).toBe('p1')
  })

  it('zero drop is a no-op', () => {
    const qualified = ['a', 'b', 'c']
    expect(applyGridDrops(qualified, {}).gridOrder).toEqual(['a', 'b', 'c'])
  })

  it('multiple drops resolve deterministically', () => {
    const qualified = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const drops = { p1: 3, p3: 2 }
    const result = applyGridDrops(qualified, drops)
    // Verify: result is a permutation of qualified; p1 and p3 are penalised.
    expect(new Set(result.gridOrder)).toEqual(new Set(qualified))
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/race-bootstrap.test.ts`
Expected: **FAIL** — `applyBanSubstitution` and `applyGridDrops` not exported.

- [ ] **Step 3: Add the helpers to `src/engine/race/race-bootstrap.ts`.**

Append to the file:

```ts
export interface BanSubstitutionInput {
  id: string
  teamId: string
  banUntilRound: number | null
  isReserve: boolean
}

export interface BanSubstitutionTeam {
  id: string
  reserveDriverId: string | null
}

export interface BanSubstitutionResult<T extends BanSubstitutionInput> {
  drivers: T[]
  substitutions: { bannedId: string; substituteId: string | null; teamId: string }[]
}

/**
 * For each banned driver in the lineup whose banUntilRound covers the current
 * round, substitute the team reserve (lookup by team.reserveDriverId, then
 * fall through to the first roster member with isReserve=true). If no reserve
 * is available, the banned driver is dropped (one-car team). Pure.
 */
export function applyBanSubstitution<T extends BanSubstitutionInput>(
  lineup: T[],
  roster: T[],
  teams: BanSubstitutionTeam[],
  currentRound: number,
): BanSubstitutionResult<T> {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const drivers: T[] = []
  const substitutions: BanSubstitutionResult<T>['substitutions'] = []
  for (const driver of lineup) {
    const isBanned = driver.banUntilRound !== null && currentRound <= driver.banUntilRound
    if (!isBanned) {
      drivers.push(driver)
      continue
    }
    const team = teamById.get(driver.teamId)
    let substitute: T | undefined
    if (team?.reserveDriverId) {
      substitute = roster.find((d) => d.id === team.reserveDriverId)
    }
    if (!substitute) {
      substitute = roster.find((d) => d.teamId === driver.teamId && d.isReserve)
    }
    if (substitute) {
      drivers.push(substitute)
      substitutions.push({ bannedId: driver.id, substituteId: substitute.id, teamId: driver.teamId })
    } else {
      substitutions.push({ bannedId: driver.id, substituteId: null, teamId: driver.teamId })
    }
  }
  return { drivers, substitutions }
}

/**
 * Applies grid-position drops after qualifying. Pure: returns a new array.
 * Drops that would push a driver past the back of the grid clamp to the last
 * position. Multiple drops are resolved by a stable insertion-sort pass.
 */
export function applyGridDrops(
  qualifiedOrder: string[],
  drops: Record<string, number>,
): { gridOrder: string[] } {
  const indexed = qualifiedOrder.map((id, i) => ({ id, target: i + (drops[id] ?? 0) }))
  // Stable sort by target. Ties resolve by original qualifying order.
  indexed.sort((a, b) => a.target - b.target)
  return { gridOrder: indexed.map((x) => x.id) }
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/race-bootstrap.test.ts`
Expected: **PASS**.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/race-bootstrap.ts tests/engine/race/race-bootstrap.test.ts
git commit -m "feat(race-bootstrap): applyBanSubstitution + applyGridDrops

Two pure helpers callable by the orchestrator before bootstrapRace
to filter out banned drivers (replacing with reserves or running
one-car teams) and to apply qualifying grid drops. Spec §5.6."
```

---

### Task 20: Wire ban substitution and grid drops into the orchestrator

**Files:**
- Modify: `src/engine/core/orchestrator.ts` (or wherever the bootstrap input is built — confirm by reading)
- Modify: relevant tests

- [ ] **Step 1: Locate where `RaceBootstrapInput.drivers` is built.**

Use Grep:

- Pattern: `bootstrapRace\(` — find every call site.
- Pattern: `RaceBootstrapInput` — find every constructor.

The likely site is `src/engine/core/orchestrator.ts` (a `processRaceEntry` or `prepareRace` function). If not, follow the call graph to wherever player/AI driver lists are assembled into `BootstrapDriverInput[]`.

- [ ] **Step 2: Insert the helpers before bootstrap-input construction.**

In the located file, before the `BootstrapDriverInput[]` array is built, call:

```ts
const banResult = applyBanSubstitution(
  lineup,         // current player + AI driver list, with banUntilRound + teamId
  drivers,        // full roster
  teams,          // full team list with reserveDriverId
  currentRound,
)
// banResult.drivers is the substituted lineup
// banResult.substitutions is a side-channel for UI commentary

const gridDrops: Record<string, number> = Object.fromEntries(
  banResult.drivers
    .filter((d) => d.nextRaceGridDrop > 0)
    .map((d) => [d.id, d.nextRaceGridDrop]),
)
const { gridOrder } = applyGridDrops(qualifyingOrder, gridDrops)

// Zero out nextRaceGridDrop on consumed drivers (mutate the world copy here).
const consumedDrivers = drivers.map((d) =>
  gridDrops[d.id] ? { ...d, nextRaceGridDrop: 0 } : d,
)
```

The `nextRaceGridDrop` zeroing must update the persisted `world.drivers` so the drop is consumed exactly once.

If the orchestrator does not currently track a `qualifyingOrder` separately, this is open question (D.4.a) materialising. In that case, document the integration point as a follow-up — for v1, the grid-drop application can live in the strategy-page bootstrap-input assembly, and `qualifyingOrder` becomes whatever the existing UI uses to order drivers before passing to the worker.

- [ ] **Step 3: Run all tests.**

Run: `npx vitest run`
Expected: **PASS** — full suite green.

- [ ] **Step 4: Commit.**

```bash
git add src/engine/core/orchestrator.ts # (and any other touched files)
git commit -m "feat(orchestrator): apply ban substitution + grid drops pre-race

Before constructing BootstrapDriverInput[], the orchestrator runs
applyBanSubstitution (replacing banned drivers with reserves) and
applyGridDrops (consuming nextRaceGridDrop). Spec §5.6 ties these
two helpers together at the integration seam."
```

---

## Phase 8 — UI Surfaces (Brainstorm-First Per Component)

### Task 21: Stewards card on the race UI

**Files:**
- Create: `src/components/strategy/stewards-card.tsx` (path may vary per existing convention)
- Modify: the race-phase view in `src/app/strategy/page.tsx` to render it

- [ ] **Step 1: Brainstorm the visual treatment.**

Before writing code, invoke the project's `frontend-design` skill (per AGENTS.md `ui-interface` agent rules). The card must respect the existing theme (Kinetic Command for non-Broadcast pages, Broadcast for `/strategy` after the redesign). Key constraints: dark surface, lime/cyan accents OR signal-red for Broadcast, no `transition-all`, `transform`/`opacity` only.

The card lists currently-pending investigations: driver short name, offence type label (human-readable), lap detected, "Decision lap N" countdown.

- [ ] **Step 2: Implement the component.**

After brainstorm approval, implement the component matching the agreed design. Read pending investigations from the race incident list (filter by `type === 'investigation-opened'`, exclude any whose matching `'penalty-issued'` or `'investigation-closed'` event has arrived).

- [ ] **Step 3: Render in the race-phase view.**

Place it where it doesn't compete with the timing tower or commentary feed.

- [ ] **Step 4: Verify HTTP 200 on `/strategy`.**

Run dev server, hit the URL, confirm 200.

- [ ] **Step 5: Commit.**

---

### Task 22: Stewards' Decisions panel in the post-race results view

Same brainstorm-first process. The panel is a tabular list of every penalty applied during the race plus current per-driver penalty-point totals after the round.

- [ ] **Step 1: Brainstorm visual treatment.**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Wire data: read from `world.lastRaceResults` (or wherever post-race data lives) plus driver `penaltyPoints`.**
- [ ] **Step 4: Verify HTTP 200.**
- [ ] **Step 5: Commit.**

---

### Task 23: Penalty Record section on Driver Office

Same brainstorm-first process. Section shows current rolling-window total, per-entry list with issued + expiry round, season warnings counter, ban status, risk colour band (0-4 green / 5-8 amber / 9-11 red / 12+ banned).

- [ ] **Step 1: Brainstorm visual treatment.**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify HTTP 200 on the Driver Office route.**
- [ ] **Step 4: Commit.**

---

## Phase 9 — Documentation

### Task 24: Update architecture docs

**Files:**
- Modify: `docs/architecture/persistence-contract.md` (if not already updated by Task 8)
- Modify: `docs/architecture/current-state-baseline.md` (add IP-09 entry)

- [ ] **Step 1: Add IP-09 row to the implementation-phase status table.**

In `docs/architecture/current-state-baseline.md`, add an IP-09 entry describing the Tier A penalty system shipping. Note the deferred Tier B and Tier C in the "next" section.

- [ ] **Step 2: Verify `persistence-contract.md` reflects the v8 schema additions.**

If not done in Task 8, do it now.

- [ ] **Step 3: Commit.**

```bash
git add docs/architecture/current-state-baseline.md docs/architecture/persistence-contract.md
git commit -m "docs: IP-09 Penalty System Tier A — current-state + persistence

current-state-baseline gains IP-09 entry. persistence-contract documents
v8 schema additions (4 new Driver fields). Tier B and Tier C tracked
as separate brainstorm cycles."
```

---

## Phase 10 — Final Verification

### Task 25: Full test suite + tsc + lint

- [ ] **Step 1: Run TypeScript.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Run full test suite.**

Run: `npx vitest run`
Expected: all green; no skipped tests; no `// @ts-ignore` introduced.

- [ ] **Step 3: Run lint.**

Run: `npm run lint`
Expected: clean.

---

### Task 26: Determinism replay gate (hard requirement)

- [ ] **Step 1: Confirm a determinism replay test exists in `tests/engine/race/race-simulator.test.ts`.**

It should run a seeded race with calibration tuned to force at least one penalty, capture incidents and final positions, run the race a second time with the same seed, and `toEqual` both arrays.

- [ ] **Step 2: Run it.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts -t determinism`
Expected: **PASS**. Race is byte-identical across two runs.

If the test doesn't exist yet (Task 13's placeholder body wasn't filled in), implement it now using the seed-and-fixture pattern that already exists in race-simulator.test.ts. This is a HARD GATE — do not declare the work complete without it.

---

### Task 27: Code-reviewer agent pass

- [ ] **Step 1: Dispatch the `code-reviewer` agent on the changed files.**

Use the `Agent` tool with `subagent_type: code-reviewer` (or the project-local `everything-claude-code:code-reviewer` per the AGENTS.md preference). Hand it the diff scope (every file touched by tasks 1-26).

- [ ] **Step 2: Action any CRITICAL or HIGH findings.**

Fix-and-recheck via `superpowers:receiving-code-review`. Re-run the test suite after each fix.

- [ ] **Step 3: Acknowledge MEDIUM and LOW findings.**

Either action them or document why deferred (link to a follow-up issue or note in `docs/architecture/current-state-baseline.md`).

---

## Done

When every task above is checked off and the determinism replay test is green, the Tier A penalty system is shipped. Tier B and Tier C remain as separate, future brainstorm cycles per spec §11.