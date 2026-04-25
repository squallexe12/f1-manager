# Race Penalty System — Tier A v1 Design Spec

**Date:** 2026-04-25
**Workstream:** Race-weekend in-race penalty enforcement (Tier A, v1)
**Scope:** Detection, adjudication, and application of overtake-adjacent driving penalties during a simulated race, plus the cross-cutting infrastructure (penalty points, super-licence ban, season warnings, persistence) that Tiers B and C will later build on.
**Source reference:** [docs/architecture/f1_penalty_system_technical.md](../architecture/f1_penalty_system_technical.md)

---

## 1. Purpose

The race simulator currently treats contested overtake attempts as a binary: either the swap is allowed (clean pass) or blocked (driver stuck behind). There is no notion of "a fault was committed during the contest." Real F1 has a stewards' apparatus that issues time penalties, penalty points, warnings, and bans for in-race driving offences. This system is the most visible mark of authenticity that distinguishes a credible F1 management sim from an arcade racer.

This spec defines **Tier A v1** of an in-race penalty engine: the overtake-adjacent offence categories (collision-minor, collision-serious, forcing-off, illegal-defending) plus all the persistent driver-state machinery (penalty-points record with rolling 22-round expiry, season warnings counter, race-level ban with reserve substitution, qualifying grid drops). Tiers B (pit-stop offences) and C (track-state offences) are scoped out and tracked separately.

The system runs deterministically inside the existing seeded race simulator, integrates cleanly into the worker protocol via additive incident sub-types, persists through a single `v7 → v8` schema migration, and surfaces in the existing race UI / post-race / driver-detail surfaces without introducing new top-level routes.

## 2. Non-Goals

- No pit-stop-adjacent offences (unsafe release, pit-lane speeding) — deferred to Tier B v2 brainstorm.
- No track-state-adjacent offences (track limits, yellow/red flag breaches, safety-car overtakes) — deferred to Tier C v3 brainstorm.
- No misconduct, language, press-conference, or political-statement offences — permanently out of race-sim scope.
- No post-race scrutineering DSQ or technical-non-compliance — separate technical-regulations workstream.
- No FIA Right of Review / appeals — permanently out.
- No pre-emptive position handback ("you must give back the position") mechanic — too much state-machine complexity for v1.
- No both-driver shared blame — v1 issues to a single driver per incident.
- No calendar-month penalty-point expiry — round-based expiry approximates 12 months and is cleaner.
- No 3-lap window enforcement for drive-through / stop-and-go (DNF if not served) — v1 converts these directly to seconds. Window enforcement is a Tier B item.
- The Factory PU `team.penaltiesTaken` readout — already deferred per [project memory](../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_factory_penalties_todo.md). It belongs to a separate race-weekend component-swap lifecycle workstream and is unrelated to driving penalties.

## 3. Success Criteria

- Every contested overtake event in [src/engine/race/race-simulator.ts](../../src/engine/race/race-simulator.ts) runs through the penalty engine with deterministic, seeded fault evaluation.
- The full loop fires end-to-end during a simulated race: contested event → fault score → investigation opened (1–5 lap deferred window) → penalty issued → time-penalty served at next pit or race end → penalty points recorded → ban check → grid-drop check.
- A seeded race produces byte-identical incident streams and final positions across two runs (determinism gate, hard requirement).
- A driver crossing 12 penalty points within a rolling 22-round window is banned from the next race and replaced by the team's reserve (or the team races with one car if no reserve is available).
- A driver accumulating 5 driving warnings in a season starts the next race 10 places lower on the grid; warnings reset at season end.
- All four `appliedPenalties`-related driver-state fields persist across `save → reload` round-trips through the v8 schema.
- `npx tsc --noEmit`, `npx vitest run`, and `npm run lint` pass green at each pipeline step.
- Real-F1 frequency calibration: ~1.5 in-race time penalties per race, ~3 investigations per race, ~0.4 penalty points per driver per race, measured across a seeded full-season replay.

## 4. Architecture

### 4.1 Module Layout

```
src/engine/race/
├── penalty-engine.ts          # NEW — pure functions: evaluateContestedEvent, openInvestigation, resolveInvestigations, selectSanction
├── race-simulator.ts          # MODIFIED — integrates penalty-engine into the contested-overtake gate; handles pendingTimePenalties at pit + race end
└── race-bootstrap.ts          # MODIFIED — substitutes banned drivers with reserves before grid order is set

src/engine/drivers/
└── penalty-points.ts          # NEW — pure functions: expirePenaltyPoints, sumActivePoints, processBanThreshold

src/engine/core/
├── post-race-processor.ts     # MODIFIED — folds AppliedPenalty entries into driver state, runs ban + warning threshold checks
└── save-system.ts             # MODIFIED — SCHEMA_VERSION 7→8, MIGRATIONS['7→8']

src/data/
└── penalty-calibration.ts     # NEW — DEFAULT_PENALTY_CALIBRATION constants

src/types/
├── race.ts                    # MODIFIED — RaceIncident discriminator additions, AppliedPenalty type
└── driver.ts                  # MODIFIED — Driver gains penaltyPoints[], warningsThisSeason, nextRaceGridDrop, banUntilRound

docs/architecture/
├── persistence-contract.md    # MODIFIED — document v8 schema additions
└── current-state-baseline.md  # MODIFIED — note penalty system as IP-09

tests/
├── engine/race/penalty-engine.test.ts                       # NEW
├── engine/race/race-simulator.test.ts                       # EXTEND
├── engine/race/race-bootstrap.test.ts                       # EXTEND
├── engine/drivers/penalty-points.test.ts                    # NEW
├── engine/core/post-race-processor.test.ts                  # EXTEND
├── engine/core/save-system.test.ts                          # EXTEND
└── stores/race-slice.test.ts                                # EXTEND
```

### 4.2 Layer Placement

The penalty system is a **`sim-engine` concern**. All new modules under `src/engine/` are pure functions with the project's standard purity contract:

- No imports from `src/stores/`, `src/hooks/`, `src/components/`, or `src/app/`.
- No browser APIs (`window`, `document`, `localStorage`, `IndexedDB`, `fetch`).
- No `Math.random()` — all randomness routes through the seeded `PRNG`.
- All data structures remain JSON-serializable (no class instances, `Date`, `Map`, or `Set`).
- New functions accept state + PRNG, return new state.

### 4.3 Information Flow

**During a single lap (worker-side, deterministic):**

```
simulateLap (state, rng):
  ─ resolveInvestigations(pendingInvestigations, currentLap)        ← NEW (start of lap)
      ├── for each resolved entry:
      │     ├── selectSanction(severity, offenceType, calibration, rng)
      │     ├── pendingTimePenalties[driverId] += sanction.timePenaltySeconds
      │     ├── push 'penalty-issued' incident
      │     └── append AppliedPenalty to per-driver record (worker-side)
      └── pendingInvestigations = stillPending

  ─ for each driver: compute lap time
      ├── if currentCommand === 'pit':
      │     lapTime += pitLoss + scatter
      │     lapTime += pendingTimePenalties[driverId] ?? 0          ← NEW
      │     pendingTimePenalties[driverId] = 0                       ← NEW
      └── else: degrade tires, etc.

  ─ for each adjacent contested pair (existing overtake gate):
      ├── overtake gate decides swap (existing)
      └── evaluateContestedEvent(input, rng)                          ← NEW (every contested pair)
            └── if decision !== null:
                  ├── inv = openInvestigation(driverId, currentLap, totalLaps, rng)
                  ├── pendingInvestigations.push(inv)
                  └── push 'investigation-opened' incident

  ─ after final lap (in simulateRace):
      └── for each driver with pendingTimePenalties[id] > 0:           ← NEW
            cumulativeTimes[id] += pendingTimePenalties[id]
        re-sort finalPositions from cumulativeTimes
```

**Post-race (main thread, in `processPostRace`):**

```
for each RaceResult with appliedPenalties:
  for each AppliedPenalty:
    if penaltyPointsIssued > 0:
      driver.penaltyPoints.push(PenaltyPointEntry)
    if warningCounted:
      driver.warningsThisSeason += 1
    seasonStats.penalties += 1

driver.penaltyPoints = expirePenaltyPoints(driver.penaltyPoints, currentSeason, currentRound)

if sumActivePoints(driver.penaltyPoints) >= 12:
  driver.banUntilRound = currentRound + 1
  driver.penaltyPoints = wipeContributingPoints(driver.penaltyPoints)

if driver.warningsThisSeason >= 5:
  driver.nextRaceGridDrop = max(driver.nextRaceGridDrop, 10)
  driver.warningsThisSeason = 0  // consumed-and-reset

// Clear ban for drivers whose served race just completed
if driver.banUntilRound === currentRound:
  driver.banUntilRound = null
```

**Race-bootstrap (main thread, before next race starts):**

```
for each driver in lineup:
  if driver.banUntilRound !== null && currentRound <= driver.banUntilRound:
    substitute = team.reserveDriverId
              ?? firstDriver({ teamId: driver.teamId, isReserve: true })
              ?? null
    if substitute: replace driver in bootstrap input
    else:          drop driver from bootstrap input (one-car team this race)

apply nextRaceGridDrop to qualifying-ordered grid:
  for each driver: driver.gridPosition += driver.nextRaceGridDrop
                   driver.nextRaceGridDrop = 0
  re-sort gridOrder; clamp final positions to [1, gridSize]
```

### 4.4 Worker Protocol Additions

`RaceIncident` discriminator in [src/types/race.ts](../../src/types/race.ts) gains three new types under the existing `incident` worker-output channel — no new top-level worker message types required:

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

export interface RaceIncident {
  lap: number
  driverIds: string[]
  description: string
  type:
    | 'crash'
    | 'mechanical'
    | 'safety-car'
    | 'weather-change'
    | 'investigation-opened'    // NEW
    | 'penalty-issued'           // NEW
    | 'investigation-closed'     // NEW (no penalty, e.g. "no further action")
  // optional payload populated for the new sub-types
  investigationId?: string
  sanction?: SanctionType
  penaltyPointsIssued?: number
  offenceType?: OffenceType
  decideOnLap?: number           // populated on 'investigation-opened' so UI can show countdown
}
```

The legacy `'penalty'` sub-type (currently in the discriminator union but never emitted by the simulator) is **removed**. Since it was never produced and never consumed, this is a type-only cleanup with no runtime impact. Race state is not persisted — this change does not require a save-system migration on its own.

### 4.5 New `AppliedPenalty` Type on `RaceResult`

```ts
export interface AppliedPenalty {
  offenceType: OffenceType
  sanction: SanctionType
  timePenaltySeconds: number
  penaltyPointsIssued: number
  warningCounted: boolean
  raceLap: number
}

export interface RaceResult {
  driverId: string
  position: number
  dnf: boolean
  fastestLap: boolean
  appliedPenalties: AppliedPenalty[]   // NEW
}
```

The worker accumulates `AppliedPenalty` entries per driver during the race. They flow to the main thread on `'raceEnd'` as part of the final results, then `processPostRace` reads them.

## 5. Engine Modules

### 5.1 `src/engine/race/penalty-engine.ts` (new)

#### 5.1.1 Public API

```ts
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
  attackerFault: number     // 0..1 clamped
  defenderFault: number     // 0..1 clamped
  decision: null | { driverId: string; severity: SeverityTier; offenceType: OffenceType }
}

export interface PendingInvestigation {
  id: string                 // deterministic: `inv-${seed}-${currentLap}-${driverId}`
  driverId: string
  openedOnLap: number
  decideOnLap: number
  severity: SeverityTier
  offenceType: OffenceType
}

export function evaluateContestedEvent(
  input: ContestedEventInput,
  rng: PRNG,
): FaultEvaluation

export function openInvestigation(
  decisionDriverId: string,
  severity: SeverityTier,
  offenceType: OffenceType,
  currentLap: number,
  totalLaps: number,
  rng: PRNG,
): PendingInvestigation

export function resolveInvestigations(
  pending: PendingInvestigation[],
  currentLap: number,
): { resolved: PendingInvestigation[]; stillPending: PendingInvestigation[] }

export function selectSanction(
  severity: SeverityTier,
  offenceType: OffenceType,
  calibration: PenaltyCalibration,
  rng: PRNG,
): {
  sanction: SanctionType
  timePenaltySeconds: number
  penaltyPoints: number
  warningCounted: boolean
}
```

#### 5.1.2 Fault Score Formula

Computed identically for attacker and defender, swapping inputs:

```
fault =
    aggression(command)                    // 'overtake' = 0.30, 'push' = 0.15, 'defend' = 0.20, others = 0
  + optimism(racecraft)                     // (100 - racecraft) / 200
  + frustrationPressure(mood.frustration)   // max(0, mood.frustration - 60) / 200
  + tireMismatchRisk(tireDelta)             // for attacker: max(0, -tireDelta) * 0.005; for defender: 0
  + circuitDifficulty                       // low: 0.0, medium: 0.05, high: 0.10
  - experienceProtection(experience)        // experience / 500

clamp to [0, 1]
```

The defender's fault score uses the **defender command** (`'defend'`) and **defender racecraft / experience / mood** as inputs. The `tireMismatchRisk` term is attacker-only — defenders don't get blamed for being on old tires.

#### 5.1.3 Decision Rule

```
threshold = calibration.faultThreshold       // default 0.55
maxFault  = max(attackerFault, defenderFault)
if maxFault < threshold: return { decision: null, ... }

blamed   = whichever side has the higher score (ties → attacker)
severity = severityFromScore(blamedFault, threshold, calibration.severityBands)
              // blamedFault - threshold:
              //   [0.00, 0.10) → 'minor'
              //   [0.10, 0.25) → 'serious'
              //   [0.25, 0.40) → 'major'
              //   [0.40, 1.00] → 'egregious'

offenceType =
  if blamed === attacker:
    if attackerCommand === 'overtake':
      severity in {'minor','serious'} → 'collision-minor' or 'collision-serious'
      severity in {'major','egregious'} → 'collision-serious'
    else: 'forcing-off'
  if blamed === defender:
    'illegal-defending'
```

#### 5.1.4 Investigation Window

`openInvestigation` deterministically computes `decideOnLap`:

```
window  = rng.range(calibration.investigationWindow.minLaps,
                    calibration.investigationWindow.maxLaps)   // default [1, 5]
clamped = min(currentLap + window, totalLaps)                 // never decide after the flag
```

If the natural decision lap exceeds `totalLaps`, the decision lands on the final lap.

### 5.2 `src/data/penalty-calibration.ts` (new)

```ts
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
  banThreshold: number          // 12
  banDurationRounds: number     // 1
  warningThreshold: number      // 5
  warningGridDrop: number       // 10
  rollingWindowRounds: number   // 22 (one full season ≈ 12 real-F1 months)
}

export const DEFAULT_PENALTY_CALIBRATION: PenaltyCalibration = {
  faultThreshold: 0.55,
  severityBands: { minor: 0.10, serious: 0.25, major: 0.40, egregious: 1.00 },
  investigationWindow: { minLaps: 1, maxLaps: 5 },
  sanctionMatrix: {
    'collision-minor': {
      minor:     { sanction: '5s',   timePenaltySeconds: 5,  penaltyPoints: 1, warningCounted: true },
      serious:   { sanction: '5s',   timePenaltySeconds: 5,  penaltyPoints: 2, warningCounted: true },
      major:     { sanction: '10s',  timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
      egregious: { sanction: '10s',  timePenaltySeconds: 10, penaltyPoints: 3, warningCounted: true },
    },
    'collision-serious': {
      minor:     { sanction: '10s',          timePenaltySeconds: 10, penaltyPoints: 2, warningCounted: true },
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
      minor:     { sanction: 'reprimand', timePenaltySeconds: 0, penaltyPoints: 0, warningCounted: true },
      serious:   { sanction: '5s',         timePenaltySeconds: 5, penaltyPoints: 1, warningCounted: true },
      major:     { sanction: '5s',         timePenaltySeconds: 5, penaltyPoints: 1, warningCounted: true },
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

The matrix is sourced verbatim from the doc's quick-reference table (§10) and is the single tunable surface — no engine code references magic numbers.

### 5.3 `src/engine/drivers/penalty-points.ts` (new)

```ts
export function expirePenaltyPoints(
  entries: PenaltyPointEntry[],
  currentSeason: number,
  currentRound: number,
  windowRounds: number = 22,
): PenaltyPointEntry[]

export function sumActivePoints(entries: PenaltyPointEntry[]): number

export function wipeContributingPoints(
  entries: PenaltyPointEntry[],
  threshold: number = 12,
): PenaltyPointEntry[]
```

**`expirePenaltyPoints`:** removes entries where `(currentSeason - issuedSeason) * 22 + (currentRound - issuedRound) >= windowRounds`.

**`wipeContributingPoints`:** sorts entries newest-first; accumulates from the most recent until cumulative sum >= threshold; removes those entries; returns the remainder. Older entries that were already inactive when the threshold crossed are preserved (they will expire on their own schedule).

### 5.4 Race Simulator Integration ([src/engine/race/race-simulator.ts](../../src/engine/race/race-simulator.ts))

#### 5.4.1 `SimRaceState` Additions (worker-side, transient)

```ts
export interface SimRaceState {
  // ...existing...
  pendingInvestigations: PendingInvestigation[]   // NEW
  pendingTimePenalties: Record<string, number>    // NEW — driverId → seconds awaiting service
  appliedPenaltiesByDriver: Record<string, AppliedPenalty[]>   // NEW — accumulator for raceEnd
}
```

All three are session-only. They live in the worker and never reach `world`. The contract in [docs/architecture/persistence-contract.md](../architecture/persistence-contract.md) — race state is not persisted — already covers them.

#### 5.4.2 Call-site Edits in `simulateLap`

1. **At the very start of `simulateLap`**: call `resolveInvestigations(state.pendingInvestigations, state.currentLap)`. For each resolved entry, call `selectSanction`, write `state.pendingTimePenalties[driverId] += sanction.timePenaltySeconds`, append the `AppliedPenalty` to `state.appliedPenaltiesByDriver[driverId]`, and push a `'penalty-issued'` incident. Update `state.pendingInvestigations` to the `stillPending` list.

2. **Inside the per-driver lap-time loop, in the pit branch** (currently around lines 150–186 of [race-simulator.ts](../../src/engine/race/race-simulator.ts)): after the existing `lapTime += pitLoss.meanLossSeconds + scatter`, add `lapTime += state.pendingTimePenalties[driverId] ?? 0` and zero the entry.

3. **After the contested-overtake gate decides** (currently around lines 240–263): regardless of whether the swap was allowed, build a `ContestedEventInput`, call `evaluateContestedEvent`, and if `decision !== null`, call `openInvestigation` and push the `'investigation-opened'` incident.

#### 5.4.3 Call-site Edits in `simulateRace`

After the final-lap loop completes (currently around lines 344–361), iterate `state.pendingTimePenalties` and add any non-zero entries to `state.cumulativeTimes`. Re-sort `state.positions` by cumulative time. Use the resorted `state.positions` as `finalPositions`. Emit any remaining items in `state.appliedPenaltiesByDriver` to the worker's `'raceEnd'` payload (each driver's `RaceResult` carries its own `appliedPenalties` array).

#### 5.4.4 Determinism

All randomness — fault evaluation, severity selection within a band, investigation window length, sanction selection — routes through the existing seeded `rng`. A determinism replay test (see §7) runs a seeded race with calibration tuned to force at least one penalty and asserts byte-identical incident streams and final positions across two runs.

### 5.5 `processPostRace` Wiring ([src/engine/core/post-race-processor.ts](../../src/engine/core/post-race-processor.ts))

Extend step 1 (driver season stats update) to fold each result's `appliedPenalties`:

```
for each appliedPenalty in result.appliedPenalties:
  if appliedPenalty.penaltyPointsIssued > 0:
    driver.penaltyPoints.push({
      points: appliedPenalty.penaltyPointsIssued,
      issuedSeason: currentSeason,
      issuedRound: currentRound,
      offenceType: appliedPenalty.offenceType,
      raceId: <derived from currentRound>,
    })
  if appliedPenalty.warningCounted:
    driver.warningsThisSeason += 1
  driver.seasonStats.penalties += 1

driver.penaltyPoints = expirePenaltyPoints(driver.penaltyPoints, currentSeason, currentRound)

if sumActivePoints(driver.penaltyPoints) >= calibration.banThreshold:
  driver.banUntilRound = currentRound + 1
  driver.penaltyPoints = wipeContributingPoints(driver.penaltyPoints, calibration.banThreshold)

if driver.warningsThisSeason >= calibration.warningThreshold:
  driver.nextRaceGridDrop = max(driver.nextRaceGridDrop, calibration.warningGridDrop)
  driver.warningsThisSeason = 0
```

Add a separate ban-clear step at the **start** of `processPostRace`: for any driver where `banUntilRound === currentRound`, set `banUntilRound = null` (the ban has now been served — they DNS'd this race, which `race-bootstrap` enforced).

The existing `lastProcessedRound` idempotency guard automatically protects against double-application of penalties on re-fire.

### 5.6 Race-Bootstrap Substitution ([src/engine/race/race-bootstrap.ts](../../src/engine/race/race-bootstrap.ts))

Before grid-order is set, inspect each driver in the lineup:

```
for driver in lineup:
  if driver.banUntilRound !== null && currentRound <= driver.banUntilRound:
    substitute = team.reserveDriverId
              ?? firstDriver({ teamId: driver.teamId, isReserve: true })
              ?? null
    if substitute:
      replace driver in bootstrap input with substitute
      mark substitute.gridFromBan = true (for UI commentary)
    else:
      drop driver from bootstrap input (team races with one car)
```

After qualifying produces a positions list, apply `nextRaceGridDrop`:

```
for driver in qualifiedOrder:
  driver.gridPosition += driver.nextRaceGridDrop
  driver.nextRaceGridDrop = 0
re-sort gridOrder by gridPosition; clamp final positions to [1, gridSize]
```

If the qualifying flow's exact integration point is unclear during implementation, this becomes a thin adapter step inside `race-bootstrap.ts` that takes the qualifying-ordered grid and shuffles drivers down before producing the final `gridOrder`. See §10 — open implementation question (D.4.a).

## 6. Persistence

### 6.1 Type Additions ([src/types/driver.ts](../../src/types/driver.ts))

```ts
export interface PenaltyPointEntry {
  points: number              // 1, 2, 3, or 4
  issuedSeason: number
  issuedRound: number
  offenceType: OffenceType
  raceId: string
}

export interface Driver {
  // ...existing fields...
  penaltyPoints: PenaltyPointEntry[]    // NEW — rolling 22-round window
  warningsThisSeason: number             // NEW — resets at season end + on threshold consumption
  nextRaceGridDrop: number               // NEW — one-shot, consumed by qualifying, default 0
  banUntilRound: number | null          // NEW — set when 12 points crossed; cleared when round served
}
```

`SeasonStats.penalties` already exists in the codebase but is currently never incremented. It gets wired up in `processPostRace`.

### 6.2 Schema Migration v7 → v8

In [src/engine/core/save-system.ts](../../src/engine/core/save-system.ts):

```ts
const SCHEMA_VERSION = 8

const MIGRATIONS = {
  // ...existing v4→v5, v5→v6, v6→v7...
  '7→8': (state: any) => ({
    ...state,
    drivers: state.drivers.map((d: any) => ({
      ...d,
      penaltyPoints: [],
      warningsThisSeason: 0,
      nextRaceGridDrop: 0,
      banUntilRound: null,
    })),
  }),
}
```

A v7 save loaded under v8 receives empty arrays / 0 / null for the new fields — equivalent to a clean career so far. The migration is idempotent and safe to re-run.

### 6.3 Persistence Contract Update

[docs/architecture/persistence-contract.md](../architecture/persistence-contract.md) §1 gains four new persisted fields under `Driver`:

- `Driver.penaltyPoints: PenaltyPointEntry[]` — persisted; rolling 22-round window of issued penalty points.
- `Driver.warningsThisSeason: number` — persisted; season counter; resets at season end and on threshold consumption.
- `Driver.nextRaceGridDrop: number` — persisted; one-shot grid drop consumed by qualifying.
- `Driver.banUntilRound: number | null` — persisted; null when not banned.

The transient race-side state — `pendingInvestigations`, `pendingTimePenalties`, `appliedPenaltiesByDriver` — lives **inside the worker's `SimRaceState`** and is not persisted. This keeps IP-04 Option A intact: race-side state stays out of `world`.

`AppliedPenalty[]` on `RaceResult` is part of the transient `lastRaceResults` slice, which is also explicitly not persisted per the contract.

## 7. Surfacing

### 7.1 During the Race (Worker → Main Thread → UI)

Per the project's UI rules: **toasts are suppressed during the race phase**. Critical events surface as commentary entries with `severity: 'critical'` plus a screen-edge flash, plus a dedicated panel.

**Commentary feed entries:**

- `'investigation-opened'` → `INVESTIGATION: ${driverShortName} — ${offenceLabel} (decision lap ${decideOnLap})` with `severity: 'critical'`.
- `'penalty-issued'` → `PENALTY: ${driverShortName} — ${sanctionLabel} + ${penaltyPoints}pt` with `severity: 'critical'`.
- `'investigation-closed'` (no penalty) → `NO FURTHER ACTION: ${driverShortName}` with `severity: 'highlight'`.

**Stewards card (new component, race UI):**

A small persistent card showing currently-pending investigations: driver short name, offence type, lap detected, and "Decision lap X" countdown. Closes when the matching `'penalty-issued'` or `'investigation-closed'` event arrives.

**Existing race-incident channel** routes the new sub-types unchanged — no new worker-protocol top-level messages, no new store fields. The UI selector that already reads from the incident list (used by the existing commentary feed) automatically handles them after the discriminator union is updated.

### 7.2 Post-Race

**Stewards' Decisions panel** (new section in the post-race results view):

- Tabular list of all penalties applied that race: driver, offence, sanction, time-penalty seconds, penalty points issued.
- Per-driver penalty-point totals after this race, with breakdown by entry (issued round, expiry round).
- Banner if any driver crossed 12 points (next-race ban triggered) or 5 warnings (10-place grid drop triggered for the next race).

### 7.3 Driver Office (Between Races)

**Penalty Record section** on the Driver detail view:

- Current rolling-window total (sum of active penalty points).
- Per-entry list with issued round and expiry round.
- Season warnings counter and what threshold (5) triggers.
- Ban status if `banUntilRound !== null`, with countdown.
- Visual indicator of risk: 0–4 points = green, 5–8 = amber, 9–11 = red, 12+ = banned.

### 7.4 Aesthetic Compliance

All new UI components follow the **Kinetic Command** design system (or Broadcast theme on routes already migrated): dark surfaces, lime/cyan accents, glassmorphic panels, no `transition-all`, animation only on `transform` and `opacity`, focus-visible states on every interactive element. The Stewards card during race uses critical-tier red accent (`--state-critical`, already in tokens) for active investigations.

## 8. Testing Strategy

### 8.1 Unit Tests

**`tests/engine/race/penalty-engine.test.ts` (new)**
- Table-driven tests of `evaluateContestedEvent` covering each fault factor in isolation (aggression, optimism, frustration, tire mismatch, circuit difficulty, experience protection).
- Boundary tests on the fault-threshold and severity-band edges.
- Decision rule: attacker-blame, defender-blame, no-fault cases.
- `selectSanction`: every `(offenceType, severity)` cell produces the documented sanction.
- `openInvestigation`: PRNG seeding determinism, off-by-one boundary on `decideOnLap`, clamping at `totalLaps`.
- `resolveInvestigations`: partition correctness across the resolved/stillPending split.

**`tests/engine/drivers/penalty-points.test.ts` (new)**
- `expirePenaltyPoints`: entries older than 22 rounds drop off; entries within window remain; cross-season expiry (entry from `(N, 20)` expires in `(N+1, 20)` — round delta 22, not 1).
- `sumActivePoints`: ignores expired entries; sums correctly across mixed-age entries.
- `wipeContributingPoints`: newest-first accumulation; older entries preserved; ties handled deterministically.

### 8.2 Integration Tests

**`tests/engine/race/race-simulator.test.ts` (extend)**
- Determinism replay: seeded race with calibration tuned to force at least one penalty produces byte-identical incident streams and final positions across two runs.
- Pit-loss integration: a driver with `pendingTimePenalty = 5` who pits has lap time exactly 5 seconds higher than a same-state driver without the pending penalty, same seed, same compound, same wear.
- Race-end fold: a driver with no remaining pit stops and a `pendingTimePenalty = 10` finishes 10s further behind than they would without the penalty; final position re-sort verified.

**`tests/engine/core/post-race-processor.test.ts` (extend)**
- `appliedPenalties` flow: each entry properly increments `seasonStats.penalties`, pushes a `PenaltyPointEntry`, increments `warningsThisSeason`, sets `nextRaceGridDrop` on the 5-warning threshold cross.
- Ban threshold: 12 points crossing sets `banUntilRound = currentRound + 1` and wipes contributing entries.
- Ban clear: a driver with `banUntilRound === currentRound` has it cleared at start of `processPostRace`.
- Idempotency: the existing `lastProcessedRound` guard prevents double-application of penalties on re-fire.

**`tests/engine/race/race-bootstrap.test.ts` (extend)**
- Banned-driver substitution: a driver with `banUntilRound >= currentRound` is replaced by `team.reserveDriverId` if present.
- Reserve fallback: with `team.reserveDriverId` null but a matching `Driver.isReserve === true` available, the matching driver substitutes.
- No-reserve degradation: with neither, the team's bootstrap input has only one driver.
- Grid-drop application: a driver who qualified P3 with `nextRaceGridDrop = 10` starts P13; `nextRaceGridDrop` zeroed after consumption.
- Multiple grid drops: positions clamp to `[1, gridSize]`.

### 8.3 Persistence Tests

**`tests/engine/core/save-system.test.ts` (extend)**
- v7 → v8 migration: load a v7 fixture, run `migrateToCurrent`, assert all four new driver fields populated with defaults (empty array / 0 / null), `SCHEMA_VERSION` updated, payload re-written at v8.
- Round-trip: save a v8 state with non-trivial penalty entries, reload, assert structural equality.
- Migration idempotency: running `migrateToCurrent` twice produces identical output.

### 8.4 Store / Adapter Tests

**`tests/stores/race-slice.test.ts` (extend)**
- Worker incident routing: `'investigation-opened'`, `'penalty-issued'`, `'investigation-closed'` incidents land in the race incident list and surface through the store selector.
- Race-end handoff: `RaceResult.appliedPenalties` flows through `submitRaceResults` and reaches `processPostRace` with shape preserved.

### 8.5 Coverage and Quality Gates

- TypeScript strict-mode clean (`npx tsc --noEmit`).
- Full test suite green (`npx vitest run`).
- ESLint clean (`npm run lint`).
- Determinism replay test is a **hard gate** — must pass before any handoff.
- No `// @ts-ignore` or `as any` introduced to make tests green.
- Coverage target: 80%+ on all new modules under `src/engine/race/penalty-engine.ts`, `src/engine/drivers/penalty-points.ts`, `src/data/penalty-calibration.ts`.

## 9. Pipeline & Agent Routing

This feature is a **Pipeline E + Pipeline A hybrid** per [AGENTS.md](../../AGENTS.md):

### 9.1 `sim-engine`

- Adds `RaceIncident` discriminator types + `AppliedPenalty` to [src/types/race.ts](../../src/types/race.ts).
- Adds `PenaltyPointEntry` and four new fields to `Driver` in [src/types/driver.ts](../../src/types/driver.ts).
- Implements `penalty-engine.ts`, `penalty-points.ts`, `penalty-calibration.ts`.
- Integrates the engine into `race-simulator.ts` (3 call-site edits + cumulative-time fold at race end).
- Integrates the post-race wiring into `post-race-processor.ts`.
- Increments `SCHEMA_VERSION` to 8 and adds the migration in `save-system.ts`.
- Updates [docs/architecture/persistence-contract.md](../architecture/persistence-contract.md) and [docs/architecture/current-state-baseline.md](../architecture/current-state-baseline.md).
- Invokes `superpowers:test-driven-development` per module — engine tests written before implementation.
- Invokes `everything-claude-code:typescript-reviewer` after the worker-protocol type changes.
- Invokes `superpowers:verification-before-completion` before handoff.
- Runs `npx tsc --noEmit` and `npx vitest run tests/engine tests/data`.

### 9.2 `game-state`

- Worker adapter forwards new `RaceIncident` sub-types unchanged through the existing `incident` channel.
- `race-bootstrap.ts` consumes `Driver.banUntilRound` to substitute banned drivers; consumes `Driver.nextRaceGridDrop` after qualifying.
- `submitRaceResults` carries `RaceResult.appliedPenalties` from worker to `processPostRace`.
- Runs `npx tsc --noEmit` and `npx vitest run tests/stores tests/hooks`.

### 9.3 `ui-interface`

- Stewards card (new component) on the race UI.
- Stewards' Decisions panel (new section) on the post-race results view.
- Penalty Record section (new component) on the Driver Office detail view.
- Invokes `superpowers:brainstorm` before each new component (Kinetic Command aesthetic compliance).
- Confirms HTTP 200 on the race route after each component lands.
- Invokes `simplify` before handoff.

### 9.4 `verify`

- Full suite: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`.
- Determinism replay test verified.
- Invokes the `code-reviewer` agent for structured review.
- Surfaces CRITICAL/HIGH findings via `superpowers:receiving-code-review`.

## 10. Open Implementation Questions

These are deliberately unresolved at the design layer and will be resolved during the writing-plans phase by code reading:

- **(D.4.a)** Where exactly does the existing qualifying flow set `gridOrder` for the race-worker bootstrap? §5.6 assumed a thin adapter step in `race-bootstrap.ts`; to be confirmed.
- **(D.4.b)** Does `team.reserveDriverId` exist on the current `Team` type, or is reserve lookup done purely through `Driver.isReserve` filtering? To be confirmed by reading [src/types/team.ts](../../src/types/team.ts). The substitution logic in §5.6 already handles both shapes via the `??` chain — only the type signatures on the bootstrap input need to match reality.
- **(D.4.c)** Does the existing `submitRaceResults` codepath (referenced in [src/engine/core/post-race-processor.ts:60](../../src/engine/core/post-race-processor.ts#L60)) already carry per-driver event metadata that `appliedPenalties` can ride on, or do we need a new field on the cross-thread `RaceResult` shape? The shape of any existing per-driver event accumulator should be reused if present.

## 11. Future Work (Tier B and Tier C Brainstorm Triggers)

When the user is ready, the following two brainstorms will build on this v1 foundation:

- **Tier B v2** — Pit-stop-adjacent offences (unsafe release, pit-lane speeding). Requires a pit-lane sub-state model (release timing window, speed governor against limit). The 3-lap window enforcement for drive-through and stop-and-go also lives in this scope.
- **Tier C v3** — Track-state-adjacent offences (track limits "3 strikes," yellow/red flag breaches, safety-car overtakes). Requires sector-level corner-exit detection and a per-driver flag system (today's `safetyCar: 'green' | 'vsc' | 'sc'` is global only).

Both v2 and v3 register additional offence detectors against the engine and infrastructure shipped in v1. No further schema migrations or worker-protocol changes are anticipated — only new entries in `OffenceType`, `SanctionType` (already covers everything needed), and the `sanctionMatrix`.

---

## Sources

- [docs/architecture/f1_penalty_system_technical.md](../architecture/f1_penalty_system_technical.md) — F1 Rules and Penalty System Technical Reference (compiled April 2026 from 2025 FIA documents)
- [AGENTS.md](../../AGENTS.md) — Pipeline routing and agent-permission rules
- [docs/architecture/persistence-contract.md](../architecture/persistence-contract.md) — Persisted vs transient field policy
- [docs/architecture/current-state-baseline.md](../architecture/current-state-baseline.md) — IP-phase status (penalty system would be IP-09)
- Project memory: [Factory Penalties Taken — pending](../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_factory_penalties_todo.md) (separate workstream — out of scope)
