# Data Layer Architecture: Mission Control — F1 Kinetic Command

**Date:** 2026-04-04
**Status:** Draft
**Scope:** IndexedDB schema, engine interfaces, serialization, worker protocol, API readiness, performance budgets

---

## 1. IndexedDB Schema Design

### 1.1 Database Definition

Database name: `mission-control-f1`
Library: `idb` (typed wrapper over raw IndexedDB API)

### 1.2 Object Stores

| Store | Key Path | Description |
|-------|----------|-------------|
| `saves` | `id` (string) | Full game state snapshots. IDs: `slot-1`, `slot-2`, `slot-3`, `auto` |
| `save-meta` | `id` (string) | Lightweight metadata for save list screen (no full state blob) |
| `settings` | `key` (string) | User preferences: sim speed, high contrast, reduced motion |
| `cache` | `key` (string) | Precomputed values (standings tables, prestige breakdown) |

### 1.3 Store Schemas

**`saves` store:**
```
{
  id: string                    // "slot-1" | "slot-2" | "slot-3" | "auto"
  schemaVersion: number         // current: 1
  timestamp: number             // Date.now() at save time
  name: string                  // user-facing label
  gameState: GameState
  teams: Team[]
  drivers: Driver[]
  races: Race[]
  narrativeState: {
    events: NarrativeEvent[]
    arcs: StoryArc[]
    eventHistory: string[]      // IDs of past events (prevents repeats)
  }
  seasonHistory: SeasonSummary[]
}
```

**`save-meta` store:**
```
{
  id: string
  name: string
  timestamp: number
  season: number
  round: number
  playerTeamName: string
  constructorPosition: number
  schemaVersion: number
}
```

### 1.4 Index Strategy

| Store | Index | Key Path | Purpose |
|-------|-------|----------|---------|
| `saves` | `by-timestamp` | `timestamp` | Sort by recency |
| `save-meta` | `by-timestamp` | `timestamp` | Same for listing |
| `cache` | `by-valid` | `validUntil` | Bulk-clear stale entries |

Minimal indexes. With max 4 save slots, enumeration is trivial.

### 1.5 Schema Versioning and Migrations

Each save carries `schemaVersion`. On load:
1. Read `schemaVersion`
2. Run sequential migrations: `v1_to_v2`, `v2_to_v3`, etc.
3. Each migration is a pure function: `(oldSave) => newSave`
4. After migration, re-save to persist the upgrade

**Rules:**
- Never delete data without a deprecation cycle
- Provide defaults for new required fields
- Migrations must be idempotent

### 1.6 Storage Size Estimation

| Component | Estimated Size |
|-----------|---------------|
| GameState | ~0.2 KB |
| 11 Teams | ~80 KB |
| 22 Drivers | ~40 KB |
| 22 Races (full season) | ~60 KB |
| Narrative state | ~30 KB |
| Season history (per season) | ~15 KB |
| **Single save (mid Season 1)** | **~220 KB** |
| **Single save (Season 5 career)** | **~350 KB** |
| **4 slots worst case (Season 10)** | **~2 MB** |

Well within IndexedDB quota (typically hundreds of MB minimum).

---

## 2. Game Engine Interface Contracts

### 2.1 Engineering Engine

```
rndEngine.advanceProgress(teams: Team[], racesElapsed: number): Team[]
  -- Advances in-progress upgrades by 1 race for all teams.

carPerformance.calculate(baseStats: CarPerformance, completedUpgrades: RndUpgrade[]): CarPerformance
  -- Base stats + sum of completed upgrade deltas.

componentLifecycle.evaluateRace(components: ComponentAllocation[], reliability: number, prng: PRNG):
  { components: ComponentAllocation[], failure: boolean, failureType?: string }
  -- Increments usage, rolls failure probability.
```

### 2.2 Race Simulation Engine

```
simulateLap(state: RaceState, strategies: RaceStrategy[], tireStates, prng: PRNG): LapResult[]
  -- Core per-lap function for all 20 drivers.

tireDegradation.calculate(compound, lapsOnTire, circuit, carTireMgmt): number
  -- Returns new wear value (0-100).

weather.tick(current: WeatherForecast, circuit, prng): WeatherForecast
  -- Advances weather state machine by one lap.

overtake.calculateProbability(input: OvertakeInput): { probability, estimatedLaps }

pitStrategy.calculateOptions(input: PitInput): StrategyOption[]
  -- Returns undercut, optimum, overcut options.
```

### 2.3 Driver Model Engine

```
driverModel.effectivePerformance(driver: Driver): number
  -- Attributes + mood modifiers → single performance factor.

moodSystem.update(driver: Driver, events: MoodEvent[]): Mood
  -- Current mood + events → new mood.

aging.applySeasonEnd(driver: Driver): Driver
  -- Adjust attributes based on age vs peak.

contractEngine.evaluateOffer(driver, offer, teamCompetitiveness):
  { accepted: boolean, counterOffer?: Contract }
```

### 2.4 Financial Engine

```
budgetEngine.recordSpend(budget: Budget, category, amount): Budget
sponsorEngine.evaluateRace(sponsors, raceResult, prestige): Sponsor[]
prestige.calculate(standing, results, marketability, scandals): { score, rating }
```

### 2.5 Narrative Engine

```
eventGenerator.evaluate(gameState, templates, prng): NarrativeEvent[]
  -- Scan templates, check conditions, return triggered events.

storyArcTracker.advance(arcs, events, gameState): StoryArc[]
  -- Progress arcs through stages.

eventGenerator.applyExpired(events, currentRound): { events, notifications }
```

### 2.6 Regulation Engine (MVP: passive)

```
regulationEngine.getActiveRegulations(season): Regulation[]
regulationEngine.getTechnicalDirectives(season, round): TechnicalDirective[]
```

### 2.7 Engine Dependency Graph

```
                    ┌─────────────┐
                    │ Regulation  │
                    └──────┬──────┘
                           │
┌──────────────┐    ┌──────┴──────┐    ┌──────────────┐
│  Financial   │◄───│ Engineering │───►│    Driver     │
└──────┬───────┘    └──────┬──────┘    └──────┬───────┘
       │                   │                   │
       └──────────►┌───────┴───────┐◄──────────┘
                   │    Race Sim   │
                   └───────┬───────┘
                           │
                   ┌───────┴───────┐
                   │   Narrative   │◄── reads all state
                   └───────────────┘
```

### 2.8 Execution Order Per Phase

**Management Phase Advance:**
1. Regulation → check directives
2. Engineering → advance R&D, update car
3. Financial → record spending
4. Driver Model → update mood
5. AI Teams → decisions for 10 teams
6. Narrative → generate events, advance arcs
7. Delegation → auto-decide for departments

**Race (per lap):**
1. Weather tick → 2. Tire degradation → 3. Driver performance → 4. Lap times + positions → 5. Overtakes → 6. Component checks → 7. Pit strategy recalc → 8. Commentary

**Post-Race:**
1. Financial (prize money, KPIs) → 2. Driver mood → 3. Narrative events → 4. Component usage

**Season End:**
1. Financial (final prizes) → 2. Driver aging + contracts → 3. R&D carry-over → 4. Regulation changes → 5. Arc resolutions

---

## 3. State Serialization Strategy

### 3.1 Saved vs. Recomputed

| Data | Saved | Recomputed |
|------|-------|------------|
| GameState, teams, drivers, races, narrative | Yes | — |
| Car performance profile | Yes | Validated on load |
| Standings positions | No | Derived from points |
| Prestige rating | No | Recalculated |
| Cache entries | No | Rebuilt lazily |
| UI state | No | Reset to defaults |

### 3.2 Circular Reference Prevention

All cross-entity references use string IDs:
- Team ↔ Driver: `team.driverIds` / `driver.teamId`
- Rivalry: `rivalry.targetDriverId`
- Arc ↔ Event: `arc.eventIds` / `event.arcId`

No object pointers. `JSON.stringify` is always safe.

Reconstruction uses lookup maps:
```
driversById: Map<string, Driver>
teamsById: Map<string, Team>
```

### 3.3 Export Format

```json
{
  "format": "mission-control-f1",
  "exportVersion": 1,
  "exportedAt": "2026-04-04T12:00:00Z",
  "schemaVersion": 1,
  "data": { /* full save object */ }
}
```

File extension: `.mc-save.json`. No compression for MVP (saves < 350KB).

### 3.4 Import Validation

1. `format` matches `"mission-control-f1"`
2. `schemaVersion` is known (run migrations if old)
3. Required fields exist (`gameState`, `teams`, `drivers`, `races`)
4. `teams.length === 11`, `drivers.length >= 22`
5. Player team ID exists in teams array

Reject with error on failure. No partial recovery.

---

## 4. Web Worker Protocol

> **Canonical source of truth:** `src/types/race.ts` (`WorkerInMessage`, `WorkerOutMessage`, `WorkerOutEvent`, `RaceWorkerStartPayload`). Protocol adapters live in `src/workers/race-worker-protocol.ts`.

### 4.1 Main Thread → Worker

| Type | Payload | When |
|------|---------|------|
| `start` | `payload: RaceWorkerStartPayload` — strict superset of `RaceBootstrapInput` (seed, round, circuit, isSprint, drivers, strategies?) plus optional `simSpeed` | Enter race phase |
| `setSpeed` | `speed: 1 \| 2 \| 5 \| 'max'` | Speed change |
| `pause` | _(none)_ | Pause |
| `resume` | _(none)_ | Resume |
| `command` | `envelope: RaceCommandEnvelope` — embeds an IP-02 envelope unchanged (setCommand / pit / strategyChange) | Driver command, pit, or strategy swap |

The legacy top-level `strategyChange` message has been removed; strategy swaps now travel inside a command envelope. The worker bootstraps race state internally from the `start` payload (no placeholder initialization on the worker side).

### 4.2 Worker → Main Thread

| Type | Payload | Frequency |
|------|---------|-----------|
| `ready` | `lap, totalLaps` | Once, after init |
| `lapUpdate` | `lap, results[], tireStates, weather, safetyCar` | Per lap |
| `commentary` | `entries[]` | With each lapUpdate when non-empty |
| `incident` | `incident` | On incident |
| `raceEnd` | `finalResults, fastestLap` | Once |
| `error` | `code, message, fatal, recovery?` | On recoverable or fatal error |
| `batch` | `messages: WorkerOutEvent[]` | Reserved for MAX-speed batching (flat; never nested) |

`error.code` is typed (`start/invalid-payload`, `start/missing-drivers`, `command/unknown-driver`, `command/invalid-envelope`, `runtime/simulation-failure`). `recovery.lastValidLap` lets the main thread respawn the worker from a known-good lap.

### 4.3 Timing Model

| Speed | Interval | Notes |
|-------|----------|-------|
| 1x | ~2000ms | Real-time feel |
| 2x | ~1000ms | Fast-forward |
| 5x | ~400ms | Quick simulation |
| MAX | 0ms (batched) | 5 laps per message, backpressure via `ack` |
| Pause | N/A | Accepts commands while paused |

### 4.4 Error Recovery

1. Main thread listens for Worker `error` event
2. Holds last `lapUpdate` as recovery point
3. Spawns new Worker, sends `start` with recovered state + seed offset
4. If crash on lap 1: retry up to 2 times, then offer rollback to pre-race save

### 4.5 Consistency Model

- **Worker is authority** for race simulation state
- **Main thread is authority** for player commands
- Main thread renders exclusively from `lapUpdate` payloads
- Optimistic UI: command shown active immediately, self-corrects from worker state
- Pause atomicity: queued commands applied atomically on resume

---

## 5. Future API Readiness

### 5.1 Engine-to-Endpoint Mapping

| Engine Function | Future Endpoint |
|-----------------|----------------|
| `initializeGame()` | `POST /api/games` |
| `advancePhase()` | `POST /api/games/:id/advance` |
| `simulateRace()` | `POST /api/games/:id/race/simulate` |
| `resolveEvent()` | `POST /api/games/:id/events/:eventId/resolve` |
| `saveGame()`/`loadGame()` | `GET/PUT /api/saves/:slotId` |

### 5.2 Repository Pattern

```typescript
interface GameRepository {
  save(slotId: string, state: FullGameState): Promise<void>
  load(slotId: string): Promise<FullGameState>
  listSlots(): Promise<SaveMeta[]>
  delete(slotId: string): Promise<void>
}

// MVP: IndexedDbGameRepository
// Future: ApiGameRepository (wraps fetch calls)
```

All consumers call through this interface. Swapping implementations requires zero changes to game logic.

### 5.3 Cloud Save Pattern

- Last-write-wins based on `timestamp`
- Server stores save blob opaquely
- IndexedDB remains primary store even with cloud sync
- Background sync after each auto-save
- Offline-first: continues locally, syncs on reconnect

---

## 6. Performance Budgets

### 6.1 Save/Load

| Operation | Target |
|-----------|--------|
| Save to IndexedDB | < 50ms |
| Load from IndexedDB | < 50ms |
| Save meta listing | < 10ms |
| Export to JSON | < 200ms |
| Import from JSON | < 300ms |
| Auto-save | < 100ms (non-blocking) |

### 6.2 Engine Computation

| Operation | Target |
|-----------|--------|
| Management phase advance (all engines) | < 500ms |
| Single engine pass | < 100ms each |
| AI team decisions (10 teams) | < 200ms |
| Post-race processing | < 300ms |
| Season-end processing | < 1000ms |

### 6.3 Race Simulation Ticks

| Speed | Lap Compute Target | Notes |
|-------|-------------------|-------|
| 1x-5x | < 20ms per lap | Abundant time |
| MAX | < 5ms per lap | 55-lap race in < 275ms |

**Lap budget at MAX:**
- Tire degradation: ~0.5ms
- Lap times: ~1ms
- Overtakes: ~1ms
- Weather: ~0.1ms
- Incidents: ~0.5ms
- Commentary: ~1ms
- State + postMessage: ~0.5ms
- **Total: ~4.6ms** (within budget)

### 6.4 Memory

| Item | Target |
|------|--------|
| Game state in memory | < 2 MB |
| Worker race state | < 5 MB |
| Total app memory | < 50 MB |
