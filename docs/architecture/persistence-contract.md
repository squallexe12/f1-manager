# Persistence Contract

**Frozen:** 2026-04-13 (IP-05)
**Last updated:** 2026-05-02 (Tier B v2 IP-B2 — schema v12, adds `team.pitCrewChief`, `team.pitCrewMembers`, `world.staffMarket`, `world.poachingAttempts` for the pit-crew staff system)
**Status:** Active

This document is the contract for what the game persists, what it does not, how autosave behaves, and how schema versions evolve. It is paired with the runtime code in `src/engine/core/save-system.ts`, `src/stores/persistence-setup.ts`, and `src/hooks/use-save-game.ts`.

---

## 1. Persisted vs Transient Store Fields

The game store exposes both durable world state and session-scoped runtime state. Only durable state crosses the IndexedDB boundary.

| Store field | Persisted? | Rationale |
|-------------|------------|-----------|
| `world` | ✅ Yes | Canonical `FullGameState` — teams, drivers, calendar, finance, narrative |
| `eventCooldowns` | ❌ No | Session-only cooldown bookkeeping; re-derived on first narrative tick |
| `lastRaceResults` | ❌ No | UI-only; regenerated from `world` or next race |
| `lastSeasonEnd` | ❌ No | UI-only; regenerated from `world` or next season end |
| `raceCommandBus` | ❌ No | In-memory command bus instance |
| `raceRuntime` | ❌ No | **Session-scoped race simulation** — see §4 |

Autosave writes only `world`. Manual save/load operates only on `world`. Every other store field is considered transient and is reset to its initial value on page load.

## 2. Autosave Trigger Rules

- The autosave subscriber lives in `setupPersistence()` and is installed once at app boot by `PersistenceProvider`.
- It subscribes to `useGameStore` and compares the current `world` reference against the previous one on every store update.
- **Trigger condition:** `state.world !== prevWorld` AND `state.world` is non-null.
- Because Zustand always produces a new `world` object when any world-mutating action runs, this fires exactly once per world mutation.
- The subscriber never inspects `raceRuntime`, `eventCooldowns`, `lastRaceResults`, or `lastSeasonEnd`. These fields do not cause autosave writes even when they change.
- Errors are surfaced via `subscribeAutosaveStatus()` and logged to the dev console. They are never thrown into the store.

### No Debounce Required

Because `world` only mutates on discrete user actions (phase advance, R&D allocation, contract resolution, etc.) and never on lap ticks, there is no write amplification to defend against. A debounce would be needed only if Option B (race slice inside `world`) had been chosen in IP-04 — it was not.

## 3. Manual Save/Load

Manual operations go through `useSaveGame()` and write/read the same IndexedDB store.

| Operation | Slot target | Effect |
|-----------|-------------|--------|
| `saveGame(slotId, name)` | any named slot | Writes current `world` with `schemaVersion = SCHEMA_VERSION` |
| `loadGame(slotId)` | any named slot | Replaces `world`, `lastRaceResults`, `lastSeasonEnd`; leaves `raceRuntime` alone |
| `listSaves()` | all slots | Returns `SlotInfo[]` including `schemaVersion` |
| `deleteSave(slotId)` | any named slot | Removes record |
| `exportSave(slotId)` | any named slot | Returns JSON string of inner `FullGameState` only |
| `importSave(slotId, name, json)` | any named slot | Writes JSON payload into a slot at current schema version |

Autosave uses the dedicated `AUTO_SAVE_SLOT` slot id (`'auto-save'`). Manual saves may use any other slot id; overwriting autosave via manual save is allowed but not recommended.

## 4. Race Runtime Interaction (IP-04 Option A)

**Decision:** The race runtime slice lives **outside** `world`. See `docs/architecture/current-state-baseline.md` §3.1.

**Persistence consequences:**
- The autosave subscriber watches `world` by reference. `raceRuntime` is a sibling field and changing it never triggers a save.
- Mid-race page reloads return the player to the pre-race strategy screen. Resuming a race in progress is not supported.
- Post-race state (final results, standings, finance) flows into `world` via `submitRaceResults()` and is therefore persisted normally.
- No schema migration was required for IP-05.

**Tier 2 mid-race resume is out of scope.** Implementing it would require a separate snapshot schema and its own migration path; it does not retrofit into this contract.

## 5. Schema Versioning

`SaveSystem` declares `SCHEMA_VERSION` in `src/engine/core/save-system.ts`. Every `SaveRecord` written includes the version that produced it.

### Current state
- `SCHEMA_VERSION = 12`
- `MIGRATIONS = { 1: v1→v2, 2: v2→v3, 3: v3→v4, 4: v4→v5, 5: v5→v6, 6: v6→v7, 7: v7→v8, 8: v8→v9, 9: v9→v10, 10: v10→v11, 11: v11→v12 }`
  - v1→v2 adds `recommendations: []` and `stagedStrategies: {}` to `FullGameState` (IP-08). Both are repopulated on the next `processManagementEntry()` so legacy saves remain playable.
  - v2→v3 hydrates Paddock hero fields introduced by the Paddock redesign. On each `team`: `previousConstructorPosition` ← 0, `previousMorale` ← current `morale`, `seasonForm` ← `[]`, and every `staff[*].contractEndSeason` ← `gameState.season + 3`. On each `driver`: `form` ← `[]`, `lastRaceResult` ← `null`, `seasonStats.poles` ← 0. First-round trend deltas render as zero; subsequent rounds populate from `processPostRace()`.
  - v3→v4 adds `lastProcessedRound: 0` idempotency markers on every `team` and `driver.seasonStats`, and repairs corrupted stats on legacy saves. Any driver whose `podiums`, `wins`, or `points` exceeds the mathematical per-round ceiling (modern F1 points: 26 pts/race/driver, 44 pts/race/team) has `seasonStats` zeroed; the team's `constructorPoints`, `seasonForm`, and `previousConstructorPosition` are reset in sync. Uncorrupted saves are left untouched.
  - v4→v5 adds `team.headquarters: string` — the factory city surfaced on the Factory page header. Existing saves back-fill from a canonical 2026-grid map keyed by `team.id` (McLaren → Woking, Red Bull → Milton Keynes, etc.); unknown ids fall back to the team's `shortName` so the property is always a non-empty string. No runtime behaviour changes — purely additive.
  - v5→v6 adds `team.ovrHistory: number[]` (rolling OVR rating window, capped at `OVR_HISTORY_WINDOW` = 12 entries) and `team.lastUpgradeRound: number` (round of the most recent R&D completion, 0 when none). Both default to empty/zero on migration; existing values are preserved when present. `processPostRace()` appends to `ovrHistory` under the same `lastProcessedRound` idempotency guard as `seasonForm`, and the orchestrator stamps `lastUpgradeRound` on any team whose `rndUpgrades` flip from non-complete to complete during `processManagementEntry`. Season-end (`processSeasonEnd()`) resets both back to empty/zero for every team.
  - v6→v7 expands `ComponentAllocation.element` from 4 values to 5 by adding `'mgu-k'`. For every team, the migration inserts the element if missing in canonical order (ICE → TURBO → MGU-K → ERS BATTERY → GEARBOX) with a default `{ used: 0, limit: 4, failureProbability: 0.03 }` row. Any legacy `'mgu-h'` row from a pre-release v7 development save is dropped (MGU-H was removed by the 2026 regulation — see CLAUDE.md §7). Existing canonical rows are preserved verbatim; a save that already carries all five rows is a no-op.
  - v7→v8 adds four persisted driver fields for the IP-09 Penalty System Tier A. On every `driver`: `penaltyPoints` ← `[]` (rolling 22-round window of issued super-licence points; each entry is a `PenaltyPointEntry`), `warningsThisSeason` ← `0` (driving-warnings counter, resets at season end and on threshold consumption), `nextRaceGridDrop` ← `0` (one-shot grid-position drop consumed by qualifying, 0 when none pending), `banUntilRound` ← `null` (null when not banned). Existing driver fields are preserved verbatim. Race-side penalty state (`pendingInvestigations`, `pendingTimePenalties`, `appliedPenaltiesByDriver`) is transient — it lives exclusively in the worker's `SimRaceState` and is never written to IndexedDB. `RaceResult.appliedPenalties` flows through `lastRaceResults` (transient, session-scoped) and is consumed by `processPostRace()` to update the four persisted fields above.
  - v8→v9 adds two persisted team rolling buffers for the Factory Box 1 — Car Performance real-data wiring. On every `team`: `fastestLapHistory` ← `[]` (FIFO-capped at 6 entries, each `FastestLapEntry { round, lapMs }`; appended by `processPostRace()` for the team whose driver held the absolute race-wide fastest lap that round; cleared at season end) and `failureEvents` ← `[]` (FIFO-capped at 10 entries, each `FailureEvent { round, lap, element, driverId }`; reserved for future MTBF wiring — `checkMechanicalFailure()` is defined but not yet invoked by the simulator; cleared at season end). Existing team fields preserved verbatim. The `deltaVsLeaderFromHistory()` and `mtbfFromFailureLog()` derivations in `src/engine/engineering/car-performance-insights.ts` consume both buffers; both fall back to existing heuristics in `factory-insights.ts` when the buffer doesn't yet have enough data.
  - v9→v10 adds two persisted team fields for the Factory Box 2 — Power Unit strategy. On every `team`: `penaltiesTaken` ← `0` (running season counter, increments when an elected swap pushes a team-shared element past its season limit) and `pendingComponentSwaps` ← `[]` (queued player elections; each entry names the driver who pays the grid penalty if applicable). Existing team fields preserved verbatim. The grid penalty is folded into the existing Tier A `driver.nextRaceGridDrop` channel at the management → practice transition by `applyPendingSwaps()` in `src/engine/engineering/component-strategy.ts`. Both fields reset at season end.
  - v11→v12 adds the pit-crew staff schema for Tier B v2. On every `team`: `pitCrewChief` ← `null` (single hired chief slot, populated via `gameStore.hireStaffChief()`), `pitCrewMembers` ← `[]` (six-member roster keyed by `PitCrewRole`, populated via `gameStore.hireStaffMember()`). At the world level: `staffMarket` ← `{ chiefs: [], members: [], lastRefreshedSeason: 0 }` (deterministic procgen pool generated by `generateTalentPool(seed, season, DEFAULT_STAFF_POOL_SIZE)` at `initializeGame()` time), `poachingAttempts` ← `[]` (open AI counter-offer attempts, logic ships IP-B3). Existing fields preserved verbatim. **IP-B2 reads stay neutral 70/70/70 in the race-simulator** — the engine does not yet consume `aggregateCrewRatings(chief, members)`, so legacy saves run with identical race outcomes until IP-B3 wires the connection. All four fields reset at season end via `processSeasonEnd()` only for poaching attempts; chief and members stay across seasons (career arcs).
  - v10→v11 adds two persisted team buffers and back-fills two cost fields onto every `RndUpgrade` row for the Factory Box 3 — Aero Testing real-data wiring. On every `team`: `aeroBookings` ← `[]` (FIFO-capped at 14 entries, each `AeroBooking { day, wtHours, cfdRuns }`; appended once per management cycle with the cycle's actual WT/CFD spend; cleared by `resetAeroWindow()` when `windowResetsIn(currentRound) === 0` and again at season end) and `upgradeOutcomes` ← `[]` (FIFO-capped at 3 entries, each `UpgradeOutcome { upgradeId, deliveredRound, predictedOvrDelta, ovrAtDelivery, actualOvrDelta }`; appended by `processManagementEntry()` when an upgrade flips from non-complete → complete via `snapshotUpgradePrediction()`; `actualOvrDelta` filled by `measureUpgradeOutcome()` in `processPostRace()` after the first race strictly later than `deliveredRound`; cleared at season end). On every `team.rndUpgrades[i]`: `wtHoursPerCycle` and `cfdRunsPerCycle` back-fill from `DEFAULT_WT_HOURS_PER_CYCLE` (2) and `DEFAULT_CFD_RUNS_PER_CYCLE` (80) when missing — conservative defaults so legacy in-progress upgrades do not exceed the team's CDT budget on first load. Existing values are preserved verbatim. The `correlationDeltaFromOutcomes()` helper in `src/engine/engineering/aero-budget.ts` consumes `upgradeOutcomes`; the Factory aero-card histograms consume `aeroBookings`. Both fall back to existing heuristics when the buffers are sparse.

### On load
`loadFromSlot(slotId)` calls `migrateToCurrent(data, record.schemaVersion ?? 1)` before returning. For v1 saves this is a pass-through. If a save claims a newer version than the runtime knows, `migrateToCurrent` throws — the UI should surface this as an unsupported save rather than attempt to load.

If any migration runs, the upgraded payload is re-written into the same slot so subsequent loads are version-stable.

### Adding a new schema version

When a future change requires a shape bump:

1. Increment `SCHEMA_VERSION` by one (e.g., `1 → 2`).
2. Add a `MIGRATIONS[1] = (data) => { ...upgrade logic... }` entry that converts a v1 payload into a v2 payload.
3. The migration must be pure and idempotent.
4. Add a test covering:
   - loading a v1 save at the new runtime version produces the expected v2 shape,
   - the migrated payload is written back at the new version,
   - a save that claims a version newer than `SCHEMA_VERSION` throws.
5. Update this document's "Current state" section.

Migrations must never silently drop fields. If a field is being removed, the migration should move it to a deprecated namespace or explicitly discard it with a comment.

## 6. Failure Handling

| Failure | Behavior |
|---------|----------|
| Autosave IndexedDB write fails | Caught, logged in dev, surfaced via `getAutosaveStatus()` / `subscribeAutosaveStatus()`. Gameplay continues. |
| Manual save fails | `useSaveGame().status.lastError` is set; `isSaving` returns to false. |
| Manual load fails (missing slot) | Throws inside the hook; error is caught and exposed as `status.lastError`. Store is untouched. |
| Load encounters unsupported schema version | `migrateToCurrent` throws; caught as a manual-load error. |
| `saveSystem` is null (SSR / non-browser) | All hook operations become no-ops. |

## 7. Test Coverage

Authoritative tests for this contract:

- `tests/engine/core/save-system.test.ts` — save/load/list/delete/export/import and migration entry point.
- `tests/stores/persistence-setup.test.ts` — autosave fires on `world` change only; race runtime changes do not trigger writes; error path updates status.
- `tests/hooks/use-save-game.test.ts` — save/load/delete status transitions.

Run the full suite with:

```
npx vitest run tests/engine/core tests/data tests/stores tests/hooks
```

## 8. Boundaries

- Persistence code never imports from `src/components/**` or any React-tree module.
- The store has no awareness of IndexedDB. It does not import from `save-system.ts` directly; only `persistence-setup.ts` does.
- Engine modules under `src/engine/` (except `save-system.ts` itself) never touch persistence.
- New store fields default to "transient" unless this document is updated to move them into §1 as persisted.
