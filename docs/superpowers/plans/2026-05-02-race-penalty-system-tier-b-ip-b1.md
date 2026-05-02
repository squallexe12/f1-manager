# Race Penalty System — Tier B v2, IP-B1 Implementation Plan
## Engine Layer Only (Neutral Staff)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the engine layer of Tier B: a deterministic pit-lane finite-state machine, a 3-zone speed model, sub-step time simulation triggered only when ≥1 car enters the pit lane on a given lap, three new offence types (`unsafe-release`, `pit-lane-speeding`, `failure-to-serve`) wired into the existing Tier A `'investigation-opened'` channel, and per-circuit pit-lane geometry. Staff sub-attributes hardcoded at neutral 70/70/70 — the staff system itself ships in IP-B2.

**Architecture:** Two new pure-function engine modules under `src/engine/race/` (`pit-lane-engine.ts`, `pit-lane-fsm.ts`) plus `failure-to-serve.ts`. One new data file `src/data/pit-lane-circuits.ts` populated from FIA technical bulletins for all 24 circuits. `race-simulator.ts` pit branch extended to dispatch to `simulatePitLane`. `race-sim-worker.ts` gains four new event types. **No persistence schema bump in IP-B1** — all new state is session-scoped (`raceRuntime`) and all calibration is loaded from data files. Schema bump arrives with IP-B2 staff fields.

**Tech Stack:** TypeScript strict mode, Vitest, the existing seeded `PRNG` in `src/engine/core/prng.ts`, Web Worker for race simulation.

**Spec:** [docs/superpowers/specs/2026-05-02-race-penalty-system-tier-b-design.md](../specs/2026-05-02-race-penalty-system-tier-b-design.md)

**Pipeline (per AGENTS.md):** sim-engine → game-state (worker protocol) → verify. No `ui-interface` work in IP-B1.

---

## Pre-flight

- [ ] **Confirm clean working tree.** Run `git status` — no uncommitted changes before starting Task 1.
- [ ] **Confirm tests pass on `main`.** Run `npx vitest run` and `npx tsc --noEmit`. Both green.
- [ ] **Confirm Tier A baseline intact.** Run `npx vitest run tests/engine/race/penalty-engine.test.ts tests/engine/drivers/penalty-points.test.ts`. Both green.

---

## Phase 1 — Type Foundations

Verification: `npx tsc --noEmit` only. No runtime tests yet.

### Task 1: Extend `OffenceType` and `RaceIncident` for pit-lane offences

**Files:**
- Modify: `src/types/race.ts`

- [ ] **Step 1.** Extend the `OffenceType` union with three new members:
  ```ts
  export type OffenceType =
    | 'collision-minor'
    | 'collision-serious'
    | 'forcing-off'
    | 'illegal-defending'
    | 'unsafe-release'
    | 'pit-lane-speeding'
    | 'failure-to-serve'
  ```
- [ ] **Step 2.** No structural change to the `RaceIncident` discriminated union — the `investigation-opened` and `penalty-issued` variants already carry `offenceType: OffenceType`, which now covers the new members. Confirm the union still type-checks.
- [ ] **Step 3.** Run `npx tsc --noEmit`. Expect green.

### Task 2: Add `PitLaneCalibration` to `CalibrationProfile`

**Files:**
- Modify: `src/types/calibration.ts`

- [ ] **Step 1.** Add the new interface near the bottom of the calibration types:
  ```ts
  export interface PitLaneCalibration {
    /** Total pit-lane length, meters, lane-entry-line to lane-exit-line. */
    lengthMeters: number
    /** FIA-imposed speed limit in the limit-zone, km/h. Almost always 80; 60 at a few circuits. */
    speedLimitKph: number
    /** Distance from lane-entry-line to start of limit-zone, meters. Cars decelerate over this distance. */
    entryDecelMeters: number
    /** Distance from end of limit-zone to lane-exit-line, meters. Cars accelerate over this distance. */
    exitAccelMeters: number
  }
  ```
- [ ] **Step 2.** Add `pitLane: PitLaneCalibration` to `CalibrationProfile`.
- [ ] **Step 3.** Add `DEFAULT_PITLANE_CALIBRATION` (generic 350m lane, 80 km/h, 40m decel zones).
- [ ] **Step 4.** Update `createFallbackProfile` and `deriveCalibrationFromCircuit` to populate `pitLane` with `DEFAULT_PITLANE_CALIBRATION`.
- [ ] **Step 5.** Run `npx tsc --noEmit`. Resolve any compile errors at calibration construction sites.

### Task 3: Add pit-lane FSM types

**Files:**
- Create: `src/types/pit-lane.ts`

- [ ] **Step 1.** Author the file:
  ```ts
  export type PitLaneZone =
    | 'pre-entry'
    | 'entry-decel'
    | 'limit-zone'
    | 'exit-accel'
    | 'exited'

  export interface PitLaneCarState {
    driverId: string
    zone: PitLaneZone
    enteredAtSeconds: number
    zoneEnteredAtSeconds: number
    speedKph: number
    positionMeters: number
    serviceStartSeconds: number | null
    serviceEndSeconds: number | null
    releasedAtSeconds: number | null
  }

  export interface SanctionDeadline {
    sanction: 'drive-through' | 'stop-go'
    issuedOnLap: number
    mustServeByLap: number
  }
  ```
- [ ] **Step 2.** Run `npx tsc --noEmit`. Green.

---

## Phase 2 — Pure Engine Modules

Each task ships with its tests (TDD: write tests first, confirm RED, implement, confirm GREEN). Use the `superpowers:test-driven-development` skill.

### Task 4: `pit-lane-fsm.ts` — pure transitions

**Files:**
- Create: `src/engine/race/pit-lane-fsm.ts`
- Create: `tests/engine/race/pit-lane-fsm.test.ts`

- [ ] **Step 1 (RED).** Write tests that cover:
  - `advancePitLaneFsm(state, deltaSeconds, calibration, ratings)` advances `pre-entry → entry-decel` when crossing the entry line.
  - Advances `entry-decel → limit-zone` when `positionMeters >= entryDecelMeters`.
  - Advances `limit-zone → exit-accel` when `releasedAtSeconds !== null` AND `positionMeters >= entryDecelMeters + transitMeters`.
  - Advances `exit-accel → exited` when `positionMeters >= lengthMeters`.
  - Speed in `entry-decel` linearly interpolates from `carEntrySpeedKph` to `speedLimitKph`.
  - Speed in `limit-zone` is `speedLimitKph - 1 + gaussianSample(rng, 0, stddev)` where stddev derives from `speedDiscipline`.
- [ ] **Step 2.** Run `npx vitest run tests/engine/race/pit-lane-fsm.test.ts`. Expect FAIL.
- [ ] **Step 3 (GREEN).** Implement `advancePitLaneFsm` and supporting helpers.
- [ ] **Step 4.** Re-run the test. Expect GREEN.
- [ ] **Step 5.** Verify engine purity: no imports from `src/stores/`, `src/hooks/`, `src/components/`, or any browser API. No `Math.random()`.

### Task 5: `evaluateUnsafeRelease` — fault formula

**Files:**
- Create: `src/engine/race/pit-lane-engine.ts` (initial scaffold)
- Create: `tests/engine/race/pit-lane-engine.test.ts`

- [ ] **Step 1 (RED).** Write tests:
  - Clean release (no conflicting cars within safety margin) → `decision === null`.
  - Release into a closing car within 0.4s → fault crosses `unsafeReleaseFaultThreshold`, decision blamed on released-car driver.
  - Higher `crewRelease` rating (chief + lollipop) reduces fault even with same gap.
  - Severity tier scales with how short the gap is.
  - Determinism: same inputs + same seed → same fault score.
- [ ] **Step 2.** Run vitest. Expect FAIL.
- [ ] **Step 3 (GREEN).** Implement `evaluateUnsafeRelease`. Reuse Tier A's `severityFromScore` helper from `penalty-engine.ts` (re-export if needed; do not duplicate).
- [ ] **Step 4.** Re-run. GREEN.

### Task 6: `evaluatePitLaneSpeeding` — limit-zone detection

**Files:**
- Modify: `src/engine/race/pit-lane-engine.ts`
- Modify: `tests/engine/race/pit-lane-engine.test.ts`

- [ ] **Step 1 (RED).** Tests:
  - Sampled speed strictly above limit + tolerance → decision returned with severity `'minor'`.
  - Sampled speed at-or-below limit → `decision === null`.
  - Higher `speedDiscipline` reduces frequency (sample 1000 ticks per discipline level, count detections).
- [ ] **Step 2.** Vitest FAIL.
- [ ] **Step 3 (GREEN).** Implement `evaluatePitLaneSpeeding`. The detection is binary on the sampled speed; the calibration knob is the *upstream* speed-sampling distribution.
- [ ] **Step 4.** Vitest GREEN.

### Task 7: `simulatePitLane` — sub-step orchestrator

**Files:**
- Modify: `src/engine/race/pit-lane-engine.ts`
- Modify: `tests/engine/race/pit-lane-engine.test.ts`

- [ ] **Step 1 (RED).** Tests:
  - With one car entering the lane, returns one `serviceTimeSeconds` entry, no incidents.
  - With two cars entering simultaneously, returns two `serviceTimeSeconds` entries; if their release windows overlap unsafely, an `unsafe-release` incident is emitted for the second-released car.
  - Sub-step PRNG burns the same number of values per car regardless of entry order — verify by comparing PRNG state after two simulations with cars in different order.
  - Determinism: byte-identical output for identical input.
- [ ] **Step 2.** Vitest FAIL.
- [ ] **Step 3 (GREEN).** Implement `simulatePitLane(state, rng, lap)`. Sort cars by `driverId` ascending before consuming PRNG (per spec §5.3).
- [ ] **Step 4.** Vitest GREEN.

### Task 8: `failure-to-serve.ts` — 3-lap window enforcement

**Files:**
- Create: `src/engine/race/failure-to-serve.ts`
- Create: `tests/engine/race/failure-to-serve.test.ts`

- [ ] **Step 1 (RED).** Tests:
  - `registerSanctionDeadline(state, driverId, sanction, issuedLap, windowLaps)` writes to `state.sanctionDeadlines[driverId]`.
  - `checkFailureToServe(state, currentLap)` returns no incidents when no deadlines exist.
  - Returns one `'penalty-issued'` incident with `offenceType: 'failure-to-serve'` when `currentLap > deadline.mustServeByLap`.
  - Marks the driver in `state.dnf`.
  - Clears the entry on processing.
  - Re-running on the same lap is idempotent (the entry was deleted on first call).
- [ ] **Step 2.** Vitest FAIL.
- [ ] **Step 3 (GREEN).** Implement both functions as pure (return new state objects, do not mutate).
- [ ] **Step 4.** Vitest GREEN.

### Task 9: Update `PenaltyCalibration` and sanction matrix

**Files:**
- Modify: `src/data/penalty-calibration.ts`
- Modify: `tests/data/penalty-calibration.test.ts`

- [ ] **Step 1.** Extend `PenaltyCalibration` with three new fields:
  ```ts
  unsafeReleaseFaultThreshold: number       // default 0.45
  pitLaneSpeedingMeanOffsetKph: number      // default -1
  failureToServeWindowLaps: number          // default 3
  ```
- [ ] **Step 2.** Extend `sanctionMatrix` with three new offence rows:
  - `unsafe-release`: minor=`5s`/`pp:1`, serious=`10s`/`pp:2`, major=`drive-through`/`pp:3`, egregious=`drive-through`/`pp:3`.
  - `pit-lane-speeding`: minor=`drive-through`/`pp:0` (speeding is a procedural infringement; no penalty points). All severity tiers map to the same row in v2.
  - `failure-to-serve`: egregious-only =`stop-go`+DNF marker, but in practice this offence type bypasses the sanction matrix and is recorded directly with `timePenaltySeconds: 0` (DNF supersedes time penalties). Add a row for completeness.
- [ ] **Step 3.** Add tests asserting each new sanction-matrix cell returns the expected sanction / time / pp tuple.
- [ ] **Step 4.** Vitest GREEN. `npx tsc --noEmit` clean.

### Task 10: Per-circuit `pitLane` data — 24 circuits

**Files:**
- Create: `src/data/pit-lane-circuits.ts`
- Modify: any per-circuit calibration JSON loader to populate `pitLane`. Investigate which file does this; likely `src/data/calibration-circuits/*.json` or the loader in `src/data/calibration-loader.ts`.

- [ ] **Step 1.** Author `src/data/pit-lane-circuits.ts` exporting `PIT_LANE_BY_CIRCUIT_ID: Record<string, PitLaneCalibration>` populated for all 24 circuits with values from FIA technical bulletins / sporting regs (typical lengths: Monaco ~280m, Spa ~485m, Shanghai ~395m, Silverstone ~415m, etc.; speed limit 80 km/h universal in 2026, with 60 km/h overrides if any). Use `entryDecelMeters: 40` and `exitAccelMeters: 40` as the baseline; override per circuit if FIA published different values.
- [ ] **Step 2.** Update the calibration loader so `CalibrationProfile.pitLane` populates from `PIT_LANE_BY_CIRCUIT_ID[circuitId]` when present, falling back to `DEFAULT_PITLANE_CALIBRATION` otherwise.
- [ ] **Step 3.** Add a test verifying every 2026 calendar circuit has a `pitLane` entry.

---

## Phase 3 — Integration

### Task 11: Wire `simulatePitLane` into `race-simulator.ts` pit branch

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `tests/engine/race/race-simulator.test.ts`

- [ ] **Step 1.** In the pit branch (currently `if (strategy.currentCommand === 'pit')`), collect all driver-ids issuing pit commands this lap into a `pittingThisLap: string[]` array *before* the per-driver loop.
- [ ] **Step 2.** After the per-driver loop completes lap-time accumulation, if `pittingThisLap.length > 0`, call `simulatePitLane(state, rng, state.currentLap)`. The function reads from `state` and consumes `rng` deterministically.
- [ ] **Step 3.** Replace the static `pitLoss.meanLossSeconds` term in lap-time math with the per-driver `serviceTimeSeconds` returned by the sub-step. Each driver's `cumulativeTimes[id]` accumulates the new value.
- [ ] **Step 4.** Push any incidents returned from `simulatePitLane` into the per-lap `incidents` array.
- [ ] **Step 5.** Use neutral-rated 70/70/70 for `crewRelease` / `speedDiscipline` / `serviceTime` — staff aggregation lands in IP-B2.
- [ ] **Step 6.** Verify Tier A determinism replay still passes: a seeded race with NO pit stops produces byte-identical output.
- [ ] **Step 7.** Add a test for a seeded race WITH pit stops: byte-identical pit-lane events across two runs.

### Task 12: Per-lap failure-to-serve check in main loop

**Files:**
- Modify: `src/engine/race/race-simulator.ts`

- [ ] **Step 1.** Where Tier A's resolved-investigations block writes `pendingTimePenalties`, also call `registerSanctionDeadline` when the issued sanction is `'drive-through'` or `'stop-go'`.
- [ ] **Step 2.** At the top of the per-lap simulation, *before* the pit branch, call `checkFailureToServe(state, currentLap)` and push any returned incidents into `incidents`.
- [ ] **Step 3.** When the pit branch consumes a `pendingTimePenalty`, also clear the matching `state.sanctionDeadlines` entry (the sanction is now served).
- [ ] **Step 4.** When a driver enters `state.dnf` for any reason (mechanical, crash, off-track), if they have an open `sanctionDeadlines` entry, emit a `failure-to-serve` incident before clearing. (Real F1 retroactively withdraws — we keep it on record per spec §5.6.)
- [ ] **Step 5.** Add tests:
  - Drive-through issued lap 5 served at lap 7 → no failure-to-serve.
  - Drive-through issued lap 5 *not* served, lap 9 → DNF + failure-to-serve incident.
  - Driver mechanical-DNF on lap 6 with unserved drive-through → failure-to-serve incident emitted.

### Task 13: Worker emits four new event types

**Files:**
- Modify: `src/types/race.ts` (add the four new `RaceWorkerEvent` discriminated-union variants)
- Modify: `src/workers/race-sim-worker.ts`
- Modify: `src/engine/race/race-worker-adapter.ts`
- Modify: `src/workers/race-worker-protocol.ts` (type guards)

- [ ] **Step 1.** Extend `RaceWorkerEvent` union with:
  ```ts
  | { type: 'pitLaneEntry'; lap: number; driverId: string; entrySpeedKph: number }
  | { type: 'pitLaneRelease'; lap: number; driverId: string; releaseDelaySeconds: number }
  | { type: 'pitLaneExit'; lap: number; driverId: string; totalLaneSeconds: number }
  | { type: 'pitLaneSpeedingDetected'; lap: number; driverId: string; sampledSpeedKph: number }
  ```
- [ ] **Step 2.** In `race-sim-worker.ts`, after `simulatePitLane` runs, emit the four event types as the FSM transitions. Wire up the message in `__handleMessage` flow.
- [ ] **Step 3.** Update `race-worker-adapter.ts` to forward these events to the store. For IP-B1 they land in the existing `raceRuntime` slice as commentary entries (no new slice fields).
- [ ] **Step 4.** Add a test that drives `__handleMessage` with a single-pit-stop scenario and asserts all four event types are posted.

---

## Phase 4 — Verification

### Task 14: Determinism replay HARD GATE

**Files:**
- Create: `tests/engine/race/pit-lane-determinism.test.ts`

- [ ] **Step 1.** Construct a seeded full-race scenario: 8 drivers, 30 laps, 2 pit stops each. Use neutral 70/70/70 staff ratings.
- [ ] **Step 2.** Run the simulator twice with the same seed.
- [ ] **Step 3.** Assert byte-identical: lap-time sequences, pit-lane event streams, incident arrays, final positions.
- [ ] **Step 4.** This test is the **hard gate** for IP-B1. If it fails after any change to the pit-lane engine, the change does not ship.

### Task 15: Stress test — 20-car simultaneous pit (rain transition)

**Files:**
- Create: `tests/engine/race/pit-lane-stress.test.ts`

- [ ] **Step 1.** Construct a scenario where all 20 cars pit on the same lap.
- [ ] **Step 2.** Assert the sub-step completes within 100ms wall-clock on a typical dev machine. Document the actual measured number.
- [ ] **Step 3.** Assert PRNG burns exactly 20 × N values (N = sub-step PRNG values per car), no off-by-one.

### Task 16: Frequency calibration smoke check

**Files:**
- Create: `tests/engine/race/pit-lane-calibration.test.ts`

- [ ] **Step 1.** Run a seeded full-season replay (22 races × ~2 stops × 20 cars = ~880 pit stops) with neutral 70/70/70 staff.
- [ ] **Step 2.** Count emitted `unsafe-release` / `pit-lane-speeding` / `failure-to-serve` events.
- [ ] **Step 3.** Assert the season-totals are within ±50% of targets (1.5 / 4 / 0.1) for a smoke check. Tight ±20% calibration ships in IP-B3 once staff aggregation is wired.
- [ ] **Step 4.** If results are wildly off, document expected vs. observed and flag for IP-B3 calibration tuning.

### Task 17: Full-suite verification + lint

- [ ] **Step 1.** Run `npx tsc --noEmit`. EXIT 0.
- [ ] **Step 2.** Run `npx vitest run`. ALL pass (modulo the 1 pre-existing skip).
- [ ] **Step 3.** Run `npm run lint` against the new files. No new errors introduced.
- [ ] **Step 4.** Run the dependency analyzer to verify engine purity:
  ```bash
  python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine
  ```
  Confirm no engine file imports from stores / hooks / components / browser APIs.

---

## Done Criteria for IP-B1

- [ ] All 17 tasks complete and committed (separate commits per task or per phase, by execution preference).
- [ ] Determinism replay HARD GATE green.
- [ ] Stress test passes within wall-clock budget.
- [ ] Frequency smoke check shows roughly the right order of magnitude.
- [ ] Tier A baseline tests still green.
- [ ] No persistence schema bump in this IP — staff fields land in IP-B2.
- [ ] Update [project_penalty_system_tier_b_in_progress.md](../../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_penalty_system_tier_b_in_progress.md) with the IP-B1 commit range.
- [ ] Hand off to IP-B2: staff schema + Factory UI.

## Risks Specific to IP-B1

- **PRNG ordering subtlety.** If sub-step PRNG ordering is not strictly stable (sorted-by-id), determinism breaks invisibly. Catch it in Task 14; fix at root, do not paper over.
- **Per-circuit lane-length data quality.** Hand entry of 24 entries is small but error-prone. Flag any value > 600m or < 200m as suspicious during review.
- **Worker protocol message volume.** Four new event types × ~80 stops per race = a lot of messages. Profile in Task 15 if dev tools show stutter.
- **Sub-step interaction with safety car.** A safety-car deployment during a pit stop has unclear semantics. v2 acceptable behavior: complete the in-progress pit stop normally, do not retroactively reroute. Document and flag for IP-B4 polish if needed.
