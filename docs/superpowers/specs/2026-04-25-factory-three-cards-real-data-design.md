---
date: 2026-04-25
status: approved-by-user; paused before spec-review loop and writing-plans handoff
project: f1-simulation
predecessors:
  - docs/superpowers/specs/2026-04-25-race-penalty-system-tier-a-design.md (Tier A penalty system — shipped)
target-area: src/app/factory + src/components/factory + src/engine/engineering
schema-impact: v8 → v11 (three additive migrations, one per phase)
---

# Factory — Three Hero Cards: Real Data Wiring Design

## 1. Problem statement

The Factory page (`/factory`, `R&D Command`) shows three hero cards above the R&D pipeline:

1. **Car Performance** (radar + 6-race trend + footer KPIs)
2. **Power Unit** (component allocation + projected grid loss + penalties taken)
3. **Aero Testing** (wind tunnel + CFD + ATR coefficient + correlation Δ)

Audit of the current state found a mix of real and synthetic data per card:

| Card | Real | Heuristic / Hardcoded / Synthetic |
|---|---|---|
| Car Performance | OVR, 6 axes, peer averages, peer rank, 6-race trend, last upgrade round | **Δ vs Leader** (OVR diff × 0.03s), **Reliability MTBF** (formula from reliability + average wear) |
| Power Unit | Component limits, derived next-change, derived projected grid loss | **`used` counters never tick** (no race weekend calls `useComponent`), **`penaltiesTaken` hardcoded `0`** in `factory/page.tsx:114` |
| Aero Testing | WT/CFD limits, ATR coefficient (real F1 sliding scale), next delivery round | **`used` counters never tick** (always 0), **daily booking histogram is `deterministicAeroHistory()` hash**, **correlation Δ is teamId+round hash** |

User requirement: *every piece of data must be accurate and must update after each race or whenever a part is upgraded at the factory.* This spec wires real backend behavior behind all three cards.

## 2. Approach

**Single design spec, three sequenced implementation phases.** Each phase is self-contained — ships, can be played, then the next phase begins.

**Player-agency mode: Hybrid.**

- **Box 1 (Car Performance) — Observer.** Card displays truth from the simulation; no new player decisions.
- **Box 2 (Power Unit) — Agent.** Adds a pre-weekend Component Strategy decision (player elects to introduce a fresh element this round, accepting grid penalty here vs. risking forced swap later).
- **Box 3 (Aero Testing) — Observer.** Card displays truth from real WT/CFD consumption tied to in-progress R&D upgrades; no new player decisions (consumption is automatic per upgrade).

## 3. Phasing

| Phase | Scope | Schema |
|---|---|---|
| **Phase 1 — Box 1** | Wire Δ vs Leader (3-race fastest-lap rolling buffer) and MTBF (failure-event log, with heuristic fallback). | v8 → v9 |
| **Phase 2 — Box 2** | Per-race component wear tick. Pre-weekend swap-election decision. Penalty integration via existing Tier A `gridPenalties[driverId]` channel. New PU strategy sub-section in Factory UI. `penaltiesTaken` counter. | v9 → v10 |
| **Phase 3 — Box 3** | Per-cycle WT/CFD consumption tied to in-progress upgrades (with stall-on-overage). Real per-day aero booking ledger (last 14 entries). Correlation Δ from predicted-vs-actual upgrade gain. | v10 → v11 |

Order rationale: Phase 1 is smallest (no UI change, two new rolling buffers, fastest visible win). Phase 2 has highest gameplay impact and depends on Tier A penalties (already shipped). Phase 3 has the largest state additions and touches `processRnDCycle`, so it lands after Phases 1–2 are stable.

## 4. Per-box mechanics

### 4.1 Box 1 — Car Performance (Observer)

**Δ vs Leader.** Rolling 3-race average of fastest-lap deltas. Each race recorded as `FastestLapEntry { round, lapMs }` for any team whose drivers held the **absolute race-wide fastest lap** that round (i.e. the `runtime.fastestLap` the race worker already produces). For each round in the player's last 3 entries, compute `playerLapMs − leaderLapMs` against the championship leader's same-round entry; average those deltas. Falls back to today's `OVR diff × 0.03s` heuristic when the player has fewer than 3 entries (or when overlapping rounds with the leader are < 3). A team that never held the race-wide fastest lap accumulates no entries — for those teams the heuristic fallback is permanent until they post a race-wide fastest.

**Reliability MTBF.** Based on a season failure-event log:
- `failureEvents.length >= 2` → average laps-between-failures from the log.
- `< 2` → today's heuristic, but fed *real per-element wear ratios* (not the average). A single nearly-dead ICE drags the number down even if the rest is fresh.

**Update triggers:** Δ vs Leader updates after each post-race fastest-lap capture. MTBF updates whenever component wear ticks (each race) or a failure event lands.

### 4.2 Box 2 — Power Unit (Agent)

**Wear rule.** Each completed race ticks `used + 1` for every PU element (ICE, Turbo, MGU-K, ERS, Gearbox). Matches real F1 1:1. With current limits 4/4/4/3/4, a 24-race season forces ~5 ICE introductions — the player chooses *when*.

**Swap decision flow (pre-weekend election).** Each round in the management phase, the Factory PU card shows a *Component Strategy* sub-section. A swap row renders for any driver × element where **`used + 1 >= limit`** — i.e. the next race introduction will hit or exceed the season limit. Visual treatment:
- `used + 1 == limit` → **warning band** (last "free" introduction available; no penalty if elected now).
- `used + 1 > limit` → **danger band** (next introduction will incur a grid penalty).

Per row the player can:
- **Stay on current** → free, no immediate cost.
- **Introduce new now** → +1 fresh element this weekend. If post-increment `used > limit`, grid penalty applies to *this* upcoming race (fed into existing Tier A `gridPenalties[driverId]` channel). `penaltiesTaken` increments by one for each penalty-incurring election.

The player gets a real strategic decision: burn a fresh PU at a high-overtake circuit (Spa, Monza) where the grid penalty hurts less, vs. saving a fresh element for a circuit where overtaking is hard (Monaco, Hungary).

**"Penalties Taken"** = season counter incremented when the player elects a swap that triggers a penalty.
**"Projected Grid Loss"** = penalty if the player elected the swap *right now* (uses `projectedGridLossIfElectedNow()`).

**Update triggers:** counters update on every race start (when `applyPendingSwaps()` runs) and every post-race tick (when wear advances).

### 4.3 Box 3 — Aero Testing (Observer)

**WT / CFD consumption.** Each in-progress R&D upgrade has a `wtHoursPerCycle` and `cfdRunsPerCycle` cost. When `processRnDCycle()` runs each management cycle, costs are deducted from `team.windTunnelHoursUsed` and `team.cfdRunsUsed`.

**Stall-on-overage.** If a deduction would push `used > limit` for the current 14-day CDT window, that upgrade *stalls* this cycle (no progress, no spend) until the window resets. Stalled upgrades surface a `BUDGET STALL` badge on the R&D queue. This finally makes FIA testing restrictions matter in the simulation — today the limits are decorative.

**Stall tie-breaking (determinism contract).** When several in-progress upgrades each individually fit but collectively overflow the budget, deductions are processed in a deterministic order: ascending lexical sort of `upgrade.id`. Upgrades that fit are charged in order; the first upgrade whose deduction would push over the limit (and every later upgrade in the order, regardless of individual fit) stalls this cycle. Tie-breaking by `id` is stable across replays — required for the determinism gate (§8).

**Per-day booking ledger.** Real persisted ledger: `team.aeroBookings: AeroBooking[]` with at most 14 entries, one per day in the current CDT window. Appended every management cycle. Cleared when the window resets.

**Correlation Δ.** Predicted-vs-actual upgrade gain:
- When an upgrade flips to `complete`, snapshot `predictedOvrDelta = sum(performanceDelta)` and the team's pre-race OVR; record `deliveredRound = currentRound`.
- "First race after delivery" = the **first completed race round strictly greater than `deliveredRound`** (so an upgrade that completes during the management cycle preceding round N is measured against round N's outcome).
- After that race, snapshot `actualOvrDelta` (post-race OVR minus the OVR at delivery — already trackable via `ovrHistory`).
- `correlationDelta = avg((actual - predicted) / predicted × 100)` over the last 3 measured outcomes. Bounded ±10%.
- Falls back to today's hash-based `correlationDelta()` when no measured outcomes exist yet.

**Update triggers:** WT/CFD bars update each management cycle. Booking histogram updates each management cycle. Correlation Δ updates after the first race following each upgrade delivery.

## 5. Data model & migrations

Three additive migrations. Every new field defaults sensibly so existing saves load clean.

### 5.1 Phase 1 — Schema v8 → v9 (Box 1)

```ts
// src/types/team.ts — additions to Team
fastestLapHistory: FastestLapEntry[]   // last 6 entries (one per recent race)
failureEvents: FailureEvent[]          // last 10 entries this season

// src/types/race.ts — new types
interface FastestLapEntry {
  round: number
  lapMs: number
}

interface FailureEvent {
  round: number
  lap: number
  element: ComponentElement   // 'ice' | 'turbo' | 'mgu-k' | 'ers-battery' | 'gearbox'
  driverId: string
}
```

Migration: both initialized to `[]`. Pruning policy:
- `fastestLapHistory`: rolling buffer, keep most recent 6 entries (FIFO trim on append). Cleared at season-end.
- `failureEvents`: rolling buffer, keep most recent 10 entries (FIFO trim on append). Cleared at season-end.

Both buffers apply both rules — rolling cap during the season *and* full clear when `season-end-processor` runs.

### 5.2 Phase 2 — Schema v9 → v10 (Box 2)

```ts
// src/types/team.ts — additions to Team
penaltiesTaken: number                          // running season total
pendingComponentSwaps: PendingComponentSwap[]   // elections queued for the upcoming race

// src/types/team.ts — new type
interface PendingComponentSwap {
  driverId: string
  element: ComponentElement
  electedRound: number
}
```

Migration: `penaltiesTaken: 0`, `pendingComponentSwaps: []`. Reset both at season-end (existing season-end-processor branch).

### 5.3 Phase 3 — Schema v10 → v11 (Box 3)

```ts
// src/types/team.ts — additions to Team
aeroBookings: AeroBooking[]              // last 14 daily entries (CDT window)
upgradeOutcomes: UpgradeOutcome[]        // last 3 delivered upgrades

// src/types/team.ts — new types
interface AeroBooking {
  day: number              // ordinal day index inside current 14-day CDT window
  wtHours: number
  cfdRuns: number
}

interface UpgradeOutcome {
  upgradeId: string
  deliveredRound: number
  predictedOvrDelta: number
  actualOvrDelta: number | null   // null until first race after delivery
}

// src/types/team.ts — additions to RndUpgrade (static data, not a save migration)
wtHoursPerCycle: number       // 0 for non-aero upgrades
cfdRunsPerCycle: number       // 0 for non-PU/aero upgrades
```

Migration: `aeroBookings: []`, `upgradeOutcomes: []`. `RndUpgrade` cost fields are static-data (ship with code); existing in-progress upgrades on old saves get default `wtHoursPerCycle: 2, cfdRunsPerCycle: 80` injected at load time.

### 5.4 Persistence-contract update

`docs/architecture/persistence-contract.md` §1 gets six additions: `fastestLapHistory`, `failureEvents`, `penaltiesTaken`, `pendingComponentSwaps`, `aeroBookings`, `upgradeOutcomes`. All are persisted (part of `world.teams[i]`). None go into `raceRuntime`.

### 5.5 Save-system migrations

```ts
// src/engine/core/save-system.ts
const MIGRATIONS: Record<number, (state: AnyState) => AnyState> = {
  // ...existing migrations 1..7 (penalty Tier A)...
  8: migrateV8ToV9,    // Phase 1 — add fastestLapHistory + failureEvents
  9: migrateV9ToV10,   // Phase 2 — add penaltiesTaken + pendingComponentSwaps
  10: migrateV10ToV11, // Phase 3 — add aeroBookings + upgradeOutcomes
}
```

Current `SCHEMA_VERSION` (as of 2026-04-25) is `8` after the penalty Tier A migration shipped in commit fb6fad7. Phase 1 bumps it to `9`, Phase 2 to `10`, Phase 3 to `11`.

All migrations are strictly additive — no field renames, no removals. The existing migration test pattern in `tests/engine/core/save-system.test.ts` covers all three.

## 6. Layer changes

### 6.1 Engine layer (`src/engine/**`)

#### Phase 1 — Box 1

**New module:** `src/engine/engineering/car-performance-insights.ts`
- `deltaVsLeaderFromHistory(teams, playerTeamId): number` — average of last 3 fastest-lap deltas to championship leader; OVR-fallback when `< 3` entries.
- `mtbfFromFailureLog(team): number` — failure-log average when `>= 2` events, heuristic fallback otherwise.

**`post-race-processor.ts`:**
- Append one `FastestLapEntry` per team per race. The team's entry is built from the *single absolute fastest lap of the race* — the worker already produces `fastestLap: { driverId, time }` in the race runtime; we plumb that through. Trim to last 6.
- Append `FailureEvent` rows when a race retirement was triggered by `checkMechanicalFailure()`. Trim to last 10.

**Plumbing for the fastest-lap time (implementation contract).** Today `RaceResult.fastestLap` is a `boolean` — only the bonus-points flag flows into `processPostRace`. The actual time lives in `runtime.fastestLap: { driverId, time }` (race-slice / `use-race-simulation` hook output) and is dropped at the post-race boundary. Phase 1 plumbs it through:
1. Add a new parameter `fastestLap: { driverId: string; time: number } | null` to `processPostRace(...)` *after* the `results` parameter (keeping `RaceResult` shape unchanged — fewer downstream callers to update).
2. Update the orchestrator/strategy-page call site (the single point that currently invokes `processPostRace`) to pass `runtime.fastestLap` through.
3. Inside `processPostRace`, for each team: if `fastestLap.driverId` belongs to one of the team's drivers, append an entry with `lapMs: fastestLap.time`; otherwise the team gets no entry this round (its sparkline shows the prior 6 entries).
4. The team-level entry uses the absolute fastest race lap if it belonged to one of their drivers — there is no per-team fastest-lap aggregation across both drivers, since the worker only tracks the single race-wide fastest.

Rationale: avoids changing the per-driver `RaceResult` shape (no migration to dozens of test fixtures, no broader protocol change), keeps `processPostRace` pure (it just receives one extra optional arg), and surfaces the data already produced by the worker rather than recomputing.

**`factory-insights.ts`:** existing `deltaVsLeaderSeconds` and `reliabilityMtbf` kept as fallbacks; the Factory page calls the new `*Insights` versions and routes to fallbacks itself when data is sparse.

#### Phase 2 — Box 2

**New module:** `src/engine/engineering/component-strategy.ts`
- `electComponentSwap(team, driverId, element, currentRound): Team` — pure; appends to `pendingComponentSwaps` (idempotent).
- `applyPendingSwaps(team, currentRound): { team, gridPenaltyByDriver }` — drains queue, increments `components[element].used`, computes per-driver grid penalty, increments `penaltiesTaken` for each penalty-incurring swap.
- `tickComponentWear(team): Team` — increments `used + 1` for every element. Called from post-race processor.
- `projectedGridLossIfElectedNow(team, driverId): number` — pure projection helper for the UI.

**`orchestrator.ts`:** at race start (management → practice transition), call `applyPendingSwaps()` per team and merge the resulting penalty map into the existing pre-race `gridPenalties[driverId]` channel that Tier A consumes.

**`post-race-processor.ts`:** call `tickComponentWear()` once per team per race.

**Dual-write ordering for `components[element].used` (implementation contract).** Two distinct triggers write to the same field; they must not be conflated:

| Trigger | Writer | Semantics | Increments which elements |
|---|---|---|---|
| Race start (management → practice) | `applyPendingSwaps` | Counts the *fresh introduction* the player elected | Only elements present in `pendingComponentSwaps` for that driver |
| Race end (post-race processor) | `tickComponentWear` | Counts the *natural wear* of finishing a race | Every PU element on every team |

`applyPendingSwaps` runs first (race start). `tickComponentWear` runs last (post-race). An element that was freshly introduced this weekend is therefore incremented twice in that round: once on introduction, once on race wear. This is the spec's accepted abstraction — `used` is a generic season-allocation counter where both the *introduction event* and the *act of completing a race* consume one unit. Penalty triggering is computed only by `applyPendingSwaps` (when introduction pushes `used > limit`); `tickComponentWear` never triggers a penalty by itself, even if its increment crosses the limit. Crossing the limit via wear simply elevates failure probability for the next race until the player elects a fresh introduction.

#### Phase 3 — Box 3

**New module:** `src/engine/engineering/aero-budget.ts`
- `consumeAeroBudget(team, currentDay): { team, stalledUpgradeIds }` — deducts `wtHoursPerCycle` / `cfdRunsPerCycle` for each in-progress upgrade. Stalls upgrades that would push `used` over `limit`. Appends to `aeroBookings`, prunes to 14.
- `resetAeroWindow(team): Team` — zeroes `windTunnelHoursUsed` / `cfdRunsUsed`, clears `aeroBookings`. Called when `windowResetsIn(currentRound) === 0`.
- `snapshotUpgradePrediction(team, upgradeId): UpgradeOutcome | null` — called by `rnd-engine` on upgrade completion.
- `measureUpgradeOutcome(team, lastRaceOvr): Team` — fills `actualOvrDelta` for outcomes with `null`.
- `correlationDeltaFromOutcomes(team): number` — averages `(actual - predicted) / predicted × 100`; bounded ±10%; falls back to existing hash-based `correlationDelta()` when no measured outcomes.

**`rnd-engine.ts`:** `processRnDCycle()` now takes the team (not just upgrades) so it can check the stall list. Stalled upgrades skip their progress tick this cycle.

### 6.2 Store layer (`src/stores/`)

Phase 2 is the only phase that adds an action.

```ts
// src/stores/game-store.ts
electComponentSwap: (driverId: string, element: ComponentElement) => void
```

Implementation: thin dispatch into `electComponentSwap()` from the engine. Zero business logic in the action.

`raceRuntime` is **untouched** by this work. All new state lives under `world.teams[i]`.

### 6.3 UI layer (`src/components/factory/**`)

#### Phase 1 — Box 1
- `car-performance-card.tsx` — no prop changes. Factory page passes new derived values from `car-performance-insights.ts` instead of `factory-insights.ts`.

#### Phase 2 — Box 2
- `power-unit-card.tsx` — gains a *Component Strategy* sub-section. Per driver × element near limit, render a row:
  ```
  HAMILTON · ICE · 3/4 USED   [INTRODUCE NEW · −10 PL]   STAY
  ```
  Click "INTRODUCE NEW" → store action `electComponentSwap(driverId, element)`. Once elected, row shows `ELECTED · APPLIES R{N+1}` with an "UNDO" affordance until race start.
- Footer: `Penalties Taken` reads `team.penaltiesTaken` (no longer hardcoded). `Projected Grid Loss` uses `projectedGridLossIfElectedNow()`.

#### Phase 3 — Box 3
- `aero-card.tsx` — no shape change. Factory page passes:
  - `wtDaily` from `team.aeroBookings.map(b => b.wtHours / DAILY_BUDGET)` (real ratios).
  - `cfdDaily` similarly.
  - `correlationDelta` from `correlationDeltaFromOutcomes()` instead of the hash.
- `rd-queue.tsx` — adds a `BUDGET STALL` badge on stalled upgrades.

## 7. Update matrix (single-source-of-truth contract)

Every value in the three cards updates only via these triggers. No more synthetic hashes, no more hardcoded zeros.

| Update trigger | Box 1 | Box 2 | Box 3 |
|---|---|---|---|
| Upgrade completes | OVR axes (existing) | — | `UpgradeOutcome.predictedOvrDelta` snapshot |
| Race start | — | `applyPendingSwaps` → grid penalties + `penaltiesTaken++` | — |
| Race end (post-race) | `fastestLapHistory` append, `failureEvents` append, OVR sample (existing) | `components.used += 1` per element | `measureUpgradeOutcome` fills `actualOvrDelta` |
| Management cycle | — | — | `consumeAeroBudget` ticks WT/CFD, may stall, appends `aeroBookings` |
| CDT window boundary | — | — | `resetAeroWindow` clears WT/CFD used + `aeroBookings` |
| Player elects swap | — | `pendingComponentSwaps` append, projected grid loss recomputed | — |

## 8. Testing plan

Per AGENTS.md, every layer has its test discipline. Full suite must stay green across all three phases.

### Phase 1 tests
- `tests/engine/engineering/car-performance-insights.test.ts` (new) — fallback / averaging logic, edge cases.
- `tests/engine/core/post-race-processor.test.ts` (extend) — buffer append + pruning.
- `tests/engine/core/save-system.test.ts` (extend) — v8 → v9 migration round-trip.

### Phase 2 tests
- `tests/engine/engineering/component-strategy.test.ts` (new) — idempotent election, correct penalty arithmetic, idempotent counter increment, projection matches application.
- `tests/engine/core/orchestrator.test.ts` (extend) — management → practice drain merges penalties; non-penalty swap doesn't increment counter.
- `tests/engine/core/post-race-processor.test.ts` (extend) — every team's every element ticks `+1` per race.
- `tests/stores/game-store.test.ts` (extend) — `electComponentSwap` thin dispatch + idempotency.
- `tests/engine/core/save-system.test.ts` (extend) — v9 → v10 migration.
- Tier A regression — re-run penalty engine tests to confirm new penalty source doesn't break flow.

### Phase 3 tests
- `tests/engine/engineering/aero-budget.test.ts` (new) — consumption math, stall logic, ledger pruning, prediction snapshot, outcome measurement, correlation averaging with fallback.
- `tests/engine/engineering/rnd-engine.test.ts` (extend) — stalled upgrade doesn't progress; resumes next cycle if budget recovers.
- `tests/engine/core/post-race-processor.test.ts` (extend) — `actualOvrDelta` populated after first race post-delivery.
- `tests/engine/core/save-system.test.ts` (extend) — v10 → v11 migration with default cost injection.

### Determinism gate (HARD)
None of these phases touches `src/engine/race/**`, but per AGENTS.md the determinism replay test must remain byte-identical for the same seed. All new helpers (`consumeAeroBudget`, `applyPendingSwaps`, `tickComponentWear`) are deterministic — no PRNG.

Per-phase determinism check: run a full season with fixed seed before and after the phase lands, assert `world.teams` is byte-identical given the same player decisions.

### Validation gates per phase
Each phase must pass before the next begins:
1. `npx tsc --noEmit` — clean.
2. `npx vitest run` — full suite green.
3. `npm run lint` — no new violations.
4. Determinism replay (full season same seed) — byte-identical.
5. Manual playthrough — start a season, play 3 races, verify the relevant card's numbers are real.

## 9. Out-of-scope (locked exclusions)

- **Per-component-instance tracking.** ICE counter stays as `{used, limit}`, not `[ICE#1, ICE#2, ...]`.
- **Circuit-stress wear model.** Each race ticks `+1` per element regardless of circuit characteristics.
- **Manual WT / CFD allocation UI.** Consumption is automatic per in-progress upgrade. Player allocates by choosing which upgrades to start, not by hour.
- **Mid-race component swap.** Swap election is pre-weekend only; no in-race tactical swap.
- **Agent surfaces on Box 1 or Box 3.** Both stay observer-only.
- **R&D race comparison surface.** No team-vs-team predicted-vs-actual visualization for AI teams.
- **Real F1 sliding-window CDT spec.** ATR window stays 14 days; the FIA's exact rolling-window math is approximated.

## 10. Resume notes (paused 2026-04-25)

Status at pause: design **approved by user, all five sections green-lit**.

Resume from: invoke spec review loop (spec-document-reviewer subagent on this file), fix any findings, then user-review the spec, then invoke `superpowers:writing-plans` to create the implementation plan for Phase 1 (Box 1).

When resuming, the user only needs to be re-shown:
1. The phasing table (§3) so they remember the sequence.
2. The Phase 1 scope (§4.1, §5.1, §6 Phase 1 sections, §8 Phase 1 tests) — the smallest, fastest visible win.

No design re-litigation needed; the five sections were each approved on their own turn.
