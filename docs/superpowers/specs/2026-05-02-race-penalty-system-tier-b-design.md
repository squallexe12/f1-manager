# Race Penalty System — Tier B v2 Design Spec

**Date:** 2026-05-02
**Workstream:** Pit-stop-adjacent in-race penalty enforcement (Tier B, v2) + active pit-crew investment system
**Scope:** Detection and adjudication of unsafe release, pit-lane speeding, and failure-to-serve (3-lap window) offences during a simulated race, modelled by a deterministic per-driver pit-lane finite-state machine with a 3-zone speed model, and the surrounding active-investment gameplay layer (pit-crew chief + members, procgen talent pool, fixed-salary contracts forward-compatible with future negotiation).
**Source reference:** [docs/architecture/f1_penalty_system_technical.md](../../architecture/f1_penalty_system_technical.md)
**Brainstorm decisions:** [project_penalty_tier_b_brainstorm_paused.md](../../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_penalty_tier_b_brainstorm_paused.md) (resumed 2026-05-02 — Q1=C, Q2=A, Q1.5=in, Q3=B, Q4=B, Q4.5=3 zones, Q5=C, Q6=B, Q7=B, Q8=A→B-ready)

---

## 1. Purpose

Tier A v1 (shipped 2026-04-25, fully closed 2026-05-02) gave the race simulator a stewards' apparatus for overtake-adjacent driving offences: collision, forcing-off, illegal defending. The pit lane stayed entirely outside that net. Today a pit stop in [src/engine/race/race-simulator.ts](../../src/engine/race/race-simulator.ts) is one atomic event — `lapTime += pitLoss.meanLossSeconds + scatter + pendingTimePenalty` followed by a tire swap — with no notion of "the car was released into another car's path" or "the driver exceeded the 80 km/h pit-lane limit."

Real F1 produces ~1–2 unsafe releases and ~3–5 pit-lane speeding incidents per season. These are rare-but-pivotal events: the 2018 Brazil GP unsafe-release Bottas / Ocon incident is the canonical reference. They also create a meaningful gameplay surface — the player can invest in pit-crew quality the same way they invest in chassis or power-unit R&D, and the consequences (or lack thereof) are visible in race outcomes.

This spec defines **Tier B v2** of the in-race penalty engine: a deterministic per-driver pit-lane FSM with three zones (entry-decel, limit-zone, exit-accel), a sub-step time model that runs only when ≥1 car occupies the pit lane on a given lap (lazy sub-stepping, no architectural rewrite of the lap-based main loop), and three new offence types (`unsafe-release`, `pit-lane-speeding`, `failure-to-serve`) wired into the same `'investigation-opened'` → `'penalty-issued'` channel Tier A established. It also defines the active-investment system: a pit-crew chief plus a 6-member crew, all with individual ratings drawn from a procgen talent pool, hireable via Factory-page surfaces, costed against the existing budget cap, with salary-only contracts shaped so a future cycle can graduate them to full driver-style negotiation without a schema break.

The system runs deterministically inside the existing seeded race simulator, integrates cleanly into the worker protocol via four additive event types, persists through a single schema migration, and surfaces in the existing race UI / post-race / Factory surfaces without introducing new top-level routes.

## 2. Non-Goals

- **No track-state-adjacent offences** (track limits, yellow/red flag breaches, safety-car overtakes) — deferred to Tier C v3 brainstorm.
- **No general staff system** beyond pit crew. Race engineers, head of aero, sporting director, etc. — out of scope. The schema for `team.pitCrewChief` and `team.pitCrewMembers[]` is intentionally pit-crew-specific, not a polymorphic staff registry. (The brainstorm explicitly rejected Q6-C for this reason.)
- **No driver-style contract negotiation in v2.** Salary is fixed at hire time, derived from attribute rating. Contract field uses the same `Contract` shape as drivers but populates only `salary` and `termEndSeason`; `performanceBonuses` and `releaseClause` slots stay empty. A future Tier B+ cycle activates them — additive, non-breaking.
- **No retirement / aging arcs for staff in v2.** Staff don't age out. Pool refresh between seasons is procgen replacement of free-agent slots, not "Chief X retired." Aging can be added later as a per-staff `age` field + per-season decrement.
- **No per-corner braking / speed model on the main race line.** The 3-zone speed model is pit-lane-only. The main lap simulation stays in lap-time deltas. (Q2 explicitly rejected the always-on sub-stepping option.)
- **No real F1 staff names.** Talent pool is fully procgen, deterministic by world seed. (Q7-A explicitly rejected.)
- **No pit-crew morale / fatigue model.** Members have static attributes per season. Morale lives at team level only.
- **No multi-team pit-box conflict.** Each team has one box; only same-circuit cross-team release-into-path is modelled. Two cars from the same team trying to use the same box — physically impossible in F1 (only one set of mechanics) and mechanically out of scope here.
- **No mid-race staff substitution.** If a member's attributes "would have caused" an unsafe release, the consequence fires; the member is not replaced mid-race.
- **No sponsor KPI integration in v2.** Pit-crew quality doesn't gate sponsor bonus payouts. (Possible Tier B+ extension.)

## 3. Success Criteria

- Every pit-stop event in [src/engine/race/race-simulator.ts](../../src/engine/race/race-simulator.ts) routes through the new pit-lane sub-simulation when at least one car enters the lane on that lap.
- The full pit-lane loop fires deterministically end-to-end: pit-entry → entry-decel zone → limit-zone (service window) → release decision → exit-accel zone → pit-exit, with two new fault rolls (`evaluateUnsafeRelease`, `evaluatePitLaneSpeeding`) hooked into the existing `'investigation-opened'` channel.
- A seeded race produces byte-identical pit-lane incident streams across two runs (determinism gate, hard requirement, same as Tier A).
- A drive-through or stop-go penalty issued on lap *N* must be served by lap *N+3* (inclusive) or the affected driver is converted to DNF with `penalty-issued` incident sub-type `failure-to-serve`.
- The player can hire and fire a pit-crew chief plus up to 6 members from a procgen talent pool, with salaries deducted from the existing budget-cap categories, persisted across save / reload through the schema bump.
- Pit-crew sub-attributes (`release` / `speedDiscipline` / `serviceTime`) computed from the chief + members feed the engine's fault-roll inputs, so investing in better staff measurably reduces investigated events across a seeded full-season replay.
- Real-F1 frequency calibration: ~1.5 unsafe releases per season, ~4 pit-lane speeding incidents per season, ~0.1 failure-to-serve per season (rare; mostly happens when a car DNFs before the deadline, which is also a `failure-to-serve` per spec). Measured across a seeded full-season replay with neutral-rated (70/70/70) staff.
- `npx tsc --noEmit`, `npx vitest run`, and `npm run lint` pass green at each pipeline step.
- All new persisted fields documented in [docs/architecture/persistence-contract.md](../../architecture/persistence-contract.md).

## 4. Architecture

### 4.1 Module Layout

```
src/engine/race/
├── pit-lane-engine.ts          # NEW — pure: simulatePitLane (sub-step loop), advancePitLaneFsm, evaluateUnsafeRelease, evaluatePitLaneSpeeding
├── pit-lane-fsm.ts             # NEW — pure: PitLaneState type, PitLaneZone enum, transition table
├── penalty-engine.ts           # MODIFIED — new offence-type sanction matrix entries; openInvestigation reused unchanged
├── race-simulator.ts           # MODIFIED — pit branch dispatches to simulatePitLane; collects emitted investigations into `incidents`
├── failure-to-serve.ts         # NEW — pure: registerSanctionDeadline, checkFailureToServe (per-lap predicate)
└── race-worker-adapter.ts      # MODIFIED — forwards 4 new event types from worker to store

src/engine/staff/
├── pit-crew.ts                 # NEW — pure: aggregateCrewRatings(chief, members) → { release, speedDiscipline, serviceTime }
├── talent-pool.ts              # NEW — pure: generateTalentPool(seed, season) → free-agent list
├── hiring.ts                   # NEW — pure: hireStaff, fireStaff, processPoachingAttempt
└── procgen-names.ts            # NEW — pure: deterministic name + nationality + age generators

src/engine/core/
├── orchestrator.ts             # MODIFIED — new step in management phase: runStaffMarket (poaching alerts, retirements)
├── post-race-processor.ts      # MODIFIED — folds new `unsafe-release` / `pit-lane-speeding` / `failure-to-serve` AppliedPenalty entries into season stats
└── save-system.ts              # MODIFIED — SCHEMA_VERSION 11→12, MIGRATIONS['11→12']

src/data/
├── penalty-calibration.ts      # MODIFIED — sanctionMatrix gains 3 new offence rows; new field unsafeReleaseFaultThreshold + pitLaneSpeedingFaultThreshold + failureToServeWindowLaps
├── pit-lane-circuits.ts        # NEW — per-circuit { lengthMeters, speedLimitKph, entryDecelMeters, exitAccelMeters }
└── staff-distributions.ts      # NEW — procgen sampling distributions for chief / member attributes by tier

src/types/
├── race.ts                     # MODIFIED — OffenceType += 'unsafe-release' | 'pit-lane-speeding' | 'failure-to-serve'; new RaceIncident discriminated-union variants
├── team.ts                     # MODIFIED — Team += pitCrewChief: PitCrewChief | null; pitCrewMembers: PitCrewMember[]
├── staff.ts                    # NEW — PitCrewChief, PitCrewMember, StaffContract, FreeAgent, PoachingAttempt
└── calibration.ts              # MODIFIED — CalibrationProfile += pitLane: PitLaneCalibration

src/components/factory/
├── pit-crew-card.tsx           # NEW — Factory-page card: chief + members, hire/fire actions, attribute readouts
├── pit-crew-roster.tsx         # NEW — table of 6 member roles with ratings + salaries
└── staff-market-modal.tsx      # NEW — opens from pit-crew-card; shows free-agent list, hire confirmation

src/components/strategy/
└── stewards-card.tsx           # MODIFIED — recognises new offence types in the offence-label map

src/workers/
└── race-sim-worker.ts          # MODIFIED — pit-stop branch dispatches sub-step loop; emits new pit-lane events
```

### 4.2 Top-level Flow

```
                        ┌─── per-lap main loop ───┐
                        │                         │
race-simulator   ───────┤   any car has command   │── yes ──> simulatePitLane(state, rng)
   pit branch           │      === 'pit'?         │              │
                        │                         │              │
                        └─── no ───> standard ────┘              ▼
                                     lap-time path        ┌─────────────────────┐
                                                          │  3-zone sub-step    │
                                                          │  loop in seconds    │
                                                          │  for this lap only  │
                                                          │                     │
                                                          │  per car in lane:   │
                                                          │   entry-decel       │
                                                          │   limit-zone        │
                                                          │   exit-accel        │
                                                          │                     │
                                                          │  per release:       │
                                                          │   evaluateUnsafe-   │
                                                          │   Release(...)      │
                                                          │                     │
                                                          │  per zone-cross:    │
                                                          │   evaluatePit-      │
                                                          │   LaneSpeeding(...) │
                                                          └────────┬────────────┘
                                                                   │
                                                       ┌───────────┴───────────┐
                                                       │  decision !== null    │
                                                       │   ↓                   │
                                                       │  openInvestigation()  │  ← reused from Tier A
                                                       │   ↓                   │
                                                       │  push 'investigation- │
                                                       │   opened' incident    │
                                                       └───────────────────────┘
```

The pit branch in `race-simulator.ts` already consumes `pitLoss.meanLossSeconds + scatter` to advance lap time. After this spec, the same branch *first* calls `simulatePitLane(state, rng, lap)` which runs the 3-zone sub-step and returns:
- `serviceTimeSeconds` (per car) — replaces the static `pitLoss.meanLossSeconds`, now derived from `serviceTime` sub-attribute + scatter
- `incidents[]` — `'investigation-opened'` events from unsafe-release / pit-lane-speeding fault rolls
- `tireStateUpdates` — same tire swap as before, but timing is now deterministic per car

The main loop then accumulates `serviceTimeSeconds` into `cumulativeTimes[driverId]` and pushes `incidents` into the per-lap incident stream. Existing investigation-resolve / sanction-select machinery (Tier A) handles the rest.

### 4.3 Data Flow — Sub-step Time Model

The pit-lane sub-step runs in seconds, the main loop runs in laps. The sub-step is *self-contained*: it accepts a snapshot of `SimRaceState` plus the current lap, computes everything it needs, and returns a flat list of effects. The sub-step never mutates main-loop state directly.

Sub-step time origin: `t = 0` at the moment the lap begins. Cars enter the pit lane at offsets determined by their position in the field at that lap's start. The lane is modelled as one shared deterministic timeline; cross-team interference (two cars in the lane simultaneously) emerges from the timeline geometry, not from explicit synchronization primitives.

Sub-step termination: when all cars that entered have exited (`PitLaneZone.exited`).

## 5. Sub-systems

### 5.1 Pit-lane FSM

```typescript
export type PitLaneZone =
  | 'pre-entry'      // not yet entered the lane
  | 'entry-decel'    // crossed lane-entry line, decelerating to limit
  | 'limit-zone'     // at speed limit, transit + service overlap here
  | 'exit-accel'     // released, accelerating back to race speed
  | 'exited'         // crossed lane-exit line, back on the racing surface

export interface PitLaneCarState {
  driverId: string
  zone: PitLaneZone
  enteredAtSeconds: number
  zoneEnteredAtSeconds: number
  speedKph: number
  positionMeters: number      // 0 at lane entry, lengthMeters at lane exit
  serviceStartSeconds: number | null
  serviceEndSeconds: number | null
  releasedAtSeconds: number | null
}
```

Transitions are deterministic: a car advances `pre-entry → entry-decel → limit-zone → exit-accel → exited` in order, with timing driven by:
- `entry-decel` duration: `(carEntrySpeedKph - speedLimitKph) / decelRateMpsps × 3.6` seconds, where `decelRateMpsps` is a per-car rate derived from `car.braking` and pit-crew `serviceTime` (better crews coordinate cleaner approach).
- `limit-zone` duration: `serviceTimeSeconds(crew) + (transitMeters / speedLimitKph) × 3.6`. Service starts on arrival at the box; release happens at `serviceStartSeconds + serviceDurationSeconds`. Departure from the limit zone happens at `releasedAtSeconds + (boxToExitMeters / speedLimitKph) × 3.6`.
- `exit-accel` duration: symmetric to entry-decel, using `accelRateMpsps`.

### 5.2 Three-Zone Speed Model

Speed is constant within a zone, sampled stochastically with a small noise term:
- `entry-decel`: starts at `carEntrySpeedKph` (≈220 km/h race entry), linearly drops to `speedLimitKph` over the entry-decel meters.
- `limit-zone`: nominally `speedLimitKph` (e.g. 80 km/h). Driver's `speedDiscipline` sub-attribute (0–100) modulates how tightly the simulated speed sits at the limit. A low-discipline driver may sample slightly above the limit; high-discipline always under.
- `exit-accel`: linearly climbs from `speedLimitKph` to `carExitSpeedKph` over the exit-accel meters.

A speeding event fires when the sampled speed in any sub-step tick exceeds `speedLimitKph + 0.5` (FIA tolerance). This is the deterministic detection — no probabilistic roll. Calibration tuning lives in how often the sample drifts above the limit, governed by `speedDiscipline`.

### 5.3 Sub-step PRNG Branching

Determinism requires the sub-step PRNG ordering to be stable. The rule:
1. Sub-step PRNG is *the same* PRNG instance as the main loop. No fork.
2. Per-lap, the sub-step consumes PRNG values in a fixed order: for each car entering the lane (sorted ascending by `pre-entry` driver-id, NOT by entry order), consume in this fixed sequence: `entryDecelNoise → serviceTimeNoise → speedLimitDriftSamples (one per limit-zone tick) → releaseTimingNoise → exitAccelNoise`.
3. Cars that don't enter the lane on this lap consume zero PRNG.

This means a seeded race always burns PRNG values at the same offsets regardless of which car physically reaches the box first, because we sort by id (a stable property), not by sub-step time. Replays remain byte-identical.

### 5.4 Unsafe-Release Detection

```typescript
export interface UnsafeReleaseInput {
  releasedCar: PitLaneCarState
  potentiallyConflictingCars: PitLaneCarState[]  // cars in entry-decel or limit-zone at release moment
  releasedCrewRelease: number   // 0-100
  releasedDriverRacecraft: number
  conflictingDistanceMeters: number   // the closest conflicting car's distance behind release point
  calibration: PenaltyCalibration
}

export interface UnsafeReleaseEvaluation {
  fault: number                  // 0-1
  decision: null | { driverId: string; severity: SeverityTier; offenceType: 'unsafe-release' }
}
```

A release is unsafe when the closest car in the lane behind the release point would collide if both held current speeds — quantified as `timeToReachReleasePoint < safetyMarginSeconds` (default 0.5s, tunable). The `release` sub-attribute (0–100) modulates the lollipop-man / chief decision: low-rated crews release into shorter gaps; high-rated crews wait.

Fault formula (mirrors Tier A's `evaluateContestedEvent` shape):
```
fault = clamp01(
    (timeToReachSeconds < safetyMargin ? (safetyMargin - timeToReachSeconds) / safetyMargin : 0)
  + (100 - releasedCrewRelease) / 200
  + (100 - releasedDriverRacecraft) / 400        // small driver assist; release is mostly the crew
)
```

`fault >= calibration.unsafeReleaseFaultThreshold` (default 0.45, matches Tier A's general threshold) → decision = unsafe-release blamed on the *released* car's driver (FIA convention).

### 5.5 Pit-lane-Speeding Detection

```typescript
export interface PitLaneSpeedingInput {
  carState: PitLaneCarState
  zone: PitLaneZone   // must be 'limit-zone'
  sampledSpeedKph: number
  speedLimitKph: number
  speedDiscipline: number   // 0-100
  driverExperience: number
  calibration: PenaltyCalibration
}
```

Detection is binary at the tick: `sampledSpeedKph > speedLimitKph + tolerance` → fire. The probability is shaped *upstream* of detection by `speedDiscipline`:

```
speedDriftStdDev = (100 - speedDiscipline) / 50    // 2.0 km/h at 0 discipline; 0 at 100
sampledSpeed = speedLimitKph - 1 + gaussianSample(rng, 0, speedDriftStdDev)
```

A neutral 70-rated `speedDiscipline` produces stddev ≈ 0.6 km/h with mean = limit − 1 km/h, so a speeding event requires the gaussian to drift ~+1.5 km/h above mean — happens ~1 in ~5 stops, scaled across the team's stops in a season this hits the ~3–5/season target. Calibration knob: shift the `-1` constant if frequency drifts.

Severity always `'minor'` for speeding (real F1 issues drive-through almost universally; severity tier is included for symmetry with the rest of the system).

### 5.6 Three-Lap Window — Failure-to-Serve

When `selectSanction` returns a `'drive-through'` or `'stop-go'`, register a deadline:

```typescript
state.sanctionDeadlines[driverId] = {
  sanction: 'drive-through' | 'stop-go',
  issuedOnLap: currentLap,
  mustServeByLap: currentLap + calibration.failureToServeWindowLaps,   // default 3
}
```

Per lap, in the main loop *after* the pit branch but before the lap-tick:
```typescript
for (const [driverId, deadline] of Object.entries(state.sanctionDeadlines)) {
  if (state.currentLap > deadline.mustServeByLap) {
    incidents.push({
      type: 'penalty-issued',
      driverId,
      sanction: deadline.sanction,
      offenceType: 'failure-to-serve',
      severity: 'egregious',
      // ... + DNF marker
    })
    state.dnf.add(driverId)
    delete state.sanctionDeadlines[driverId]
  }
}
```

Served by: pit branch detects `pendingTimePenalties[driverId]` > 0 *and* the driver is now in the limit-zone of the FSM → mark `state.sanctionDeadlines[driverId]` cleared. The `served` event is implicit in the existing pit-pending-penalty fold.

If a driver DNFs (mechanical, crash, off-track) before serving → fires `failure-to-serve` regardless. Real F1 retroactively wipes the sanction; we keep it on the record because it factors into season-stats penalty counts.

### 5.7 Pit-Crew Sub-attribute Aggregation

Three sub-attributes feed engine inputs:

```typescript
export function aggregateCrewRatings(
  chief: PitCrewChief | null,
  members: PitCrewMember[],
): { release: number; speedDiscipline: number; serviceTime: number } {
  // Defaults when no chief / no members hired yet:
  if (chief === null) {
    return { release: 50, speedDiscipline: 50, serviceTime: 50 }
  }
  // Chief contributes 60% weight to `release`, 40% to `speedDiscipline`,
  // 30% to `serviceTime`. Members contribute the remainder, weighted by
  // role: lollipop dominates `release`, all members contribute equally
  // to `serviceTime`, `speedDiscipline` is mostly chief-driven.
  ...
}
```

Specific weights live in `pit-crew.ts`. Ratings are 0–100 attributes; aggregation produces 0–100 sub-attributes; the engine consumes these as 0–100 inputs into the formulas above.

### 5.8 Pit-Crew Member Roles

```typescript
export type PitCrewRole =
  | 'lollipop'         // dictates release timing — heaviest weight on `release`
  | 'front-jack'       // service time, equal weight
  | 'rear-jack'        // service time, equal weight
  | 'wheel-off-front'  // service time
  | 'wheel-on-front'   // service time
  | 'wheel-off-rear'   // service time
  | 'wheel-on-rear'    // service time
```

Six members per team; lollipop is the named seventh role but in modern F1 the lollipop has been replaced by an automated traffic light. To avoid arguing reality vs. gameplay clarity, we model a "release supervisor" under the role name `lollipop` regardless. Rename if a player-feedback vote prefers `release-supervisor`.

### 5.9 Staff Schema

```typescript
export interface StaffContract {
  salary: number              // per-season, deducted from budget cap
  termEndSeason: number       // expires end of this season
  performanceBonuses: { condition: string; value: number }[]   // empty in v2
  releaseClause: number | null                                 // null in v2
}

export interface PitCrewChief {
  id: string
  firstName: string
  lastName: string
  nationality: string
  age: number
  releaseSupervision: number      // 0-100
  speedDisciplineCoaching: number // 0-100
  serviceCoordination: number     // 0-100
  contract: StaffContract
}

export interface PitCrewMember {
  id: string
  firstName: string
  lastName: string
  nationality: string
  age: number
  role: PitCrewRole
  rating: number   // 0-100, single attribute per member
  contract: StaffContract
}
```

### 5.10 Procgen Talent Pool

```typescript
export function generateTalentPool(
  seed: number,
  season: number,
  poolSize: { chiefs: number; members: number },
): { chiefs: PitCrewChief[]; members: PitCrewMember[] }
```

Deterministic sampling: same `(seed, season)` always produces the same pool. Distributions:
- Chief attributes: gaussian(70, 15) clamped to [30, 99]
- Member ratings: gaussian(65, 18) clamped to [25, 99]
- Salary: linear in attribute level, e.g. chief salary = `200_000 + (avgAttr × 50_000)` (range ~$1.7M – $5.2M for a 30 → 99 chief). Member salary = `50_000 + (rating × 10_000)` (range ~$300k – $1M).

Pool sizes: 30 chiefs, 80 members per season. Player and 10 AI teams together hire ~77 staff; pool surplus of ~33 keeps a meaningful free-agent market visible.

### 5.11 Hiring / Firing / Poaching

- **Hire:** `gameStore.hireStaff(staffId, role)` — moves staff from pool to `team.pitCrewChief` or `team.pitCrewMembers[]`. If the slot is occupied, the existing occupant is auto-fired (severance = 25% of remaining salary). Salary deducted from `Salaries` budget category.
- **Fire:** `gameStore.fireStaff(staffId)` — pays severance, returns staff to free-agent pool with a small attribute decay (-2 to all ratings). Mood penalty to the team.
- **Poaching alerts:** AI teams may target the player's chief or top member at season transitions. The orchestrator's `runStaffMarket` step scans rival teams' attribute gaps; when an AI's pit crew is materially worse than ours and they have budget headroom, it raises a `PoachingAttempt`. The player gets a notification + counter-offer prompt (mirrors the PRD's driver-poaching mechanic).
- **Counter-offer:** Player can match the rival's offered salary. If matched, attempt fizzles. If declined, staff leaves at end of current season.

### 5.12 Worker Protocol Additions

Four new events from worker → main thread, all fold into the existing `RaceWorkerEvent` discriminated union:

```typescript
| { type: 'pitLaneEntry'; lap: number; driverId: string; entrySpeedKph: number }
| { type: 'pitLaneRelease'; lap: number; driverId: string; releaseDelaySeconds: number }
| { type: 'pitLaneExit'; lap: number; driverId: string; totalLaneSeconds: number }
| { type: 'pitLaneSpeedingDetected'; lap: number; driverId: string; sampledSpeedKph: number }
```

These are *informational* — they drive commentary and post-race telemetry. They are NOT the primary penalty channel. Penalty channel stays the existing `'incident'` event with `{ type: 'investigation-opened' | 'penalty-issued' }` payload (Tier A protocol unchanged).

The four new events are scaffolding: the FSM emits them as it transitions zones, the worker forwards them, the main thread renders them as commentary entries. Volume: ~4 events × number of pit stops per race ≈ 80 events for a typical 20-stop race. Cheap.

### 5.13 Persistence

Schema bump 11 → 12. New persisted fields:
- `team.pitCrewChief: PitCrewChief | null` (default `null` for migration)
- `team.pitCrewMembers: PitCrewMember[]` (default `[]` for migration)
- `world.staffMarket: { chiefs: PitCrewChief[]; members: PitCrewMember[]; lastRefreshedSeason: number }` (default empty + `lastRefreshedSeason: 0`)
- `world.poachingAttempts: PoachingAttempt[]` (default `[]`)

Migration `'11→12'`:
- All teams get `pitCrewChief: null`, `pitCrewMembers: []`
- `staffMarket` initialized via `generateTalentPool(world.seed, world.gameState.currentSeason, DEFAULT_POOL_SIZE)`
- `poachingAttempts: []`

Aero/race runtime, transient state, etc. — unchanged. `raceRuntime` stays session-scoped per IP-04.

### 5.14 Calibration

`PenaltyCalibration` gains:
```typescript
export interface PenaltyCalibration {
  // ... existing Tier A fields ...
  unsafeReleaseFaultThreshold: number        // default 0.45
  pitLaneSpeedingMeanOffsetKph: number       // default -1 (mean drift below limit at neutral discipline)
  failureToServeWindowLaps: number           // default 3
}
```

`CalibrationProfile` (per-circuit) gains:
```typescript
export interface PitLaneCalibration {
  lengthMeters: number
  speedLimitKph: number
  entryDecelMeters: number     // typically 30-50
  exitAccelMeters: number      // typically 30-50
}
```

Per-circuit values seeded from FIA technical bulletins. All 24 circuits hand-entered. Limits: 80 km/h universal except where the FIA has explicitly set 60 km/h (handful of circuits). Lane lengths range from ~280m (Monaco) to ~485m (Spa).

### 5.15 UI Surfaces

- **Stewards card (race page):** Adds three offence labels (`unsafe-release`, `pit-lane-speeding`, `failure-to-serve`). No structural change.
- **Penalty Record (driver page):** Same — three new labels in the offence-label map, no other changes.
- **Pit-Crew card (Factory page):** New card in the hero strip, fourth slot after Power Unit / Aero / R&D. Shows: chief portrait + 3 attributes, member roster (6 rows: role, name, rating, salary), aggregate sub-attributes badge (`Release 78` / `Speed Disc 65` / `Service 71`), free-agent market button. Visual idiom matches existing Factory cards.
- **Staff Market modal:** Opens from Pit-Crew card. Shows free-agent list (chiefs in one tab, members per role in another). Hire button per row. Filterable by attribute / salary.
- **Poaching alert (Paddock page):** Same alert pattern as driver poaching (when that lands). For v2, alerts surface as a banner on the Paddock page paddock-rumours feed.

### 5.16 Determinism Strategy

- Sub-step PRNG ordering fixed (see 5.3) — the same PRNG instance with sorted-by-id consumption order.
- Talent pool generation deterministic on `(seed, season)`.
- Hiring / firing actions are user-driven and snapshotted into `world` state; replay-from-save reproduces them.
- Poaching attempt evaluation runs in `runStaffMarket` deterministically against rival teams' attribute gaps + budget headroom + AI personality.

A determinism replay test runs a seeded race with one player pit stop and verifies byte-identical pit-lane event streams across two runs (mirrors the Tier A determinism test).

## 6. Implementation Phase Packaging

Per brainstorm Q-final = Approach A (engine-first, then staff, then connect).

### IP-B1 — Engine layer, neutral staff
- Pit-lane FSM + 3 zones + sub-step loop.
- New offence types + sanction matrix entries.
- 3-lap-window failure-to-serve.
- 24 circuits get `pitLane` calibration block populated from FIA constants.
- Worker protocol gains 4 new event types.
- Schema bump for the *engine* fields only (no staff fields yet — defer to IP-B2).
- Staff sub-attributes hardcoded at neutral 70/70/70 for all teams.
- Test coverage: FSM transitions, zone math, sub-step PRNG ordering, unsafe-release fault formula, speeding fault formula, failure-to-serve state machine, determinism replay.

### IP-B2 — Staff schema + Factory UI
- `team.pitCrewChief` + `team.pitCrewMembers[]` with `Contract` field.
- `world.staffMarket` + procgen talent pool.
- `world.poachingAttempts: []` field (poaching logic ships in IP-B3).
- Pit-Crew card on Factory page (read-only against engine).
- Staff Market modal with hire / fire actions.
- Schema bump for staff fields. Combined or separate from IP-B1 bump — TBD by IP-B1 commit cadence.
- Sub-attributes still hardcoded — not yet wired to engine.

### IP-B3 — Connect + calibrate + poach
- Wire `aggregateCrewRatings(chief, members)` into engine fault rolls.
- Calibration tuning pass to hit ~1.5 unsafe / ~4 speeding / ~0.1 failure-to-serve per season.
- Poaching attempt evaluation in `runStaffMarket`.
- Counter-offer UI + Paddock alert.
- Stewards card / Penalty Record / commentary surfaces gain the three new offence labels.

### IP-B4 — Polish (small)
- Edge cases: drivers retiring mid-pit-stop, safety car triggering during a pit stop, rain transition during a pit stop.
- Telemetry / commentary tuning.
- Acceptance: full season run with the player making active staff decisions produces the calibration targets within ±20%.

## 7. Risks & Open Questions

- **Sub-step performance.** Worst-case race lap: 20 cars all pit on the same lap (rain transition). Sub-step burns 20 × ~50 ticks = 1000 PRNG values + 1000 zone transitions. Should still be milliseconds. Validate in IP-B1 with a stress test.
- **Calibration convergence.** Three new offence types × three sub-attribute knobs per team × per-circuit `pitLane` parameters = a wide surface to tune. Plan to do calibration in IP-B3 with `meanLossSeconds` derived from existing OpenF1 + the new FIA-constant geometry; expect 2–3 tuning passes against the per-season frequency targets.
- **Pit-crew chief attribute axes.** Three attributes (release / speed-discipline / service) feel right. May collapse to two if playtest shows speed-discipline is too niche to invest in (some teams only pay for release + service).
- **Schema migration timing.** IP-B1 ships engine fields; IP-B2 ships staff fields. Two consecutive bumps (11→12, 12→13) or one combined bump (11→13) — preference is one combined when both lands in a short window. Tie-break per execution observation.
- **Failure-to-serve and DNF semantics.** Real F1: a driver who DNFs before serving has the sanction "withdrawn." We keep it on the season-stats record. Acceptable approximation — flag for playtest feedback.
- **Lollipop role naming.** Modern F1 has no lollipop. Keep the role name pending player feedback or rename to `release-supervisor` — purely cosmetic.

## 8. Acceptance Criteria

- All Section 3 criteria satisfied.
- All four IP phases land on `main` with green CI at each.
- Schema migrations cover every new persisted field.
- Determinism replay HARD GATE passes for pit-lane events.
- Free-agent pool deterministic-from-seed verified by test.
- Pit-Crew card renders correctly with: no chief hired (default state), partial roster, full roster.
- Calibration replay (full seeded season, neutral staff) lands within ±20% of frequency targets.
- All new persisted fields documented in [docs/architecture/persistence-contract.md](../../architecture/persistence-contract.md).

## 9. Out-of-Scope Followups (to track in memory)

- Tier C v3 — track-state-adjacent offences (track limits, yellow/red flag breaches, safety-car overtakes).
- Driver-style negotiable contracts for pit crew (Q8-A → Q8-B graduation).
- Polymorphic staff registry — race engineer, head of aero, etc.
- Pit-crew morale / fatigue.
- Sponsor KPI integration tied to pit-crew performance.
- Real-name overlay on the procgen talent pool.
- Aging arcs for staff.
