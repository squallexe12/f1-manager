# Factory Box 2 — Power Unit Strategy (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real component-wear ticking and a pre-weekend power-unit swap-election decision into the Factory page Power Unit hero card. Players elect to introduce a fresh PU element on a driver-by-driver basis; if the introduction pushes the team-shared element counter past its season limit, that driver takes a grid penalty next race via the existing Tier A `nextRaceGridDrop` channel. The "Penalties Taken" counter (currently hardcoded `0`) becomes a real running season total.

**Architecture:** All gameplay logic lives in a new pure module `src/engine/engineering/component-strategy.ts`. The orchestrator drains pending swaps at the management → practice transition; the post-race processor ticks shared wear once per element per race. A new thin store action `electComponentSwap(driverId, element)` is the only UI → engine entry point. The PU card grows a *Component Strategy* sub-section that renders per-driver-per-element rows for elements at or near limit.

**Tech Stack:** TypeScript strict, Vitest with `fake-indexeddb`, Zustand store (one new action), Next.js App Router page (one new prop wiring + one new store-action read), CSS Modules / Tailwind classes already established by the existing Factory card stylesheet.

**Spec reference:** [docs/superpowers/specs/2026-04-25-factory-three-cards-real-data-design.md](../specs/2026-04-25-factory-three-cards-real-data-design.md) §4.2, §5.2, §6.1 Phase 2, §6.2, §6.3 Phase 2, §8 Phase 2.

**Pipeline:** AGENTS.md Pipeline A (sim-engine → game-state → ui-interface → verify) — all four roles touched. This is the most architecturally complete phase of the three-card effort.

**Predecessor:** Phase 1 (Box 1 — Car Performance) shipped on 2026-04-25 in merge commit `da6a0c1`. Schema is currently at v9.

---

## Critical clarification: per-driver UI vs team-level data

The spec's UI mockup shows per-driver rows ("HAMILTON · ICE · 3/4 USED") but the data model has team-level `components: ComponentAllocation[]` (a single shared pool across both drivers). The reconciliation locked into this plan:

- **Team-level wear** — `tickComponentWear()` increments every element by 1 each completed race. Shared counter, applies regardless of which driver "used" the element.
- **Per-driver swap election** — `pendingComponentSwaps: PendingComponentSwap[]` records which driver the player picked to take the next swap. When `applyPendingSwaps()` runs, it increments the team-shared counter once per swap and applies the resulting grid penalty only to the named driver.
- **UI rationale** — the strategic decision is "WHO takes the grid penalty?" not "WHO uses the new element?". Both drivers share the pool; only the elected driver pays the cost.

This means a player might elect "Hamilton takes the next ICE swap at Spa" — Hamilton drops 10 places at Spa, Leclerc starts where qualifying put him.

---

## Determinism gate

This phase touches `post-race-processor.ts` (`tickComponentWear`) and `orchestrator.ts` (`applyPendingSwaps`), but adds zero PRNG calls. All three new pure functions are deterministic — same input, same output. The race-engine determinism replay test (`tests/engine/race/race-simulator.test.ts:422`) must remain byte-identical for the same seed; verify after Task 11.

---

## File structure (locked before tasks begin)

| File | Action | Responsibility |
|---|---|---|
| `src/types/team.ts` | Modify | Add `PendingComponentSwap` interface; extend `Team` with `penaltiesTaken: number` and `pendingComponentSwaps: PendingComponentSwap[]` |
| `src/data/teams.ts` | Modify | Add the two new fields to the `TeamData` Omit list (runtime-populated, not seeded) |
| `src/engine/core/state-manager.ts` | Modify | Initialize `penaltiesTaken: 0` and `pendingComponentSwaps: []` in both team-build sites |
| `src/engine/core/season-end-processor.ts` | Modify | Reset both fields at season-end |
| `src/engine/core/save-system.ts` | Modify | Bump `SCHEMA_VERSION` 9 → 10; add `migrateV9ToV10` |
| `src/engine/engineering/component-strategy.ts` | **Create** | Pure: `electComponentSwap`, `applyPendingSwaps`, `tickComponentWear`, `projectedGridLossIfElectedNow`, `componentSwapRows` |
| `src/engine/core/orchestrator.ts` | Modify | New `processPreRaceEntry` step in `advanceGamePhase` that drains `pendingComponentSwaps` and folds penalties into `driver.nextRaceGridDrop` at management → practice transition |
| `src/engine/core/post-race-processor.ts` | Modify | Call `tickComponentWear()` per team in the same idempotency-guarded write block as `seasonForm` / `ovrHistory` |
| `src/stores/game-store.ts` | Modify | Add `electComponentSwap(driverId, element)` thin-dispatch action |
| `src/components/factory/power-unit-card.tsx` | Modify | Read `penaltiesTaken` from prop (no longer hardcoded `0`); render new *Component Strategy* sub-section from `swapRows` prop with `onElectSwap` / `onUndoSwap` callbacks |
| `src/app/factory/page.tsx` | Modify | Derive `swapRows` from team + drivers + pendingSwaps via `componentSwapRows()`; pass `team.penaltiesTaken` and `electComponentSwap` action |
| `docs/architecture/persistence-contract.md` | Modify | Add v9 → v10 entry to §5 |
| `tests/engine/engineering/component-strategy.test.ts` | **Create** | Pure-function unit tests for all five exports |
| `tests/engine/core/save-system.test.ts` | Extend | v9 → v10 migration round-trip |
| `tests/engine/core/orchestrator.test.ts` | Extend | Management → practice drain merges penalties into `nextRaceGridDrop`; non-penalty swap doesn't increment counter |
| `tests/engine/core/post-race-fastest-lap.test.ts` (or new `post-race-component-wear.test.ts`) | Extend / Create | Wear ticks every element on every team per race |
| `tests/stores/game-store.test.ts` | Extend | `electComponentSwap` action thin-dispatch + idempotency |

`PendingComponentSwap` lives in `src/types/team.ts` (where `ComponentAllocation` already lives) — same pattern as Phase 1's `FastestLapEntry`.

The new wear-tick test could ride along in `post-race-fastest-lap.test.ts` (same Phase-1 author, same idempotency-guard concern), or land as its own `post-race-component-wear.test.ts`. Either is acceptable; the plan uses a new file for clearer per-feature ownership.

---

## Task 1: Add `PendingComponentSwap` type + extend `Team`

**Files:**
- Modify: `src/types/team.ts:33-46` (insert new interface after `ComponentElement` alias)
- Modify: `src/types/team.ts:107` (extend `Team` interface — add fields adjacent to Phase 1's `failureEvents`)

- [ ] **Step 1: Add the `PendingComponentSwap` interface**

After the `FailureEvent` interface (added in Phase 1), insert:

```ts
/**
 * One queued power-unit element swap election made by the player during the
 * management phase. Drained by `applyPendingSwaps` at the management →
 * practice transition. The named driver is the one who pays the grid
 * penalty if the swap pushes the team-shared element counter past its
 * season limit (real F1 model: each car carries its own ICE history, but
 * we simplify to a team pool plus a per-driver penalty target).
 */
export interface PendingComponentSwap {
  driverId: string
  element: ComponentElement
  electedRound: number
}
```

- [ ] **Step 2: Extend the `Team` interface**

In the `Team` interface, after the Phase 1 `failureEvents` field, add:

```ts
  /**
   * Running season counter of grid-penalty events incurred from elected
   * component swaps. Increments by one each time `applyPendingSwaps` drains
   * a swap whose post-increment `used > limit` (i.e., the player elected to
   * take a penalty here rather than risk a worse circuit later). Reset at
   * season end.
   */
  penaltiesTaken: number
  /**
   * Queue of player-elected component swaps awaiting the management →
   * practice transition. Each entry names the driver who will pay any
   * grid penalty. Idempotent on append (one entry per driver × element);
   * drained by `applyPendingSwaps`. Reset at season end.
   */
  pendingComponentSwaps: PendingComponentSwap[]
```

- [ ] **Step 3: Type-check (expected: cascade failures across teams.ts, state-manager.ts, save-system.ts, season-end-processor.ts, factory-insights.test.ts)**

Run: `npx tsc --noEmit`
Expected: missing-property errors in every site that constructs a `Team` literal.

- [ ] **Step 4: Do NOT commit yet**

This task ships only after Tasks 2-4 land — the type extension causes a compile cascade that needs all four together for the build to be green.

---

## Task 2: Update `TeamData` Omit list + state-manager init (both sites)

**Files:**
- Modify: `src/data/teams.ts:9-23` (extend Omit)
- Modify: `src/engine/core/state-manager.ts` — both `applyScenarioToTeam` (~line 56) and `buildTeam` (~line 88)

- [ ] **Step 1: Add new field names to the Omit list**

In `src/data/teams.ts`, extend `TeamData`:

```ts
export type TeamData = Omit<
  Team,
  | 'rndUpgrades'
  | 'constructorPoints'
  | 'constructorPosition'
  | 'previousConstructorPosition'
  | 'previousMorale'
  | 'seasonForm'
  | 'lastProcessedRound'
  | 'ovrHistory'
  | 'lastUpgradeRound'
  | 'fastestLapHistory'
  | 'failureEvents'
  | 'penaltiesTaken'
  | 'pendingComponentSwaps'
  | 'staff'
> & {
  staff: Omit<DepartmentHead, 'contractEndSeason'>[]
}
```

- [ ] **Step 2: Initialize new fields in `applyScenarioToTeam`**

Locate the existing block ending with `failureEvents: [],` (the Phase 1 init). After it, add:

```ts
    penaltiesTaken: 0,
    pendingComponentSwaps: [],
```

- [ ] **Step 3: Same for `buildTeam`**

Same change in the second team-build site.

- [ ] **Step 4: Type-check (expected: only save-system + season-end errors remain)**

Run: `npx tsc --noEmit`

---

## Task 3: Reset new fields in `season-end-processor.ts`

**Files:**
- Modify: `src/engine/core/season-end-processor.ts` (the per-team reset block, near the existing `failureEvents: []` reset)

- [ ] **Step 1: Locate the existing season-end reset**

Find the per-team reset block that already resets `ovrHistory: []`, `lastUpgradeRound: 0`, `fastestLapHistory: []`, `failureEvents: []`.

- [ ] **Step 2: Add reset for the two new fields**

Append to the same reset object:

```ts
    // Phase 2 (Box 2) buffers also reset per season: penalty counter starts
    // at zero, queued swaps are dropped (a season boundary discards any
    // unresolved election from the prior championship).
    penaltiesTaken: 0,
    pendingComponentSwaps: [],
```

- [ ] **Step 3: Type-check (expected: only save-system error remains)**

Run: `npx tsc --noEmit`

---

## Task 4: Bump `SCHEMA_VERSION` 9 → 10 + add `migrateV9ToV10`

**Files:**
- Modify: `src/engine/core/save-system.ts:10` (`SCHEMA_VERSION`)
- Modify: `src/engine/core/save-system.ts` (header doc comment + new MIGRATIONS entry)

- [ ] **Step 1: Bump `SCHEMA_VERSION`**

Change `SCHEMA_VERSION` from `9` to `10`.

- [ ] **Step 2: Add header doc paragraph**

Append to the JSDoc block at the top:

```
 * v9 → v10 (Factory Box 2 — Power Unit strategy): Adds
 * `team.penaltiesTaken: 0` and `team.pendingComponentSwaps: []` for the
 * new pre-weekend swap-election decision. `penaltiesTaken` increments
 * when a player-elected swap pushes a team-shared element counter past
 * its season limit; the named driver in the queued swap pays the grid
 * penalty via the existing Tier A `driver.nextRaceGridDrop` channel.
 * Both fields reset at season end.
```

- [ ] **Step 3: Add the migration entry**

After migration `8` (Phase 1's), insert:

```ts
  /**
   * v9 → v10 (Factory Box 2 — Power Unit strategy): Adds two persisted
   * team fields. `penaltiesTaken` is a running season counter; defaults
   * to 0. `pendingComponentSwaps` is the player-elected swap queue;
   * defaults to []. Existing values are preserved verbatim.
   */
  9: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      penaltiesTaken: team.penaltiesTaken ?? 0,
      pendingComponentSwaps: team.pendingComponentSwaps ?? [],
    })),
  }),
```

- [ ] **Step 4: Type-check (expected: clean)**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Run existing save-system suite**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: all 31 tests pass (Phase 1's v8 → v9 tests remain green; new migration is additive).

- [ ] **Step 6: Commit (Task 1-4 together)**

```bash
git add src/types/team.ts src/data/teams.ts src/engine/core/state-manager.ts src/engine/core/season-end-processor.ts src/engine/core/save-system.ts
git commit -m "feat(factory): add penaltiesTaken + pendingComponentSwaps persisted fields (v9->v10 schema)"
```

---

## Task 5: v9 → v10 migration test

**Files:**
- Modify: `tests/engine/core/save-system.test.ts` (extend — pattern matches Phase 1's v8 → v9 block)

- [ ] **Step 1: Write the failing tests**

Append a new `describe('v9 → v10 migration (Factory Box 2 strategy)', ...)` block immediately after the Phase 1 v8 → v9 block (around line 700):

```ts
describe('v9 → v10 migration (Factory Box 2 — Power Unit strategy)', () => {
  it('back-fills penaltiesTaken and pendingComponentSwaps with defaults', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [
        { id: 'mclaren', name: 'McLaren', constructorPoints: 0 },
        { id: 'red-bull', name: 'Red Bull', constructorPoints: 0 },
      ],
      drivers: [],
    }
    const { data, migrated } = migrateToCurrent(v9State as unknown as FullGameState, 9)
    expect(migrated).toBe(true)
    for (const team of data.teams) {
      expect(team.penaltiesTaken).toBe(0)
      expect(team.pendingComponentSwaps).toEqual([])
    }
  })

  it('preserves existing values verbatim if already populated', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [{
        id: 'mclaren', name: 'McLaren',
        penaltiesTaken: 3,
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice', electedRound: 5 },
        ],
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v9State as unknown as FullGameState, 9)
    expect(data.teams[0].penaltiesTaken).toBe(3)
    expect(data.teams[0].pendingComponentSwaps).toHaveLength(1)
    expect(data.teams[0].pendingComponentSwaps[0].driverId).toBe('norris')
  })

  it('is idempotent — running twice yields the same result', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [{ id: 'mclaren', name: 'McLaren' }],
      drivers: [],
    }
    const once = migrateToCurrent(v9State as unknown as FullGameState, 9).data
    const twice = migrateToCurrent(once, SCHEMA_VERSION).data
    expect(twice).toEqual(once)
  })

  it('preserves Phase 1 buffers (fastestLapHistory, failureEvents) untouched', () => {
    const v9State = {
      gameState: { season: 1, currentRound: 5, schemaVersion: 9 },
      teams: [{
        id: 'mclaren', name: 'McLaren',
        fastestLapHistory: [{ round: 3, lapMs: 78_421 }],
        failureEvents: [],
      }],
      drivers: [],
    }
    const { data } = migrateToCurrent(v9State as unknown as FullGameState, 9)
    expect(data.teams[0].fastestLapHistory).toEqual([{ round: 3, lapMs: 78_421 }])
    expect(data.teams[0].failureEvents).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests (expected: PASS)**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: 35 tests pass (was 31 + 4 new).

- [ ] **Step 3: Commit**

```bash
git add tests/engine/core/save-system.test.ts
git commit -m "test(factory): cover v9->v10 migration round-trip"
```

---

## Task 6: Create `component-strategy.ts` with `electComponentSwap` (TDD)

**Files:**
- Create: `src/engine/engineering/component-strategy.ts`
- Create: `tests/engine/engineering/component-strategy.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/engineering/component-strategy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Team, ComponentElement, PendingComponentSwap } from '@/types/team'
import { electComponentSwap } from '@/engine/engineering/component-strategy'

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'mclaren', name: 'McLaren', shortName: 'MCL',
    color: '#FF8000', headquarters: 'Woking', powerUnitSupplier: 'mercedes',
    driverIds: ['norris', 'piastri'], reserveDriverId: null, staff: [],
    car: { downforce: 85, straightSpeed: 83, reliability: 80, tireManagement: 82, braking: 84, cornering: 86 },
    rndUpgrades: [],
    components: [
      { element: 'ice', used: 2, limit: 4, failureProbability: 0.02 },
      { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
      { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
      { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
      { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
    ],
    windTunnelHoursUsed: 0, windTunnelHoursLimit: 300,
    cfdRunsUsed: 0, cfdRunsLimit: 2500,
    morale: 85, aiPersonality: null,
    constructorPoints: 0, constructorPosition: 1,
    previousConstructorPosition: 0, previousMorale: 85,
    seasonForm: [], lastProcessedRound: 0,
    ovrHistory: [], lastUpgradeRound: 0,
    fastestLapHistory: [], failureEvents: [],
    penaltiesTaken: 0, pendingComponentSwaps: [],
    ...overrides,
  }
}

describe('electComponentSwap', () => {
  it('appends a new swap entry to pendingComponentSwaps', () => {
    const team = makeTeam()
    const next = electComponentSwap(team, 'norris', 'ice', 5)
    expect(next.pendingComponentSwaps).toEqual([
      { driverId: 'norris', element: 'ice', electedRound: 5 },
    ])
  })

  it('is idempotent — re-electing the same driver+element does not duplicate', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 4 }],
    })
    const next = electComponentSwap(team, 'norris', 'ice', 5)
    expect(next.pendingComponentSwaps).toHaveLength(1)
    // First election wins — electedRound stays at 4 (no overwrite)
    expect(next.pendingComponentSwaps[0].electedRound).toBe(4)
  })

  it('allows different drivers to elect swaps for the same element', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const next = electComponentSwap(team, 'piastri', 'ice', 5)
    expect(next.pendingComponentSwaps).toHaveLength(2)
  })

  it('allows the same driver to elect swaps for different elements', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const next = electComponentSwap(team, 'norris', 'turbo', 5)
    expect(next.pendingComponentSwaps).toHaveLength(2)
  })

  it('returns the same team reference when the election is a no-op (idempotent)', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const next = electComponentSwap(team, 'norris', 'ice', 5)
    expect(next).toBe(team) // referential equality — no new object on no-op
  })
})
```

- [ ] **Step 2: Run tests (expected: FAIL — module doesn't exist)**

Run: `npx vitest run tests/engine/engineering/component-strategy.test.ts`
Expected: import error.

- [ ] **Step 3: Implement `electComponentSwap`**

Create `src/engine/engineering/component-strategy.ts`:

```ts
import type { Team, ComponentElement } from '@/types/team'

/**
 * Append a power-unit swap election to the team's pending queue. Idempotent
 * on (driverId, element) — re-electing the same swap is a no-op (returns
 * the same team reference unchanged). The first election wins; later
 * elections for the same pair are ignored. Used by the Factory page's
 * Component Strategy sub-section in response to `INTRODUCE NEW` clicks.
 */
export function electComponentSwap(
  team: Team,
  driverId: string,
  element: ComponentElement,
  currentRound: number,
): Team {
  const alreadyQueued = team.pendingComponentSwaps.some(
    (s) => s.driverId === driverId && s.element === element,
  )
  if (alreadyQueued) return team
  return {
    ...team,
    pendingComponentSwaps: [
      ...team.pendingComponentSwaps,
      { driverId, element, electedRound: currentRound },
    ],
  }
}
```

- [ ] **Step 4: Run tests (expected: PASS)**

Run: `npx vitest run tests/engine/engineering/component-strategy.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engineering/component-strategy.ts tests/engine/engineering/component-strategy.test.ts
git commit -m "feat(factory): add electComponentSwap with idempotent queue append"
```

---

## Task 7: Add `applyPendingSwaps` + `tickComponentWear` (TDD)

**Files:**
- Modify: `src/engine/engineering/component-strategy.ts`
- Modify: `tests/engine/engineering/component-strategy.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/engine/engineering/component-strategy.test.ts`:

```ts
import { applyPendingSwaps, tickComponentWear } from '@/engine/engineering/component-strategy'
import type { Driver } from '@/types/driver'

function makeDriver(id: string, teamId: string, overrides: Partial<Driver> = {}): Driver {
  // No `as Driver` cast — fixture must shape-match the full Driver type so
  // future field additions break loudly here. Read `src/types/driver.ts`
  // before implementing this fixture and fill in EXACTLY the required fields.
  // The skeleton below covers known fields as of v9; extend if Driver has
  // grown since.
  const driver: Driver = {
    id, firstName: id, lastName: id, shortName: id.toUpperCase().slice(0, 3),
    teamId, isReserve: false, isF2: false, age: 25, nationality: 'GB', number: 1,
    attributes: {
      pace: 80, racecraft: 80, experience: 70, mentality: 80,
      marketability: 70, developmentPotential: 70,
    },
    salary: 1_000_000,
    contract: null,
    mood: { motivation: 70, frustration: 20, confidence: 70 },
    seasonStats: { points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, penalties: 0, bestFinish: 0, averageFinish: 0, lastProcessedRound: 0 },
    form: [], lastRaceResult: null,
    penaltyPoints: [], warningsThisSeason: 0, nextRaceGridDrop: 0, banUntilRound: null,
  }
  return { ...driver, ...overrides }
}

describe('applyPendingSwaps', () => {
  it('returns the same team and empty penalty map when queue is empty', () => {
    const team = makeTeam()
    const drivers = [makeDriver('norris', 'mclaren'), makeDriver('piastri', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.team.pendingComponentSwaps).toEqual([])
    expect(result.gridPenaltyByDriver).toEqual({})
    expect(result.team.penaltiesTaken).toBe(0)
  })

  it('increments components[el].used per drained swap', () => {
    const team = makeTeam({
      pendingComponentSwaps: [
        { driverId: 'norris', element: 'ice', electedRound: 5 },
        { driverId: 'piastri', element: 'turbo', electedRound: 5 },
      ],
    })
    const drivers = [makeDriver('norris', 'mclaren'), makeDriver('piastri', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.team.components.find((c) => c.element === 'ice')!.used).toBe(3) // was 2
    expect(result.team.components.find((c) => c.element === 'turbo')!.used).toBe(2) // was 1
    expect(result.team.pendingComponentSwaps).toEqual([])
  })

  it('does not trigger penalty when post-increment used <= limit', () => {
    const team = makeTeam({
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    // ICE was 2/4; one swap → 3/4 (under limit, no penalty)
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver).toEqual({})
    expect(result.team.penaltiesTaken).toBe(0)
  })

  it('triggers penalty when post-increment used > limit', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    // ICE was 4/4; one swap → 5/4 (over limit, 10-place grid penalty)
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(10)
    expect(result.team.penaltiesTaken).toBe(1)
  })

  it('escalates penalty for multiple consecutive over-limit swaps on same element', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 5, limit: 4, failureProbability: 0.02 }, // already 1 over
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    // ICE was 5/4 (1 over); next swap → 6/4 (2 over → 10 + 1*5 = 15-place penalty)
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(15)
    expect(result.team.penaltiesTaken).toBe(1)
  })

  it('aggregates penalty across multiple elements per driver', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [
        { driverId: 'norris', element: 'ice', electedRound: 5 },
        { driverId: 'norris', element: 'turbo', electedRound: 5 },
      ],
    })
    const drivers = [makeDriver('norris', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(20) // 10 + 10
    expect(result.team.penaltiesTaken).toBe(2) // two penalty-incurring swaps
  })

  it('routes penalty to the named driver only (not the team)', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const drivers = [makeDriver('norris', 'mclaren'), makeDriver('piastri', 'mclaren')]
    const result = applyPendingSwaps(team, drivers, 5)
    expect(result.gridPenaltyByDriver['norris']).toBe(10)
    expect(result.gridPenaltyByDriver['piastri']).toBeUndefined()
  })
})

describe('tickComponentWear', () => {
  it('increments every element by exactly 1', () => {
    const team = makeTeam()
    const next = tickComponentWear(team)
    expect(next.components.find((c) => c.element === 'ice')!.used).toBe(3)
    expect(next.components.find((c) => c.element === 'turbo')!.used).toBe(2)
    expect(next.components.find((c) => c.element === 'mgu-k')!.used).toBe(2)
    expect(next.components.find((c) => c.element === 'ers-battery')!.used).toBe(2)
    expect(next.components.find((c) => c.element === 'gearbox')!.used).toBe(3)
  })

  it('preserves all other team fields verbatim', () => {
    const team = makeTeam()
    const next = tickComponentWear(team)
    expect(next.id).toBe(team.id)
    expect(next.car).toEqual(team.car)
    expect(next.constructorPoints).toBe(team.constructorPoints)
    expect(next.fastestLapHistory).toBe(team.fastestLapHistory)
  })
})
```

- [ ] **Step 2: Run tests (expected: FAIL — functions don't exist)**

Run: `npx vitest run tests/engine/engineering/component-strategy.test.ts`
Expected: import error or "not a function".

- [ ] **Step 3: Implement both functions**

Append to `src/engine/engineering/component-strategy.ts`:

```ts
import type { ComponentAllocation } from '@/types/team'
import type { Driver } from '@/types/driver'
import { getGridPenalty } from './component-lifecycle'

export interface ApplyPendingSwapsResult {
  team: Team
  gridPenaltyByDriver: Record<string, number>
}

/**
 * Drain the team's queued component swaps. For each swap:
 *  1. Increment the team-shared `components[element].used` counter.
 *  2. If post-increment `used > limit`, compute the grid penalty (using
 *     `getGridPenalty` from `component-lifecycle.ts`) and ADD it to the
 *     named driver's total in the returned map.
 *  3. Increment `team.penaltiesTaken` once per penalty-incurring swap.
 *
 * After draining, `pendingComponentSwaps` is empty. Returns both the
 * updated team and the per-driver grid-penalty map; the orchestrator
 * folds the map into each driver's `nextRaceGridDrop` (the existing
 * Tier A channel consumed by the strategy page at race start).
 *
 * Pure — does not mutate inputs. The `drivers` parameter is currently
 * unused but reserved so the function signature stays stable when a
 * future phase adds per-driver wear tracking. Pass any `Driver[]`
 * (e.g., `world.drivers`) — the function only reads team state.
 */
export function applyPendingSwaps(
  team: Team,
  _drivers: Driver[],
  _currentRound: number,
): ApplyPendingSwapsResult {
  if (team.pendingComponentSwaps.length === 0) {
    return { team, gridPenaltyByDriver: {} }
  }

  let workingComponents: ComponentAllocation[] = team.components.map((c) => ({ ...c }))
  const gridPenaltyByDriver: Record<string, number> = {}
  let penaltiesIncurred = 0

  for (const swap of team.pendingComponentSwaps) {
    const idx = workingComponents.findIndex((c) => c.element === swap.element)
    if (idx < 0) continue // safety: unknown element
    const preIncrement = workingComponents[idx]
    // PRE-INCREMENT penalty calculation. `getGridPenalty` is contracted to be
    // called BEFORE incrementing — its `used == limit` branch returns 10 (the
    // first-introduction-past-limit penalty), and `used == limit + 1` returns
    // 15 (second past). Calling after incrementing would double-count excess.
    // Verified against existing `factory-insights.ts:103` caller pattern.
    const penalty = preIncrement.used >= preIncrement.limit ? getGridPenalty(preIncrement) : 0
    const incremented: ComponentAllocation = {
      ...preIncrement,
      used: preIncrement.used + 1,
    }
    workingComponents = [
      ...workingComponents.slice(0, idx),
      incremented,
      ...workingComponents.slice(idx + 1),
    ]
    if (penalty > 0) {
      gridPenaltyByDriver[swap.driverId] =
        (gridPenaltyByDriver[swap.driverId] ?? 0) + penalty
      penaltiesIncurred += 1
    }
  }

  return {
    team: {
      ...team,
      components: workingComponents,
      pendingComponentSwaps: [],
      penaltiesTaken: team.penaltiesTaken + penaltiesIncurred,
    },
    gridPenaltyByDriver,
  }
}

/**
 * Increment `used + 1` on every PU element. Called once per team per race
 * by the post-race processor — represents the wear of running every PU
 * element through one race weekend, regardless of which driver "used" it
 * (we model the PU pool as team-shared). Pure; does not trigger penalties
 * (only `applyPendingSwaps` ever increments `penaltiesTaken`).
 */
export function tickComponentWear(team: Team): Team {
  return {
    ...team,
    components: team.components.map((c) => ({ ...c, used: c.used + 1 })),
  }
}
```

You also need to add the missing `Team` import — extend the existing import at the top of the file:

```ts
// Replace:
//   import type { Team, ComponentElement } from '@/types/team'
// With:
//   import type { Team, ComponentElement } from '@/types/team'
// (already correct — the import covers both. Just make sure the file imports Team.)
```

- [ ] **Step 4: Run tests (expected: PASS)**

Run: `npx vitest run tests/engine/engineering/component-strategy.test.ts`
Expected: all tests pass (5 from Task 6 + 8 new = 13).

- [ ] **Step 5: Commit**

```bash
git add src/engine/engineering/component-strategy.ts tests/engine/engineering/component-strategy.test.ts
git commit -m "feat(factory): add applyPendingSwaps + tickComponentWear pure functions"
```

---

## Task 8: Add `projectedGridLossIfElectedNow` + `componentSwapRows` (TDD)

**Files:**
- Modify: `src/engine/engineering/component-strategy.ts`
- Modify: `tests/engine/engineering/component-strategy.test.ts`

- [ ] **Step 1: Write failing tests**

Append to the test file:

```ts
import { projectedGridLossIfElectedNow, componentSwapRows } from '@/engine/engineering/component-strategy'

describe('projectedGridLossIfElectedNow', () => {
  it('returns 0 when no swap is queued for the driver', () => {
    const team = makeTeam()
    expect(projectedGridLossIfElectedNow(team, 'norris')).toBe(0)
  })

  it('returns the penalty that would apply if the driver elected the next over-limit element', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    expect(projectedGridLossIfElectedNow(team, 'norris')).toBe(10)
  })

  it('aggregates across multiple queued swaps for the same driver', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [
        { driverId: 'norris', element: 'ice', electedRound: 5 },
        { driverId: 'norris', element: 'turbo', electedRound: 5 },
      ],
    })
    expect(projectedGridLossIfElectedNow(team, 'norris')).toBe(20)
  })
})

describe('componentSwapRows', () => {
  const playerDrivers = [
    { id: 'norris', shortName: 'NOR' },
    { id: 'piastri', shortName: 'PIA' },
  ]

  it('returns one row per (driver × element) where used + 1 >= limit', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 3, limit: 4, failureProbability: 0.02 }, // 3+1=4 >= 4 → row
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 }, // 1+1=2 < 4 → no row
        { element: 'mgu-k', used: 4, limit: 4, failureProbability: 0.02 }, // 4+1=5 > 4 → row (danger)
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
    })
    const rows = componentSwapRows(team, playerDrivers)
    // 2 elements at risk × 2 drivers = 4 rows
    expect(rows).toHaveLength(4)
    const iceRows = rows.filter((r) => r.element === 'ice')
    expect(iceRows).toHaveLength(2)
    expect(iceRows[0].band).toBe('warning') // last free intro
    const mgukRows = rows.filter((r) => r.element === 'mgu-k')
    expect(mgukRows[0].band).toBe('danger') // would incur penalty
  })

  it('marks rows ELECTED when a swap is already queued for that driver+element', () => {
    const team = makeTeam({
      components: [
        { element: 'ice', used: 4, limit: 4, failureProbability: 0.02 },
        { element: 'turbo', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'mgu-k', used: 1, limit: 4, failureProbability: 0.02 },
        { element: 'ers-battery', used: 1, limit: 3, failureProbability: 0.01 },
        { element: 'gearbox', used: 2, limit: 4, failureProbability: 0.02 },
      ],
      pendingComponentSwaps: [{ driverId: 'norris', element: 'ice', electedRound: 5 }],
    })
    const rows = componentSwapRows(team, playerDrivers)
    const norrisIce = rows.find((r) => r.driverId === 'norris' && r.element === 'ice')!
    const piastriIce = rows.find((r) => r.driverId === 'piastri' && r.element === 'ice')!
    expect(norrisIce.elected).toBe(true)
    expect(piastriIce.elected).toBe(false)
  })

  it('returns empty array when no element is at or near limit', () => {
    const team = makeTeam() // all elements have plenty of headroom in default fixture
    expect(componentSwapRows(team, playerDrivers)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests (expected: FAIL)**

Run: `npx vitest run tests/engine/engineering/component-strategy.test.ts`

- [ ] **Step 3: Implement both helpers**

Append to `src/engine/engineering/component-strategy.ts`:

```ts
/**
 * Project the total grid penalty the named driver would incur if their
 * currently-queued swaps were applied immediately. Uses the same
 * arithmetic as `applyPendingSwaps` — guarantees the UI projection
 * matches the actual penalty when the swap drains. Returns 0 when no
 * swaps are queued for the driver.
 */
export function projectedGridLossIfElectedNow(team: Team, driverId: string): number {
  const driverSwaps = team.pendingComponentSwaps.filter((s) => s.driverId === driverId)
  if (driverSwaps.length === 0) return 0
  let workingComponents = team.components.map((c) => ({ ...c }))
  let total = 0
  for (const swap of driverSwaps) {
    const idx = workingComponents.findIndex((c) => c.element === swap.element)
    if (idx < 0) continue
    const preIncrement = workingComponents[idx]
    // PRE-INCREMENT calculation — same semantics as `applyPendingSwaps`.
    if (preIncrement.used >= preIncrement.limit) {
      total += getGridPenalty(preIncrement)
    }
    workingComponents = [
      ...workingComponents.slice(0, idx),
      { ...preIncrement, used: preIncrement.used + 1 },
      ...workingComponents.slice(idx + 1),
    ]
  }
  return total
}

export interface SwapRow {
  driverId: string
  driverShortName: string
  element: ComponentElement
  used: number
  limit: number
  band: 'warning' | 'danger'
  projectedPenalty: number
  elected: boolean
}

/**
 * Render-ready rows for the Component Strategy sub-section in the
 * Factory Power Unit card. One row per (driver × element) where the
 * next introduction would hit or exceed the season limit. The UI
 * decides which to show; the engine just tells it the band, the
 * numbers, and whether a swap is already elected for that pair.
 *
 * Visual bands (locked from spec §4.2):
 * - `warning`: `used + 1 == limit` → last "free" introduction available.
 * - `danger`:  `used + 1 >  limit` → next introduction will incur a penalty.
 */
export function componentSwapRows(
  team: Team,
  playerDrivers: ReadonlyArray<{ id: string; shortName: string }>,
): SwapRow[] {
  const rows: SwapRow[] = []
  for (const c of team.components) {
    const projection = c.used + 1
    if (projection < c.limit) continue
    const band: SwapRow['band'] = projection === c.limit ? 'warning' : 'danger'
    // PRE-INCREMENT penalty calculation, guarded by `c.used >= c.limit` so
    // warning-band rows (`c.used == c.limit - 1`) report `projectedPenalty: 0`
    // (their swap is the last free introduction and incurs no penalty).
    const penalty = c.used >= c.limit ? getGridPenalty(c) : 0
    for (const drv of playerDrivers) {
      const elected = team.pendingComponentSwaps.some(
        (s) => s.driverId === drv.id && s.element === c.element,
      )
      rows.push({
        driverId: drv.id,
        driverShortName: drv.shortName,
        element: c.element,
        used: c.used,
        limit: c.limit,
        band,
        projectedPenalty: penalty,
        elected,
      })
    }
  }
  return rows
}
```

- [ ] **Step 4: Run tests (expected: PASS)**

Run: `npx vitest run tests/engine/engineering/component-strategy.test.ts`
Expected: all tests pass (Tasks 6+7+8 = ~19 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/engineering/component-strategy.ts tests/engine/engineering/component-strategy.test.ts
git commit -m "feat(factory): add projectedGridLossIfElectedNow + componentSwapRows derivations"
```

---

## Task 9: Wire `tickComponentWear` into `processPostRace` (TDD)

**Files:**
- Modify: `src/engine/core/post-race-processor.ts` (the same per-team write block where Phase 1 added `fastestLapHistory`)
- Create: `tests/engine/core/post-race-component-wear.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/core/post-race-component-wear.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { processPostRace, type RaceResult } from '@/engine/core/post-race-processor'
import { createPRNG } from '@/engine/core/prng'
import { initializeGame } from '@/engine/core/state-manager'

describe('processPostRace — tickComponentWear', () => {
  it('increments every element by 1 on every team after a race', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter((d) => d.teamId && !d.isReserve && !d.isF2)
      .map((d) => d.id)
    const results: RaceResult[] = activeIds.map((id, i) => ({
      driverId: id, position: i + 1, dnf: false, fastestLap: false,
    }))

    const update = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null,
      false, 1, world.gameState.season, 'mclaren', createPRNG(5),
    )

    for (const team of update.teams) {
      const original = world.teams.find((t) => t.id === team.id)!
      for (const c of team.components) {
        const orig = original.components.find((oc) => oc.element === c.element)!
        expect(c.used).toBe(orig.used + 1)
      }
    }
  })

  it('respects the lastProcessedRound idempotency guard (no double-tick)', () => {
    const world = initializeGame('mclaren', 'golden-era', 1)
    const activeIds = world.drivers
      .filter((d) => d.teamId && !d.isReserve && !d.isF2)
      .map((d) => d.id)
    const results: RaceResult[] = activeIds.map((id, i) => ({
      driverId: id, position: i + 1, dnf: false, fastestLap: false,
    }))

    const firstPass = processPostRace(
      world.teams, world.drivers, world.finance,
      [], {}, results, null,
      false, 1, world.gameState.season, 'mclaren', createPRNG(5),
    )
    const secondPass = processPostRace(
      firstPass.teams, firstPass.drivers, firstPass.finance,
      firstPass.narrativeEvents, firstPass.eventCooldowns,
      results, null,
      false, 1, world.gameState.season, 'mclaren', createPRNG(5),
    )

    // Re-submitting same round must not double-tick wear.
    for (const team of secondPass.teams) {
      const firstTeam = firstPass.teams.find((t) => t.id === team.id)!
      for (const c of team.components) {
        const firstC = firstTeam.components.find((fc) => fc.element === c.element)!
        expect(c.used).toBe(firstC.used)
      }
    }
  })
})
```

- [ ] **Step 2: Run tests (expected: FAIL — wear not implemented)**

Run: `npx vitest run tests/engine/core/post-race-component-wear.test.ts`

- [ ] **Step 3: Wire `tickComponentWear` into the per-team write block**

In `src/engine/core/post-race-processor.ts`, locate the write block where Phase 1 added `fastestLapHistory: nextFastestLapHistory` (around line 220). Add the import:

```ts
import { tickComponentWear } from '@/engine/engineering/component-strategy'
```

And modify the same write block. The current Phase 1 block returns:

```ts
return {
  ...team,
  constructorPosition: pos,
  seasonForm: pushForm(team.seasonForm, pos),
  ovrHistory: pushOvrSample(team.ovrHistory, currentOvr),
  fastestLapHistory: nextFastestLapHistory,
  lastProcessedRound: currentRound,
}
```

Change to:

```ts
const worn = tickComponentWear(team)
return {
  ...team,
  constructorPosition: pos,
  seasonForm: pushForm(team.seasonForm, pos),
  ovrHistory: pushOvrSample(team.ovrHistory, currentOvr),
  fastestLapHistory: nextFastestLapHistory,
  components: worn.components,
  lastProcessedRound: currentRound,
}
```

The existing idempotency guard (`if (team.lastProcessedRound >= currentRound) return { ...team, constructorPosition: pos }`) already protects wear from double-tick.

- [ ] **Step 4: Run tests (expected: PASS)**

Run: `npx vitest run tests/engine/core/post-race-component-wear.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npx vitest run`
Expected: green. Phase 1 tests must still pass — `tickComponentWear` doesn't touch any field they read.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/post-race-processor.ts tests/engine/core/post-race-component-wear.test.ts
git commit -m "feat(factory): tick component wear once per team per race in processPostRace"
```

---

## Task 10: Wire `applyPendingSwaps` into the orchestrator (TDD)

**Files:**
- Modify: `src/engine/core/orchestrator.ts` (extend `advanceGamePhase` with management → practice transition handling)
- Modify: `tests/engine/core/orchestrator.test.ts` (extend with management → practice integration test)

- [ ] **Step 1: Write failing tests**

Append to `tests/engine/core/orchestrator.test.ts`:

```ts
describe('orchestrator — management → practice (Phase 2 swap drain)', () => {
  it('drains pendingComponentSwaps and folds penalties into driver.nextRaceGridDrop', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    // Place ICE at limit (4/4) so the next swap incurs a penalty.
    world = {
      ...world,
      teams: world.teams.map((t) => t.id === 'mclaren' ? {
        ...t,
        components: t.components.map((c) =>
          c.element === 'ice' ? { ...c, used: 4 } : c,
        ),
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice', electedRound: 1 },
        ],
      } : t),
    }

    const next = advanceGamePhase(world) // management → practice
    expect(next.gameState.phase).toBe('practice')

    // Pending swap drained
    const mcl = next.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.pendingComponentSwaps).toEqual([])
    // Counter incremented
    expect(mcl.penaltiesTaken).toBe(1)
    // ICE used: 4 → 5
    expect(mcl.components.find((c) => c.element === 'ice')!.used).toBe(5)
    // Driver got the grid drop
    const norris = next.drivers.find((d) => d.id === 'norris')!
    expect(norris.nextRaceGridDrop).toBe(10)
  })

  it('does NOT increment penaltiesTaken when swap stays under limit', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    // ICE at 2/4 — one swap → 3/4 (under limit, no penalty).
    world = {
      ...world,
      teams: world.teams.map((t) => t.id === 'mclaren' ? {
        ...t,
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice', electedRound: 1 },
        ],
      } : t),
    }
    const next = advanceGamePhase(world)
    const mcl = next.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.penaltiesTaken).toBe(0)
    const norris = next.drivers.find((d) => d.id === 'norris')!
    expect(norris.nextRaceGridDrop).toBe(0)
  })

  it('only fires on management → practice (not on other transitions)', () => {
    let world = initializeGame('mclaren', 'golden-era', 42)
    world = {
      ...world,
      gameState: { ...world.gameState, phase: 'practice' },
      teams: world.teams.map((t) => t.id === 'mclaren' ? {
        ...t,
        components: t.components.map((c) =>
          c.element === 'ice' ? { ...c, used: 4 } : c,
        ),
        pendingComponentSwaps: [
          { driverId: 'norris', element: 'ice', electedRound: 1 },
        ],
      } : t),
    }

    const next = advanceGamePhase(world) // practice → qualifying
    const mcl = next.teams.find((t) => t.id === 'mclaren')!
    // Queue must NOT be drained on this transition.
    expect(mcl.pendingComponentSwaps).toHaveLength(1)
    expect(mcl.penaltiesTaken).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests (expected: FAIL)**

Run: `npx vitest run tests/engine/core/orchestrator.test.ts`

- [ ] **Step 3: Extend `advanceGamePhase`**

In `src/engine/core/orchestrator.ts`, add the import:

```ts
import { applyPendingSwaps } from '@/engine/engineering/component-strategy'
```

And modify `advanceGamePhase`:

```ts
export function advanceGamePhase(world: FullGameState): FullGameState {
  const prevPhase = world.gameState.phase
  let next = advancePhase(world)

  if (next.gameState.phase === 'management' && prevPhase !== 'management') {
    next = processManagementEntry(next)
  }

  // Phase 2 (Box 2): drain elected component swaps at the management →
  // practice boundary. Folds per-driver grid penalties into the existing
  // Tier A `driver.nextRaceGridDrop` channel that the strategy page
  // already consumes via `applyGridDrops` after qualifying.
  if (prevPhase === 'management' && next.gameState.phase === 'practice') {
    next = drainPendingSwaps(next)
  }

  return next
}

/**
 * Drain every team's `pendingComponentSwaps`, increment shared element
 * counters, and add per-driver grid penalties to each affected driver's
 * `nextRaceGridDrop`. Pure — returns a new world.
 */
function drainPendingSwaps(world: FullGameState): FullGameState {
  let updatedTeams = world.teams
  let updatedDrivers = world.drivers
  for (const team of world.teams) {
    if (team.pendingComponentSwaps.length === 0) continue
    const result = applyPendingSwaps(team, updatedDrivers, world.gameState.currentRound)
    updatedTeams = updatedTeams.map((t) => t.id === team.id ? result.team : t)
    updatedDrivers = updatedDrivers.map((d) => {
      const penalty = result.gridPenaltyByDriver[d.id]
      return penalty ? { ...d, nextRaceGridDrop: d.nextRaceGridDrop + penalty } : d
    })
  }
  return { ...world, teams: updatedTeams, drivers: updatedDrivers }
}
```

- [ ] **Step 4: Run tests (expected: PASS)**

Run: `npx vitest run tests/engine/core/orchestrator.test.ts`
Expected: 3 new tests pass.

- [ ] **Step 5: Run full suite + Tier A regression**

Run: `npx vitest run`
Expected: full green. Tier A penalty tests must still pass — we extend the channel, not replace it.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/orchestrator.ts tests/engine/core/orchestrator.test.ts
git commit -m "feat(factory): drain pendingComponentSwaps at management->practice transition"
```

---

## Task 11: Add `electComponentSwap` store action (TDD)

**Files:**
- Modify: `src/stores/game-store.ts` (add action signature + thin-dispatch implementation)
- Modify or create: `tests/stores/game-store.test.ts` (extend existing or create — verify the file path)

- [ ] **Step 1: Verify test file exists**

Run: `ls tests/stores/`
If `game-store.test.ts` doesn't exist, create it with a new describe block. If it exists, append.

- [ ] **Step 2: Write failing tests**

Append to `tests/stores/game-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/stores/game-store'

describe('game-store — electComponentSwap', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('mclaren', 'golden-era', 42)
  })

  it('appends a swap entry to the player team pendingComponentSwaps', () => {
    const initialRound = useGameStore.getState().world!.gameState.currentRound
    useGameStore.getState().electComponentSwap('norris', 'ice')
    const world = useGameStore.getState().world!
    const mcl = world.teams.find((t) => t.id === 'mclaren')!
    // electedRound reflects the current world round (`initializeGame` sets
    // `currentRound: 1` for a fresh game; assert against the live value
    // rather than a literal so the test survives any future change).
    expect(mcl.pendingComponentSwaps).toEqual([
      { driverId: 'norris', element: 'ice', electedRound: initialRound },
    ])
  })

  it('is idempotent — re-electing same driver+element does not double-queue', () => {
    useGameStore.getState().electComponentSwap('norris', 'ice')
    useGameStore.getState().electComponentSwap('norris', 'ice')
    const mcl = useGameStore.getState().world!.teams.find((t) => t.id === 'mclaren')!
    expect(mcl.pendingComponentSwaps).toHaveLength(1)
  })

  it('does nothing when world is null', () => {
    useGameStore.setState({ world: null })
    expect(() => useGameStore.getState().electComponentSwap('norris', 'ice')).not.toThrow()
  })
})
```

- [ ] **Step 3: Run tests (expected: FAIL — action not defined)**

- [ ] **Step 4: Add the action**

In `src/stores/game-store.ts`, add to the `GameStore` interface (after existing actions):

```ts
electComponentSwap: (driverId: string, element: import('@/types/team').ComponentElement) => void
```

And to the create body (after `pauseRnD`):

```ts
electComponentSwap: (driverId, element) => {
  const { world } = get()
  if (!world) return
  const playerTeamId = world.gameState.playerTeamId
  const currentRound = world.gameState.currentRound
  const teams = world.teams.map((t) =>
    t.id !== playerTeamId
      ? t
      : electComponentSwapEngine(t, driverId, element, currentRound),
  )
  set({ world: { ...world, teams } })
},
```

Add the import at the top:

```ts
import { electComponentSwap as electComponentSwapEngine } from '@/engine/engineering/component-strategy'
```

- [ ] **Step 5: Run tests (expected: PASS)**

- [ ] **Step 6: Commit**

```bash
git add src/stores/game-store.ts tests/stores/game-store.test.ts
git commit -m "feat(factory): add electComponentSwap thin-dispatch store action"
```

---

## Task 12: Wire Component Strategy sub-section into `power-unit-card.tsx`

**Files:**
- Modify: `src/components/factory/power-unit-card.tsx` (extend props + render new sub-section)
- Modify: `src/app/factory/page.tsx` (derive `swapRows`, pass `team.penaltiesTaken`, wire `electComponentSwap` action)

- [ ] **Step 1: Extend `PowerUnitCardProps`**

In `src/components/factory/power-unit-card.tsx`, change `penaltiesTaken: number` to remain typed but no longer be hardcoded. Add new props:

```ts
import type { SwapRow } from '@/engine/engineering/component-strategy'

interface PowerUnitCardProps {
  components: ComponentAllocation[]
  nextChangeRound?: number
  nextChangeElement?: string
  penaltiesTaken: number
  projectedGridLoss: number
  totalRaces: number
  // New in Phase 2:
  swapRows: SwapRow[]
  onElectSwap: (driverId: string, element: ComponentAllocation['element']) => void
}
```

- [ ] **Step 2: Render the Component Strategy sub-section**

After the existing `<div className="pu-body">` block (which renders the per-element bars), and before the existing `<div className="pu-foot">` block, add:

```tsx
{swapRows.length > 0 && (
  <div className="pu-strategy">
    <div className="fac-phead flush">
      <div className="t">Component Strategy</div>
      <div className="s">PRE-WEEKEND ELECTIONS</div>
    </div>
    <div className="pu-strategy-rows">
      {swapRows.map((row) => (
        <button
          key={`${row.driverId}-${row.element}`}
          type="button"
          className={`pu-swap-row ${row.band} ${row.elected ? 'elected' : ''}`}
          onClick={() => onElectSwap(row.driverId, row.element)}
          disabled={row.elected}
        >
          <span className="pk">
            {row.driverShortName} · {row.element.toUpperCase()} · {row.used}/{row.limit} USED
          </span>
          <span className="pv">
            {row.elected ? 'ELECTED' : (
              row.band === 'danger'
                ? `INTRODUCE NEW · −${row.projectedPenalty} PL`
                : 'INTRODUCE NEW · FREE'
            )}
          </span>
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3a: Read `src/app/globals.css` to learn the design tokens**

Before writing any new CSS, read `src/app/globals.css` and inventory the available design tokens:
- `--line-*` (border colors)
- `--surface-*` (background tiers)
- `--ink-*` (text colors)
- `--sig-*` (signal accents — amber, red, green, cyan, lime)
- `--font-mono`, `--font-display`

Map the placeholder tokens in Step 3b (`--sig-amber`, `--sig-red`, `--surface-paper`, `--surface-raised`, `--ink-hi`, `--line-sub`, `--line-hair`) to actual tokens from the file. Phase 1's CSS already touches the `.fac-panel`/`.pu-card` styles — reuse the same vocabulary.

- [ ] **Step 3b: Add minimal CSS for the new sub-section**

In `src/app/globals.css` (or wherever `.fac-panel` styles live), add:

```css
.pu-strategy {
  margin-top: 12px;
  border-top: 1px solid var(--line-hair);
  padding-top: 12px;
}
.pu-strategy-rows {
  display: flex; flex-direction: column; gap: 4px;
}
.pu-swap-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border: 1px solid var(--line-sub); border-radius: 4px;
  background: var(--surface-paper); cursor: pointer; transition: opacity 120ms;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em;
  color: var(--ink-hi);
}
.pu-swap-row.warning { border-color: var(--sig-amber); }
.pu-swap-row.danger { border-color: var(--sig-red); }
.pu-swap-row.elected { opacity: 0.55; cursor: not-allowed; }
.pu-swap-row:hover:not(.elected) { background: var(--surface-raised); }
```

(Adjust class/variable names to match the project's existing CSS — read `src/app/globals.css` to confirm the design tokens before writing this block.)

- [ ] **Step 4: Wire from `page.tsx`**

In `src/app/factory/page.tsx`:

```ts
import { componentSwapRows, projectedGridLossIfElectedNow } from '@/engine/engineering/component-strategy'

// In the component body, alongside other derivations:
const playerDriverIds = drivers.filter((d) => d.teamId === playerTeam.id && !d.isReserve)
const playerDriversForRows = playerDriverIds.map((d) => ({ id: d.id, shortName: d.shortName }))
const swapRows = componentSwapRows(playerTeam, playerDriversForRows)

// Replace the hardcoded penaltiesTaken={0} with:
penaltiesTaken={playerTeam.penaltiesTaken}

// Replace the existing projectedGridLoss derivation:
const gridLoss = playerDriverIds
  .reduce((sum, d) => sum + projectedGridLossIfElectedNow(playerTeam, d.id), 0)
  // OR if you prefer the old "if all current overflows materialised" view, keep the
  // existing `projectedGridLoss(playerTeam.components)`. The plan defaults to the
  // pending-swap-aware projection.

// Add to <PowerUnitCard>:
<PowerUnitCard
  ...
  swapRows={swapRows}
  onElectSwap={electComponentSwap}
/>

// And import the action from the store:
const electComponentSwap = useGameStore((s) => s.electComponentSwap)
```

- [ ] **Step 5: Type-check + dev server smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run dev` (background) + `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/factory --max-time 30`
Expected: HTTP 200.

Manually open `/factory` and verify:
- The Component Strategy sub-section is hidden when no element is at risk (default starting state).
- After playing 3 races (which ticks ICE/Turbo/MGU-K/Gearbox to 3/4 each), the strategy section appears with warning rows for each driver.
- Clicking "INTRODUCE NEW" updates the row to "ELECTED" without throwing.
- Penalties Taken footer reads `0` initially and increments after a penalty-incurring election + race start.

- [ ] **Step 6: Commit**

```bash
git add src/components/factory/power-unit-card.tsx src/app/factory/page.tsx src/app/globals.css
git commit -m "feat(factory): add Component Strategy sub-section to PU card; wire real penaltiesTaken"
```

---

## Task 13: Update `docs/architecture/persistence-contract.md`

**Files:**
- Modify: `docs/architecture/persistence-contract.md` (header last-updated stamp + §5 v9→v10 entry)

- [ ] **Step 1: Update the last-updated stamp**

Change the header's "Last updated" line to reference Phase 2.

- [ ] **Step 2: Update §5 Current state**

```markdown
- `SCHEMA_VERSION = 10`
- `MIGRATIONS = { 1: v1→v2, 2: v2→v3, 3: v3→v4, 4: v4→v5, 5: v5→v6, 6: v6→v7, 7: v7→v8, 8: v8→v9, 9: v9→v10 }`
```

- [ ] **Step 3: Append the v9→v10 paragraph**

```markdown
  - v9→v10 adds two persisted team fields for the Factory Box 2 — Power Unit strategy. On every `team`: `penaltiesTaken` ← `0` (running season counter, increments when an elected swap pushes a team-shared element past its season limit) and `pendingComponentSwaps` ← `[]` (queued player elections; each entry names the driver who pays the grid penalty if applicable). Existing team fields preserved verbatim. The grid penalty is folded into the existing Tier A `driver.nextRaceGridDrop` channel at the management → practice transition by `applyPendingSwaps()` in `src/engine/engineering/component-strategy.ts`. Both fields reset at season end.
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/persistence-contract.md
git commit -m "docs(persistence): document v9->v10 migration (Factory Box 2 strategy)"
```

---

## Task 14: Validation gate

**Files:** (no code changes)

- [ ] **Step 1: TypeScript clean**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 2: Full test suite green**

Run: `npx vitest run`
Expected: green. Phase 2 adds ~20 new tests (4 migration + 13 component-strategy + 2 wear + 3 orchestrator integration + 3 store action ≈ 25). Total should be ~470 passing.

- [ ] **Step 3: Lint at pre-existing baseline**

Run: `npm run lint`
Expected: error count unchanged from main (Phase 2 introduces no new violations).

- [ ] **Step 4: Determinism replay byte-identical**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts -t "determinism replay"`
Expected: the named replay test (race-simulator.test.ts:422 — "determinism replay: the same seed produces byte-identical results across two runs") passes. Then run the broader suite: `npx vitest run tests/engine/race` — full green. Phase 2 added zero PRNG calls and zero changes under `src/engine/race/**`; the replay must remain byte-identical.

- [ ] **Step 5: Manual playthrough**

Start a fresh game on McLaren. Play 3 races without touching the strategy panel — observe the PU card shows real `Penalties Taken: 0` (no longer hardcoded) and the Component Strategy section is hidden. Play 1-2 more races to drive ICE/Turbo/MGU-K/Gearbox to 3/4 each. The strategy section should now show rows. Elect "INTRODUCE NEW" on Norris's ICE row when ICE is at 4/4 — the row should switch to "ELECTED · APPLIES Rxx", and the Projected Grid Loss footer should show `−10 PL`. Continue to the next race start: Norris should start with a 10-place grid drop, `Penalties Taken` should now read `1`, and the Component Strategy queue should be empty again.

If any of those don't match, surface to the user before merging.

- [ ] **Step 6: Update memory + handoff**

The `project_factory_three_cards_design_paused.md` memory file's Phase 2 section flips from "to do" to "SHIPPED". Phase 3 (Box 3 — Aero Testing) becomes the next pending phase.

```bash
# Optional: run the finishing-a-development-branch skill to choose merge strategy.
```

---

## Acceptance criteria (Phase 2 done when ALL pass)

1. `npx tsc --noEmit` clean.
2. `npx vitest run` full green; ~25 new tests added.
3. `npm run lint` no new violations.
4. Determinism replay byte-identical.
5. Migration v9 → v10 round-trip test passes; legacy save loads with both new fields defaulted.
6. Factory page renders without prop errors; Component Strategy sub-section appears only when at least one element has `used + 1 >= limit`.
7. Electing "INTRODUCE NEW" on a danger-band row results in `nextRaceGridDrop` being set on the named driver after the next management → practice transition, and `Penalties Taken` increments by exactly 1.
8. Electing on a warning-band row drains the queue without incrementing `Penalties Taken`.
9. The same driver can be elected for swaps on multiple elements; total grid drop sums correctly.
10. `persistence-contract.md` §5 lists both new persisted fields under v9→v10.
11. No new `Math.random()` calls in any new file. No new browser API usage in any engine file.
12. Tier A penalty tests (`tests/engine/race/penalty-engine.test.ts` and related) remain green.

---

## Out of scope for this phase (locked)

- Per-component-instance tracking. ICE counter remains a single team-shared `{used, limit}` integer.
- Circuit-stress wear model. Each race ticks `+1` per element regardless of circuit characteristics.
- Mid-race component swaps. Election is pre-weekend only.
- Wiring `checkMechanicalFailure` into the simulator. (Belongs to a future phase — would populate `failureEvents` from Phase 1.)
- Per-driver wear pools (would require reshaping `team.components` into per-driver arrays — locked out of the entire spec).
- AI teams electing swaps strategically. AI teams' `pendingComponentSwaps` stays empty in Phase 2; their components still tick wear normally.
- Any visual change to other Factory cards (Car Performance, Aero Testing).
- Changes under `src/engine/race/**`. The race simulator is untouched.
