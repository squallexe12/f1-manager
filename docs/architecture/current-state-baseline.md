# Current-State Baseline (Post-v1.0.1)

**Frozen:** 2026-04-11
**Last updated:** 2026-04-25 (IP-09 Penalty System Tier A)
**Purpose:** Captures runtime truth after the selector, orchestrator, and persistence refactor. Serves as the contract reference for IP-01 through IP-09.

---

## 1. Current Runtime Truth

### 1.1 Store Layer

**`src/stores/game-store.ts`** is a thin dispatch layer. It holds four state fields:

| Field | Type | Purpose |
|-------|------|---------|
| `world` | `FullGameState \| null` | Complete game state — teams, drivers, calendar, finance, narrative |
| `eventCooldowns` | `Record<string, number>` | Cooldown timers for narrative event generation |
| `lastRaceResults` | `RaceResult[] \| null` | Most recent race results for UI display |
| `lastSeasonEnd` | `SeasonEndResult \| null` | Most recent season-end summary for UI display |

Store actions delegate all pure gameplay transitions to `orchestrator.ts`:
- `advancePhase()` → `advanceGamePhase(world)`
- `submitRaceResults()` → `processPostRacePhase(world, cooldowns, results, isSprint)`
- `processSeasonEnd()` → `processSeasonEndPhase(world)`

Store actions that mutate world directly (thin wrappers):
- `initGame()` — calls `initializeGame()` from `state-manager.ts`
- `allocateRnD()` / `pauseRnD()` — map over teams to toggle upgrade status
- `resolveEvent()` — marks a narrative event as resolved
- `setDriverCommand()` — **placeholder, does nothing** (race commands go through hook)

### 1.2 Orchestrator Layer

**`src/engine/core/orchestrator.ts`** owns these pure functions:

| Function | Input | Output | Triggers |
|----------|-------|--------|----------|
| `advanceGamePhase(world)` | `FullGameState` | `FullGameState` | Phase transition + management entry if entering management |
| `processManagementEntry(world)` | `FullGameState` | `FullGameState` | R&D cycles, technical directives, AI team decisions |
| `processPostRacePhase(world, cooldowns, results, isSprint)` | World + race data | `{ world, eventCooldowns }` | Standings, moods, finance, narrative events |
| `processSeasonEndPhase(world)` | `FullGameState` | `{ world, result }` | Prizes, aging, contracts, R&D reset, season increment |

All orchestrator functions:
- Accept immutable state, return new state
- Use seeded PRNG for determinism
- Have zero side effects
- Do not access stores, DOM, or browser APIs

### 1.3 Race Runtime (post IP-04)

Race execution is now **worker-authoritative and store-mediated**:

- `src/workers/race-sim-worker.ts` owns the lap-by-lap simulation loop, weather engine, and AI strategy decisions. It runs off the main thread.
- `src/engine/race/race-worker-adapter.ts` wires a `RaceWorkerHandle` to the game store. It translates worker output messages into store mutations and forwards command envelopes from the `raceCommandBus` to the worker.
- `src/stores/game-store.ts` carries a `raceRuntime` slice (see §3.1 — **OUTSIDE** `world`) that holds all in-race state: phase, lap counters, tire states, commentary, incidents, worker status, last error, final results.
- `src/hooks/use-race-simulation.ts` is now a thin UI adapter. It reads the runtime slice via Zustand selectors, owns sub-tick interpolation at 60fps (a presentation-only concern), and delegates lifecycle control (`start`, `pause`, `resume`, `setSpeed`) to the adapter.
- `onRaceEnd` fires from a `useEffect` that watches `phase === 'finished'` — exactly once per race.

Tier 1 recovery is in place: on a fatal worker error the `raceRuntime.workerStatus` becomes `'error'`, `raceRuntime.lastError` holds the code/message/lastValidLap, and the Strategy page renders a "Restart Race From Lap 1" recovery surface. Tier 2 (mid-race resume from checkpoint) is explicitly out of scope.

### 1.4 Persistence Layer

Fully decoupled from store actions after v1.0.1 refactor and hardened in IP-05:

| Component | File | Responsibility |
|-----------|------|---------------|
| `SaveSystem` (class) | `src/engine/core/save-system.ts` | IndexedDB operations + `migrateToCurrent()` entry point for schema evolution |
| `saveSystem` (singleton) | `src/stores/persistence-setup.ts` | Browser-only `SaveSystem` instance |
| `setupPersistence()` | `src/stores/persistence-setup.ts` | Zustand subscriber that auto-saves on `world` reference change; tracks `AutosaveStatus` (save count, error count, last error) observable via `subscribeAutosaveStatus()` |
| `PersistenceProvider` | React component | Calls `setupPersistence()` once at app boot |
| `useSaveGame()` | `src/hooks/use-save-game.ts` | Hook for manual save/load/delete/import/export — imperative `getState()` reads, exposes `status: { isSaving, isLoading, lastAction, lastError }` |

**Contract reference:** `docs/architecture/persistence-contract.md` documents persisted vs transient fields, autosave trigger rules, schema migration policy, and the IP-04 Option A race-slice interaction.

### 1.5 UI Layer

- Components use `useShallow` selectors from Zustand to minimize re-render blast radius
- Custom `useGameSlice` hook provides pre-built selector patterns
- Race UI reads from `useRaceSimulation` hook local state, not from Zustand store
- Pages: Paddock (dashboard), Factory (R&D), Strategy (race), plus calendar and settings

### 1.6 Pure Engine Modules

All under `src/engine/`, all pure functions with seeded PRNG:

| Domain | Key Modules |
|--------|-------------|
| Core | `prng.ts`, `state-manager.ts`, `orchestrator.ts`, `post-race-processor.ts`, `season-end-processor.ts`, `save-system.ts` |
| Race | `race-simulator.ts`, `tire-model.ts`, `pit-strategy.ts`, `overtake.ts`, `weather.ts`, `penalty-engine.ts` |
| Drivers | `mood-system.ts`, `driver-model.ts`, `aging.ts`, `contract-engine.ts`, `penalty-points.ts` |
| Engineering | `rnd-engine.ts`, `car-performance.ts`, `component-lifecycle.ts` |
| Finance | `budget-engine.ts`, `sponsor-engine.ts`, `prestige.ts` |
| Narrative | `event-generator.ts`, `story-arc-tracker.ts` |
| AI | `ai-team-engine.ts` |
| Regulations | `regulation-engine.ts` |
| Delegation | `department-ai.ts` |

---

## 2. Target Architecture

### 2.1 Race Authority Migration

**Status (post IP-04):** Complete. Web Worker owns the simulation loop. The store applies worker updates to `raceRuntime`. Components read via narrow Zustand selectors. `useRaceSimulation` is a UI adapter around the store; it no longer owns race authority.

### 2.2 Command Envelope

**Current:** `setDriverCommand` in store is a no-op placeholder. Commands go directly through hook's `sendCommand()`.

**Target:** Commands are serializable envelopes dispatched through the store, forwarded to the worker via `postMessage`. Enables replay and logging.

### 2.3 Worker Protocol

**Status (post IP-04):** Protocol wired into production. The adapter in `src/engine/race/race-worker-adapter.ts` translates worker output events into store slice mutations, forwards command envelopes, and owns worker termination. `batch` messages are flattened and their inner events applied in order. `useRaceSimulation` consumes the store slice and manages adapter lifecycle.

**Deferred:** MAX-speed backpressure via batch-then-ack remains available in the protocol but is not exercised by the current adapter. Revisit if MAX-speed playback reveals dropped frames or queued input lag.

### 2.4 Bootstrap Determinism

**Current:** `initializeGame()` uses seeded PRNG for R&D and finance but some initialization paths may have non-deterministic ordering.

**Target:** Every input to game initialization is typed and serializable. Given the same seed + team + scenario, output is byte-identical.

---

## 3. Confirmed Gaps

These gaps are frozen as follow-up items for later implementation phases:

| Gap | Current State | Target Phase |
|-----|--------------|-------------|
| `setDriverCommand` is a placeholder | No-op in store; commands managed by hook | IP-02 (Command Authority) |
| Race execution is hook-owned | _Resolved IP-04._ Worker owns race authority; hook is a UI adapter | — |
| Worker execution is not production-wired | _Resolved IP-04._ Adapter wires worker to store | — |
| Race bootstrap has non-deterministic pieces | Some init paths may vary | IP-01 (Determinism) |
| No OpenF1 real-data integration | _Resolved IP-06 and IP-07._ 24 circuits carry OpenF1-derived tire, weather, overtake, pit-loss, and stint calibration; pre-race intel surface consumes them | — |
| No engineer recommendation system | _Resolved IP-08._ `world.recommendations` generated in `processManagementEntry()`, surfaced on Paddock + Factory + pre-race Strategy; apply/dismiss wired through the store | — |
| Race state not in Zustand store | _Resolved IP-04._ `raceRuntime` slice lives outside `world` (see §3.1) | — |
| No race penalty / super-licence system | _Resolved IP-09._ Tier A driving offences (collision, forcing-off, illegal-defending) detected during race simulation; stewards' investigation window defers penalty resolution; time penalties fold into race results at next pit or race end; super-licence points with 22-round rolling expiry; race bans at 12 points (reserve substitution); 10-place grid drops at 5 driving warnings. See §3.2. | — |
| Tier B / Tier C penalty offences | Pit-adjacent (unsafe release, pit-lane speeding) and track-state-adjacent (track limits, yellow/red flag breaches) offences not yet implemented. | Future |

---

## 3.1 Race Slice Ownership Decision (IP-04)

**Decision:** Option A — the race runtime slice lives **OUTSIDE** `world`.

**Implications:**
- `setupPersistence()` fires only on `world` reference change. The race runtime slice is a sibling top-level field on the game store, so autosave never captures mid-race state.
- Mid-race page reloads return the player to the pre-race strategy screen. Resuming a race in-flight is not supported.
- IP-05 persistence hardening needs **no schema migration** for the race slice: only `world` is serialized.
- Tier 2 mid-race checkpoint resume is explicitly out of scope. If it is ever adopted, it requires its own snapshot schema and a dedicated migration — it does not retrofit into IP-05.

**Rationale:** Race simulation is a session-scoped activity. Persisting mid-race state would force high-frequency IndexedDB writes during active races (every lap update) without a matching product requirement. The overwhelming majority of player value is captured by post-race results, which flow into `world` via `submitRaceResults()` and therefore are persisted.

---

## 3.2 Race Penalty System — IP-09 (Tier A v1)

**Status:** Complete (2026-04-25).

### Goal

Detect overtake-adjacent driving offences during the simulated race; defer-resolve them through a stewards' investigation window; apply time penalties at the next pit or race end; persist super-licence penalty points with a rolling 22-round expiry; ban drivers at 12 accumulated points (with reserve substitution); apply 10-place grid drops on five driving warnings.

### Scope

**In scope (Tier A — overtake-adjacent):**
- Offence types: collision, forcing-off, illegal-defending.
- Sanctions: 5s / 10s / 30s time penalty, 3s drive-through (converted to time at race end), super-licence penalty points (1 / 2 / 3 depending on severity).
- Driving warning → 5 warnings triggers one-shot 10-place grid drop for the next race.
- Race ban at 12 accumulated super-licence points; reserve driver substitutes for the banned driver; points reset to 0 on return.
- Stewards' investigation window: offences raised during lap simulation are held as `pendingInvestigations` for a configurable number of laps before resolving to a sanction or "no further action".
- Time penalties accumulate in `pendingTimePenalties` and are applied at the driver's next pit stop or folded into final race-time at race end.
- `RaceResult.appliedPenalties` carries the fold summary out of the worker for `processPostRace()` to consume when updating the four persisted driver fields.

**Explicitly out of scope:**
- Tier B (pit-adjacent): unsafe release, pit-lane speeding.
- Tier C (track-state-adjacent): track limits, yellow/red flag breaches.
- Misconduct / language penalties.
- Post-race scrutineering DSQ.
- FIA Right of Review.
- Position handback pre-emption.

### Files Added

| File | Purpose |
|------|---------|
| `src/data/penalty-calibration.ts` | Per-offence-type probability weights, severity distributions, and stewards' investigation duration by circuit |
| `src/engine/drivers/penalty-points.ts` | Pure functions: award points, expire stale entries (22-round window), check ban threshold, check warning threshold |
| `src/engine/race/penalty-engine.ts` | Pure functions: detect offences from lap-state deltas, resolve investigations, apply time sanctions, fold penalties into results |
| `src/components/strategy/stewards-card.tsx` | Live-race Stewards card showing pending investigations and resolved sanctions |
| `src/components/strategy/stewards-decisions-panel.tsx` | Post-race panel summarising all applied penalties |
| `src/components/drivers/penalty-record-section.tsx` | Driver Office detail section: super-licence points history, warnings, ban status |
| `tests/data/penalty-calibration.test.ts` | Validates calibration shape and probability sums |
| `tests/engine/drivers/penalty-points.test.ts` | Unit tests: award, expiry, ban/warning thresholds |
| `tests/engine/race/penalty-engine.test.ts` | Unit tests: offence detection, investigation resolution, sanction application, time-penalty fold |
| `tests/engine/core/post-race-penalty-fold.test.ts` | Integration test: `processPostRace()` correctly updates the four persisted driver fields from `RaceResult.appliedPenalties` |

### Files Modified

| File | Change |
|------|--------|
| `src/types/race.ts` | New types: `OffenceType`, `SanctionType`, `SeverityTier`, `AppliedPenalty`; `RaceIncident` discriminator extensions; `raceEnd` event extension |
| `src/types/driver.ts` | `PenaltyPointEntry`; four new persisted driver fields: `penaltyPoints`, `warningsThisSeason`, `nextRaceGridDrop`, `banUntilRound` |
| `src/data/drivers.ts` | 28 driver literals backfilled with the four new fields |
| `src/engine/race/race-simulator.ts` | `SimRaceState` transient fields for penalty engine; `simulateLap` call sites; race-end penalty fold |
| `src/engine/race/race-bootstrap.ts` | `applyBanSubstitution` and `applyGridDrops` helpers |
| `src/workers/race-sim-worker.ts` | Race-end fold + `raceEnd` event emission with `appliedPenalties` |
| `src/engine/core/post-race-processor.ts` | `currentSeason` parameter + penalty fold into driver state |
| `src/engine/core/orchestrator.ts` | Passes `currentSeason` to `processPostRace()` |
| `src/engine/core/save-system.ts` | `SCHEMA_VERSION = 8`; v7 → v8 migration |
| `src/stores/race-runtime-slice.ts` | `appliedPenaltiesByDriver` field |
| `src/stores/game-store.ts` | `consumeGridDrops` action |
| `src/hooks/use-race-simulation.ts` | Carries `appliedPenaltiesByDriver` through to consumers |
| `src/app/strategy/page.tsx` | Live-race Stewards card; post-race panel; pre-race ban substitution + grid drops in `handleStartRace` |
| `src/app/drivers/page.tsx` | Penalty Record section in driver detail view |

### Schema Migration

v7 → v8 adds four persisted fields to every `Driver` object:
- `penaltyPoints: PenaltyPointEntry[]` — rolling 22-round window of issued super-licence points; defaults `[]`.
- `warningsThisSeason: number` — driving-warnings counter, reset at season end and on threshold consumption; defaults `0`.
- `nextRaceGridDrop: number` — one-shot grid-position drop consumed by qualifying; defaults `0`.
- `banUntilRound: number | null` — null when not banned; defaults `null`.

Race-side penalty state (`pendingInvestigations`, `pendingTimePenalties`, `appliedPenaltiesByDriver`) is transient — lives exclusively in the worker's `SimRaceState` and `raceRuntime` slice, never written to IndexedDB.

Full details: `docs/architecture/persistence-contract.md` §5 v7→v8 entry.

### Testing Summary

- ~30 new tests across the five new test modules plus integration tests for ban substitution, grid drops, post-race fold, and determinism replay.
- Total test count on merge: 428 passed, 1 skipped.
- TypeScript compilation: clean (`npx tsc --noEmit`).
- ESLint: clean (`npm run lint`).

### Open Follow-ups (Deferred — Not Blocking)

| Item | Notes |
|------|-------|
| Tier B v2 — pit-adjacent offences | Separate brainstorm cycle when ready |
| Tier C v3 — track-state-adjacent offences | Separate brainstorm cycle when ready |
| `team.penaltiesTaken` (Factory PU card readout) | Separate workstream — race-weekend component-swap lifecycle; unrelated to driving penalties |
| OFFENCE_LABELS map duplicated in 3 UI components | Candidate for shared utility extraction in a future cleanup pass |
| `behindDriver2` variable name in `simulateLap` (Task 12) | Minor naming smell; candidate for cleanup |
| 9-11 risk band renders amber in post-race panel, red in Driver Office | Task 22 simplified the 4-band spec; reconcile if visual consistency matters |

---

## 4. Frozen Boundaries for Next Phases

These boundaries must be respected by all subsequent implementation phases:

### 4.1 Store Contract

- `gameStore` shape (`world`, `eventCooldowns`, `lastRaceResults`, `lastSeasonEnd`) is frozen.
- New fields may be added but existing fields must not be renamed or removed without migration.
- Store remains a thin dispatch layer — no business logic in store actions.

### 4.2 Orchestrator Contract

- `advanceGamePhase()`, `processPostRacePhase()`, `processSeasonEndPhase()` signatures are frozen.
- All orchestrator functions remain pure — no side effects, no store access, no browser APIs.
- New orchestrator functions may be added for new gameplay flows.

### 4.3 Engine Purity Invariant

- All modules under `src/engine/` must remain pure functions.
- Engines accept state + PRNG, return new state.
- No DOM, no `window`, no `fetch`, no `localStorage`, no Zustand imports.

### 4.4 Persistence Boundary

- Persistence remains decoupled from store actions.
- `setupPersistence()` subscriber pattern is the canonical auto-save mechanism; autosave fires on `world` reference change only.
- `useSaveGame()` hook is the canonical manual save/load mechanism.
- Schema versioning in `SaveSystem` must be maintained for forward compatibility via the `MIGRATIONS` map and `migrateToCurrent()` applied on load.
- All contract details live in `docs/architecture/persistence-contract.md`; any new persisted field must be reflected there.

### 4.5 Data Layer Contract

- `src/data/` files provide static 2026 season data.
- 11 teams, 22 grid drivers, reserve/F2 talent pool.
- 22 circuits, 22-race calendar with 6 sprint weekends.
- Data audit results are documented in `docs/data/2026-season-audit.md`.

### 4.6 Type Contracts

- `FullGameState` is the canonical world state type (defined in `state-manager.ts`).
- `RaceResult` and `SeasonEndResult` are the canonical result types.
- All types must remain JSON-serializable.

---

## Known stubs (IP-09b)

These store actions are intentional stubs added during the IP-09b Drivers page UI rebuild. They provide type-safe signatures for UI components without wiring game logic, which ships in a later phase.

- `gameStore.approachDriver(driverId)` — fires `console.info` only; no world mutation. Will be replaced when the free-agent negotiation flow ships.
- `gameStore.openContractNegotiation(driverId)` — same shape as above. Will be replaced when the contract renegotiation flow ships.
