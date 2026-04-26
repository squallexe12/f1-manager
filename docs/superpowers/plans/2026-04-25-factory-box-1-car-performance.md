# Factory Box 1 — Car Performance Real-Data Wiring (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two heuristic readouts in the Factory's Car Performance hero card (Δ vs Leader, Reliability MTBF) with real-data-grounded values: a 3-race rolling fastest-lap delta against the championship leader, and an MTBF function ready to consume real failure events while gracefully falling back to a per-element-wear-aware heuristic.

**Architecture:** Add two persisted rolling buffers to `Team` (`fastestLapHistory`, `failureEvents`), plumb the existing `runtime.fastestLap` produced by the race worker through to `processPostRace`, append per-team entries on every race, and surface two new pure derivations (`deltaVsLeaderFromHistory`, `mtbfFromFailureLog`) wired into the Factory page. Schema bumps v8 → v9 with a strictly additive migration.

**Tech Stack:** TypeScript strict, Vitest (`fake-indexeddb` for persistence tests), Zustand store (untouched in this phase — no new actions), Next.js App Router page (one prop wiring change).

**Spec reference:** [docs/superpowers/specs/2026-04-25-factory-three-cards-real-data-design.md](../specs/2026-04-25-factory-three-cards-real-data-design.md) §4.1, §5.1, §6.1 Phase 1, §8 Phase 1.

**Pipeline:** AGENTS.md Pipeline A (sim-engine → game-state → ui-interface → verify). Phase 1 has no `game-state` work (no new store action) and only a single-line `ui-interface` change (route new helpers from page.tsx). The bulk is `sim-engine` and `verify`.

---

## File structure (locked before tasks begin)

| File | Action | Responsibility |
|---|---|---|
| `src/types/team.ts` | Modify | Add `FastestLapEntry`, `FailureEvent` types; extend `Team` interface |
| `src/data/teams.ts` | Modify | Add new fields to `TeamData` Omit list (runtime-populated, not seeded) |
| `src/engine/core/state-manager.ts` | Modify | Initialize `fastestLapHistory: []`, `failureEvents: []` on team build |
| `src/engine/core/season-end-processor.ts` | Modify | Reset both buffers to `[]` at season end |
| `src/engine/core/save-system.ts` | Modify | Bump `SCHEMA_VERSION` 8 → 9; add `migrateV8ToV9` |
| `src/engine/core/post-race-processor.ts` | Modify | Add `fastestLap` parameter; append `FastestLapEntry` per team |
| `src/engine/core/orchestrator.ts` | Modify | Pass `runtime.fastestLap` through to `processPostRace` |
| `src/engine/engineering/car-performance-insights.ts` | **Create** | Pure: `deltaVsLeaderFromHistory`, `mtbfFromFailureLog` |
| `src/app/factory/page.tsx` | Modify | Replace `factory-insights` heuristic calls with new module |
| `docs/architecture/persistence-contract.md` | Modify | Add two new persisted fields to §1 |
| `tests/engine/engineering/car-performance-insights.test.ts` | **Create** | Pure unit tests |
| `tests/engine/core/post-race-processor.test.ts` | Extend | Buffer append + pruning behavior |
| `tests/engine/core/save-system.test.ts` | Extend | v8 → v9 round-trip |

`FastestLapEntry` and `FailureEvent` go in `team.ts` (not `race.ts` as the spec drafted) because they're stored on `Team` and follow the same pattern as `ComponentAllocation`. This is the single deliberate divergence from the spec's filename hint.

`failureEvents` infrastructure lands in this phase but stays empty — `checkMechanicalFailure` is defined but never called in the codebase today. That's deliberate: the buffer + types + MTBF function with both branches ship now; the trigger wires up in a future phase. The MTBF heuristic fallback path is exercised throughout Phase 1, just with real per-element wear ratios instead of an averaged ratio.

---

## Determinism gate

This phase touches `post-race-processor.ts` and `state-manager.ts`. Per AGENTS.md, the determinism replay test must remain byte-identical for the same seed. All new code is deterministic — no PRNG. After Task 9, run a full season with a fixed seed and assert `world.teams` is byte-identical given the same player decisions.

---

## Task 1: Add `FastestLapEntry`, `FailureEvent`, and `ComponentElement` to `src/types/team.ts`

**Files:**
- Modify: `src/types/team.ts:33-38` (add `ComponentElement` type alias above/below `ComponentAllocation`)
- Modify: `src/types/team.ts:107` (extend `Team` interface — add fields right before the closing brace)

- [ ] **Step 1: Add a `ComponentElement` type alias**

The spec consistently uses `ComponentElement` as a named type (matches `'ice' | 'turbo' | 'mgu-k' | 'ers-battery' | 'gearbox'`), but the codebase only has the inline union inside `ComponentAllocation`. Add a named alias right after the `ComponentAllocation` interface (around line 38):

```ts
export type ComponentElement = ComponentAllocation['element']
```

This keeps `ComponentAllocation` as the single source of truth (the union literally lives there) while giving the rest of the codebase — including `FailureEvent`, `PendingComponentSwap` (Phase 2), and any future imports — a clean named type to reference.

- [ ] **Step 2: Read the existing `Team` interface end**

Run: open `src/types/team.ts` and locate the closing `}` of the `Team` interface (currently line 107).

- [ ] **Step 3: Add new types**

Insert at the bottom of the file:

```ts
/**
 * One entry in the rolling fastest-lap log used by the Factory car-performance
 * card to compute Δ vs Leader. Captures only the absolute race-wide fastest
 * lap when one of this team's drivers held it that round; teams that never
 * post a race-wide fastest lap simply have no entries (and fall back to the
 * OVR-diff heuristic for the Δ readout).
 */
export interface FastestLapEntry {
  round: number
  lapMs: number
}

/**
 * One mechanical-failure event recorded against a team during a race. The
 * trigger (currently unwired — `checkMechanicalFailure` is defined but not
 * yet called by the simulator) is reserved for a later phase. Phase 1 ships
 * the buffer + the read path so the MTBF derivation can graduate from
 * heuristic to real data without a follow-up schema change.
 */
export interface FailureEvent {
  round: number
  lap: number
  element: ComponentElement
  driverId: string
}
```

- [ ] **Step 4: Extend the `Team` interface**

In the `Team` interface, add these two fields adjacent to the existing `ovrHistory` / `lastUpgradeRound` (around line 100-106):

```ts
  /**
   * Rolling log of race-wide fastest laps held by this team's drivers,
   * ordered oldest → newest. Capped at 6 entries (FIFO trim on append).
   * Cleared at season end. Drives the Factory Δ-vs-Leader readout.
   */
  fastestLapHistory: FastestLapEntry[]
  /**
   * Rolling log of mechanical-failure events this season, ordered
   * oldest → newest. Capped at 10 entries (FIFO trim on append). Cleared
   * at season end. Currently unwritten (trigger lands in a later phase);
   * the read path falls back to a per-element-wear heuristic when empty.
   */
  failureEvents: FailureEvent[]
```

- [ ] **Step 5: Type-check (expected to fail)**

Run: `npx tsc --noEmit`
Expected: errors in `src/data/teams.ts`, `src/engine/core/state-manager.ts`, `src/engine/core/save-system.ts`, `src/engine/core/season-end-processor.ts` — every site that constructs a `Team` literal must be updated.

- [ ] **Step 6: Do NOT commit yet**

This task ships only after Task 2 + 3 + 4 land — the type extension causes a compile cascade that needs all four files together for the build to be green.

---

## Task 2: Update `TeamData` Omit list + initialize fields in state-manager

**Files:**
- Modify: `src/data/teams.ts:9-23` (extend the `TeamData = Omit<...>` type)
- Modify: `src/engine/core/state-manager.ts:83-84` (the existing `ovrHistory: [], lastUpgradeRound: 0` block, twice — once per team-build site)

- [ ] **Step 1: Add new field names to the `TeamData` Omit list**

Edit `src/data/teams.ts:9-23`. Add `'fastestLapHistory'` and `'failureEvents'` to the Omit union:

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
  | 'staff'
> & {
  staff: Omit<DepartmentHead, 'contractEndSeason'>[]
}
```

- [ ] **Step 2: Initialize the new fields in `state-manager.ts`**

Locate every `ovrHistory: [],\n    lastUpgradeRound: 0,` pair (currently around lines 83-84 and 103-104 — there are two team-build sites). After each, add:

```ts
    fastestLapHistory: [],
    failureEvents: [],
```

- [ ] **Step 3: Type-check (expected to still fail until Task 3 + 4)**

Run: `npx tsc --noEmit`
Expected: remaining errors should now be in `save-system.ts` (migration site) and `season-end-processor.ts` (reset site) only.

---

## Task 3: Reset new fields in `season-end-processor.ts`

**Files:**
- Modify: `src/engine/core/season-end-processor.ts:122-135` (the existing per-team reset block — extend it)

- [ ] **Step 1: Locate the existing season-end team reset**

Open `src/engine/core/season-end-processor.ts` and find the block that currently resets `windTunnelHoursUsed: 0`, `cfdRunsUsed: 0`, `ovrHistory: []`, `lastUpgradeRound: 0` (around lines 122-135).

- [ ] **Step 2: Add reset for the new fields**

Within the same per-team reset object, add:

```ts
    fastestLapHistory: [],
    failureEvents: [],
```

- [ ] **Step 3: Type-check (expected: only save-system error remains)**

Run: `npx tsc --noEmit`
Expected: error narrowed to `src/engine/core/save-system.ts` — the migration map doesn't yet handle the new schema version.

---

## Task 4: Bump `SCHEMA_VERSION` and add v8 → v9 migration

**Files:**
- Modify: `src/engine/core/save-system.ts:10` (SCHEMA_VERSION)
- Modify: `src/engine/core/save-system.ts:126-271` (MIGRATIONS map — add new entry)
- Modify: `src/engine/core/save-system.ts` (header doc comments — add v8 → v9 entry)

- [ ] **Step 1: Bump `SCHEMA_VERSION`**

Change `src/engine/core/save-system.ts:10` from:

```ts
export const SCHEMA_VERSION = 8
```

to:

```ts
export const SCHEMA_VERSION = 9
```

- [ ] **Step 2: Add the migration entry**

In the `MIGRATIONS` map, add after the existing entry `7` (penalty Tier A):

```ts
  /**
   * v8 → v9 (Factory Box 1 — Car Performance real data): Adds two rolling
   * buffers to every team. `fastestLapHistory` (capped at 6) drives the
   * Δ-vs-Leader readout once a team has held a race-wide fastest lap;
   * `failureEvents` (capped at 10) is reserved for a future phase that
   * wires `checkMechanicalFailure` into the simulator. Both buffers are
   * cleared at season end. Defaults are `[]` so legacy saves render with
   * the heuristic fallback until enough rounds populate the lap log.
   */
  8: (data) => ({
    ...data,
    teams: data.teams.map((team) => ({
      ...team,
      fastestLapHistory: team.fastestLapHistory ?? [],
      failureEvents: team.failureEvents ?? [],
    })),
  }),
```

- [ ] **Step 3: Add a header doc comment for v8 → v9**

In the JSDoc block at the top of the file (currently documenting v1 → v8 transitions), append a paragraph mirroring the existing style:

```
 * v8 → v9 (Factory Box 1 — Car Performance real data): Adds
 * `team.fastestLapHistory: []` and `team.failureEvents: []`. Both start
 * empty; post-race processing appends to `fastestLapHistory` for the team
 * whose driver held the absolute race-wide fastest lap. `failureEvents`
 * trigger lands in a later phase. Both buffers are FIFO-capped (6 / 10
 * respectively) and cleared at season end.
```

- [ ] **Step 4: Type-check (expected to pass)**

Run: `npx tsc --noEmit`
Expected: clean exit, zero errors.

- [ ] **Step 5: Run the existing test suite (expected: all green)**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: every existing migration test passes (we only added an entry, didn't modify existing ones).

- [ ] **Step 6: Commit (Task 1-4 ship together)**

```bash
git add src/types/team.ts src/data/teams.ts src/engine/core/state-manager.ts src/engine/core/season-end-processor.ts src/engine/core/save-system.ts
git commit -m "feat(factory): add fastestLapHistory + failureEvents persisted buffers (v8→v9 schema)"
```

---

## Task 5: Add v8 → v9 migration test

**Files:**
- Modify: `tests/engine/core/save-system.test.ts` (extend — pattern matches existing v6 → v7, v7 → v8 tests)

- [ ] **Step 1: Locate the existing migration round-trip pattern**

Open `tests/engine/core/save-system.test.ts` and find the existing `describe('v7 → v8 migration (Penalty System Tier A)', ...)` block at line ~590. The pattern that's used (verified): build a v(N-1)-shaped state literal **inline** (no extracted helper), call `migrateToCurrent(state as any, N-1)`, then assert the new fields are present and defaulted. The codebase does NOT use a `makeV*Fixture()` helper — fixtures are inline per-test.

- [ ] **Step 2: Write the failing test**

Add a new `describe('migration v8 → v9 (Factory Box 1 buffers)', ...)` block immediately after the existing v7→v8 block. Build the fixture inline by destructuring an existing v8 fixture pattern from earlier in the file (or by copying the v7 fixture and adding the four penalty fields the v7→v8 migration would have added). Then drop `fastestLapHistory` and `failureEvents` from every team:

```ts
describe('migration v8 → v9 (Factory Box 1 buffers)', () => {
  // Build a v8-shaped state inline. Pattern mirrors the v7→v8 test at line ~590.
  // Drop fastestLapHistory and failureEvents from every team — that's what a
  // pre-migration v8 save looks like.
  function makeV8State(): unknown {
    return {
      // ... copy structure from the v7→v8 test fixture, then add Tier-A
      // penalty fields (penaltyPoints: [], warningsThisSeason: 0,
      // nextRaceGridDrop: 0, banUntilRound: null) on each driver to make
      // it v8-shaped. Omit fastestLapHistory + failureEvents from teams.
      teams: [
        { /* all v7 fields ... */ }, // no fastestLapHistory/failureEvents
      ],
      drivers: [
        { /* all v7 fields ... */, penaltyPoints: [], warningsThisSeason: 0,
          nextRaceGridDrop: 0, banUntilRound: null },
      ],
      // ...other top-level fields unchanged from v7→v8 fixture
    }
  }

  it('adds empty fastestLapHistory and failureEvents to every team', () => {
    const fixture = makeV8State()
    const { data, migrated } = migrateToCurrent(fixture as never, 8)
    expect(migrated).toBe(true)
    for (const team of data.teams) {
      expect(team.fastestLapHistory).toEqual([])
      expect(team.failureEvents).toEqual([])
    }
  })

  it('preserves existing buffers verbatim if already present', () => {
    const fixture = makeV8State() as { teams: Array<Record<string, unknown>> }
    fixture.teams[0].fastestLapHistory = [{ round: 3, lapMs: 78_421 }]
    fixture.teams[0].failureEvents = [
      { round: 2, lap: 14, element: 'ice', driverId: 'norris' },
    ]
    const { data } = migrateToCurrent(fixture as never, 8)
    expect(data.teams[0].fastestLapHistory).toEqual([{ round: 3, lapMs: 78_421 }])
    expect(data.teams[0].failureEvents).toHaveLength(1)
  })
})
```

If the implementer prefers, they can extract `makeV8State` into a shared helper at the top of the file — but that's a refactor, not a requirement. Following the existing inline pattern is acceptable and the path of least resistance.

- [ ] **Step 3: Run test (expected: PASS — migration was implemented in Task 4)**

Run: `npx vitest run tests/engine/core/save-system.test.ts`
Expected: every test passes including the two new ones.

- [ ] **Step 4: Commit**

```bash
git add tests/engine/core/save-system.test.ts
git commit -m "test(factory): cover v8→v9 migration round-trip"
```

---

## Task 6: Plumb `fastestLap` parameter through `processPostRace` (mechanical plumbing only)

> **TDD note:** Task 6 introduces NO new behavior. All existing tests must remain green after the mechanical signature change + `null` insertion. The behavioral test (asserting that an entry actually appends) lives in Task 7. Do not write a behavioral test in Task 6 — that conflates the two tasks.

**The full call chain (verified in current codebase):**

| File | Function | Current state |
|---|---|---|
| `src/engine/core/post-race-processor.ts:54` | `processPostRace(teams, drivers, finance, narrativeEvents, eventCooldowns, results, isSprint, currentRound, currentSeason, playerTeamId, rng)` | The leaf — does the actual post-race work |
| `src/engine/core/orchestrator.ts:109-136` | `processPostRacePhase(world, eventCooldowns, results, isSprint)` | Wraps `processPostRace` and threads `world.*` fields through |
| `src/stores/game-store.ts:168` | (action that calls `processPostRacePhase`) | Single store-side entry point |
| `src/stores/race-runtime-slice.ts:54` | `fastestLap: { driverId, time } \| null` | Source of the value — already populated by the worker |

`processPostRace` has exactly **one caller** (`processPostRacePhase`), which has exactly **one caller** (the game-store action at `game-store.ts:168`). Everything in the chain is in scope of `runtime.fastestLap`.

**Files:**
- Modify: `src/engine/core/post-race-processor.ts:54` (signature)
- Modify: `src/engine/core/orchestrator.ts:109-136` (`processPostRacePhase` signature + call site)
- Modify: `src/stores/game-store.ts:168` (action — thread `runtime.fastestLap` through)
- Modify: existing tests for `processPostRace` and any test for `processPostRacePhase` (mechanical `null` insertion)

- [ ] **Step 1: Add the parameter to `processPostRace` signature**

Edit `src/engine/core/post-race-processor.ts:54`. Change the signature from:

```ts
export function processPostRace(
  teams: Team[],
  drivers: Driver[],
  finance: Record<string, FinanceState>,
  narrativeEvents: NarrativeEvent[],
  eventCooldowns: Record<string, number>,
  results: RaceResult[],
  isSprint: boolean,
  currentRound: number,
  currentSeason: number,
  playerTeamId: string,
  rng: PRNG,
): PostRaceUpdate
```

to (one new positional parameter inserted after `results`):

```ts
export function processPostRace(
  teams: Team[],
  drivers: Driver[],
  finance: Record<string, FinanceState>,
  narrativeEvents: NarrativeEvent[],
  eventCooldowns: Record<string, number>,
  results: RaceResult[],
  fastestLap: { driverId: string; time: number } | null,
  isSprint: boolean,
  currentRound: number,
  currentSeason: number,
  playerTeamId: string,
  rng: PRNG,
): PostRaceUpdate
```

The new param is **required positional** (not optional-trailing) — every existing caller will fail to type-check until updated. The body of `processPostRace` does not yet read the new parameter; behavior is unchanged in this task.

- [ ] **Step 2: Update `processPostRacePhase` signature + body in `orchestrator.ts`**

Edit `src/engine/core/orchestrator.ts:109-136`. Change `processPostRacePhase` from:

```ts
export function processPostRacePhase(
  world: FullGameState,
  eventCooldowns: Record<string, number>,
  results: RaceResult[],
  isSprint: boolean,
): PostRaceOrchestratorResult {
  const rng = createPRNG(world.gameState.seed + world.gameState.currentRound + 999)
  const update = processPostRace(
    world.teams, world.drivers, world.finance,
    world.narrativeEvents, eventCooldowns,
    results, isSprint,
    world.gameState.currentRound,
    world.gameState.season,
    world.gameState.playerTeamId,
    rng,
  )
  // ...
}
```

to (add `fastestLap` parameter and thread it to `processPostRace`):

```ts
export function processPostRacePhase(
  world: FullGameState,
  eventCooldowns: Record<string, number>,
  results: RaceResult[],
  fastestLap: { driverId: string; time: number } | null,
  isSprint: boolean,
): PostRaceOrchestratorResult {
  const rng = createPRNG(world.gameState.seed + world.gameState.currentRound + 999)
  const update = processPostRace(
    world.teams, world.drivers, world.finance,
    world.narrativeEvents, eventCooldowns,
    results, fastestLap, isSprint,
    world.gameState.currentRound,
    world.gameState.season,
    world.gameState.playerTeamId,
    rng,
  )
  // ...
}
```

- [ ] **Step 3: Update the game-store call site to thread `runtime.fastestLap`**

Open `src/stores/game-store.ts:168`. The call currently looks like:

```ts
const update = processPostRacePhase(world, eventCooldowns, results, isSprint)
```

The action has access to the race-runtime slice via the same store. Pull `fastestLap` from runtime:

```ts
const fastestLap = get().runtime?.fastestLap ?? null
const update = processPostRacePhase(world, eventCooldowns, results, fastestLap, isSprint)
```

(Adjust the `get().runtime?.fastestLap` access pattern to match how other race-runtime fields are read in the same action — the actual selector path may differ slightly. Read the surrounding code.)

- [ ] **Step 4: Type-check (expected: clean) + tests fail mechanically**

Run: `npx tsc --noEmit`
Expected: clean. Any failures here mean a call site was missed.

Run: `npx vitest run tests/engine/core/post-race-processor.test.ts`
Expected: existing tests **fail** because they call `processPostRace` with the old signature.

- [ ] **Step 5: Update each `processPostRace` test call site**

Use Grep to find every `processPostRace(` call in the test file. At each call, insert `null` as the new 7th argument (between `results` and `isSprint`). The `null` preserves existing behavior — no fastest-lap append until Task 7's behavioral path lands.

If `processPostRacePhase` has its own tests, the same mechanical update applies (`fastestLap: null` between `results` and `isSprint`).

- [ ] **Step 6: Tests green again, commit**

Run: `npx vitest run`
Expected: full green.

```bash
git add src/engine/core/post-race-processor.ts src/engine/core/orchestrator.ts src/stores/game-store.ts tests/engine/core/post-race-processor.test.ts tests/engine/core/orchestrator.test.ts
git commit -m "refactor(factory): plumb fastestLap from runtime slice through processPostRacePhase to processPostRace"
```

(Drop `tests/engine/core/orchestrator.test.ts` from the staged set if it didn't exist; add any other test file that needed the mechanical `null` insertion.)

---

## Task 7: Append `FastestLapEntry` per team in `processPostRace` (TDD)

**Files:**
- Modify: `src/engine/core/post-race-processor.ts` (inside `processPostRace`, alongside the existing `seasonForm` / `ovrHistory` write at line 218)
- Modify: `tests/engine/core/post-race-processor.test.ts` (extend)

- [ ] **Step 1: Write the failing test (TDD-first)**

Add to `tests/engine/core/post-race-processor.test.ts`:

```ts
describe('fastestLapHistory append', () => {
  it('appends an entry to the team whose driver held the race-wide fastest lap', () => {
    const teams = [makeTeam({ id: 'mclaren', driverIds: ['norris', 'piastri'] })]
    const drivers = [makeDriver({ id: 'norris', teamId: 'mclaren' })]
    const results: RaceResult[] = [
      { driverId: 'norris', position: 1, dnf: false, fastestLap: true },
    ]
    const fastestLap = { driverId: 'norris', time: 78_421 }

    const update = processPostRace(
      teams, drivers, makeFinance(), [], {},
      results, fastestLap,
      false, 1, 2026, 'mclaren', makePrng(),
    )

    expect(update.teams[0].fastestLapHistory).toEqual([
      { round: 1, lapMs: 78_421 },
    ])
  })

  it('does not append for teams whose drivers did not hold the fastest lap', () => {
    const teams = [
      makeTeam({ id: 'mclaren', driverIds: ['norris', 'piastri'] }),
      makeTeam({ id: 'red-bull', driverIds: ['verstappen', 'hadjar'] }),
    ]
    const drivers = [
      makeDriver({ id: 'norris', teamId: 'mclaren' }),
      makeDriver({ id: 'verstappen', teamId: 'red-bull' }),
    ]
    const fastestLap = { driverId: 'verstappen', time: 78_100 }
    const update = processPostRace(
      teams, drivers, makeFinance(), [], {},
      [{ driverId: 'verstappen', position: 1, dnf: false, fastestLap: true }],
      fastestLap, false, 1, 2026, 'mclaren', makePrng(),
    )
    expect(update.teams.find((t) => t.id === 'mclaren')!.fastestLapHistory).toEqual([])
    expect(update.teams.find((t) => t.id === 'red-bull')!.fastestLapHistory).toEqual([
      { round: 1, lapMs: 78_100 },
    ])
  })

  it('FIFO-trims the buffer to the last 6 entries', () => {
    const team = makeTeam({
      id: 'mclaren',
      driverIds: ['norris', 'piastri'],
      fastestLapHistory: [
        { round: 1, lapMs: 78_000 }, { round: 2, lapMs: 78_100 },
        { round: 3, lapMs: 78_200 }, { round: 4, lapMs: 78_300 },
        { round: 5, lapMs: 78_400 }, { round: 6, lapMs: 78_500 },
      ],
    })
    const update = processPostRace(
      [team], [makeDriver({ id: 'norris', teamId: 'mclaren' })],
      makeFinance(), [], {},
      [{ driverId: 'norris', position: 1, dnf: false, fastestLap: true }],
      { driverId: 'norris', time: 78_600 },
      false, 7, 2026, 'mclaren', makePrng(),
    )
    expect(update.teams[0].fastestLapHistory).toHaveLength(6)
    expect(update.teams[0].fastestLapHistory[0].round).toBe(2) // round 1 dropped
    expect(update.teams[0].fastestLapHistory[5].round).toBe(7)
  })

  it('skips append when fastestLap is null (no fastest lap recorded)', () => {
    const team = makeTeam({ id: 'mclaren', driverIds: ['norris', 'piastri'] })
    const update = processPostRace(
      [team], [makeDriver({ id: 'norris', teamId: 'mclaren' })],
      makeFinance(), [], {},
      [{ driverId: 'norris', position: 1, dnf: false, fastestLap: false }],
      null,
      false, 1, 2026, 'mclaren', makePrng(),
    )
    expect(update.teams[0].fastestLapHistory).toEqual([])
  })

  it('respects the existing lastProcessedRound idempotency guard', () => {
    const team = makeTeam({
      id: 'mclaren',
      driverIds: ['norris', 'piastri'],
      lastProcessedRound: 1, // already processed round 1
      fastestLapHistory: [{ round: 1, lapMs: 78_000 }],
    })
    const update = processPostRace(
      [team], [makeDriver({ id: 'norris', teamId: 'mclaren' })],
      makeFinance(), [], {},
      [{ driverId: 'norris', position: 1, dnf: false, fastestLap: true }],
      { driverId: 'norris', time: 78_500 },
      false, 1, 2026, 'mclaren', makePrng(),
    )
    // No double-append on re-processing the same round
    expect(update.teams[0].fastestLapHistory).toEqual([{ round: 1, lapMs: 78_000 }])
  })
})
```

(`makeTeam`, `makeDriver`, `makeFinance`, `makePrng` are existing test helpers in the post-race-processor test file. Reuse them; if `makeTeam` doesn't accept `fastestLapHistory` overrides, extend it inline in the test.)

- [ ] **Step 2: Run test (expected: FAIL)**

Run: `npx vitest run tests/engine/core/post-race-processor.test.ts`
Expected: the new tests fail because `fastestLapHistory` append isn't implemented yet.

- [ ] **Step 3: Implement the append**

In `src/engine/core/post-race-processor.ts`, locate the existing per-team write block at lines 207-222 (inside the `updatedTeams = updatedTeams.map(...)` for sorted positions). The block already writes `seasonForm` and `ovrHistory` under the `lastProcessedRound` idempotency guard. Add fastest-lap append in the same branch:

```ts
// Snapshot OVR alongside constructor position — same idempotency guard
// keeps the sparkline free of duplicate entries on re-runs.
const currentOvr = calculateOverallRating(team.car)
// `team.driverIds` is `[string, string]`; `.includes(string)` works without a cast.
const teamHadFastestLap =
  fastestLap !== null && team.driverIds.includes(fastestLap.driverId)
const nextFastestLapHistory = teamHadFastestLap
  ? pushFastestLap(team.fastestLapHistory, { round: currentRound, lapMs: fastestLap!.time })
  : team.fastestLapHistory
return {
  ...team,
  constructorPosition: pos,
  seasonForm: pushForm(team.seasonForm, pos),
  ovrHistory: pushOvrSample(team.ovrHistory, currentOvr),
  fastestLapHistory: nextFastestLapHistory,
  lastProcessedRound: currentRound,
}
```

`pushFastestLap` is a small helper — add it inline or alongside `pushForm` / `pushOvrSample` in `src/engine/drivers/form-history.ts`:

```ts
export const FASTEST_LAP_WINDOW = 6

export function pushFastestLap(
  history: FastestLapEntry[],
  entry: FastestLapEntry,
): FastestLapEntry[] {
  const next = [...history, entry]
  return next.length > FASTEST_LAP_WINDOW
    ? next.slice(next.length - FASTEST_LAP_WINDOW)
    : next
}
```

- [ ] **Step 4: Run test (expected: PASS)**

Run: `npx vitest run tests/engine/core/post-race-processor.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `npx vitest run`
Expected: full green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/core/post-race-processor.ts src/engine/drivers/form-history.ts tests/engine/core/post-race-processor.test.ts
git commit -m "feat(factory): append fastestLapHistory entry per race for the team holding the race-wide fastest"
```

---

## Task 8: Create `car-performance-insights.ts` with `deltaVsLeaderFromHistory` (TDD)

**Files:**
- Create: `src/engine/engineering/car-performance-insights.ts`
- Create: `tests/engine/engineering/car-performance-insights.test.ts`

- [ ] **Step 1: Write the failing tests (TDD-first)**

Create `tests/engine/engineering/car-performance-insights.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Team } from '@/types/team'
import { deltaVsLeaderFromHistory } from '@/engine/engineering/car-performance-insights'

const makeTeam = (id: string, history: Array<{ round: number; lapMs: number }>): Team => ({
  // minimum-viable Team for the insights helper — most fields irrelevant
  id, name: id, shortName: id.toUpperCase(), color: '#000', headquarters: '',
  powerUnitSupplier: '', driverIds: ['', ''], reserveDriverId: null, staff: [],
  car: { downforce: 70, straightSpeed: 70, reliability: 70, tireManagement: 70, braking: 70, cornering: 70 },
  rndUpgrades: [], components: [], windTunnelHoursUsed: 0, windTunnelHoursLimit: 280,
  cfdRunsUsed: 0, cfdRunsLimit: 2400, morale: 70, aiPersonality: null,
  constructorPoints: 0, constructorPosition: 1, previousConstructorPosition: 0,
  previousMorale: 70, seasonForm: [], lastProcessedRound: 0, ovrHistory: [],
  lastUpgradeRound: 0, fastestLapHistory: history,
  failureEvents: [],
} as Team)

describe('deltaVsLeaderFromHistory', () => {
  it('returns 0 when player IS the leader', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 78_000 }, { round: 2, lapMs: 78_100 }, { round: 3, lapMs: 78_050 },
    ])
    const teams = [player]
    expect(deltaVsLeaderFromHistory(teams, 'mclaren')).toBe(0)
  })

  it('returns OVR-fallback when player has fewer than 3 entries', () => {
    const player = makeTeam('mclaren', [{ round: 1, lapMs: 79_000 }])
    const leader = makeTeam('red-bull', [
      { round: 1, lapMs: 78_000 }, { round: 2, lapMs: 78_000 }, { round: 3, lapMs: 78_000 },
    ])
    leader.constructorPosition = 1
    leader.car.downforce = 90 // higher OVR than player to ensure leader has higher rating
    const result = deltaVsLeaderFromHistory([player, leader], 'mclaren')
    // Fallback path is OVR diff × 0.03 — assert it's negative (player slower) and finite
    expect(result).toBeLessThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('averages last 3 fastest-lap deltas vs leader', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 79_000 },
      { round: 2, lapMs: 78_500 },
      { round: 3, lapMs: 78_300 },
    ])
    const leader = makeTeam('red-bull', [
      { round: 1, lapMs: 78_000 },
      { round: 2, lapMs: 78_000 },
      { round: 3, lapMs: 78_000 },
    ])
    leader.constructorPosition = 1
    // deltas: +1000ms, +500ms, +300ms → avg = +600ms = +0.6s slower
    expect(deltaVsLeaderFromHistory([player, leader], 'mclaren')).toBeCloseTo(0.6, 2)
  })

  it('falls back to OVR-heuristic when fewer than 3 overlapping rounds with leader', () => {
    const player = makeTeam('mclaren', [
      { round: 1, lapMs: 78_500 },
      { round: 5, lapMs: 78_500 },
      { round: 6, lapMs: 78_500 },
    ])
    const leader = makeTeam('red-bull', [
      { round: 2, lapMs: 78_000 },
      { round: 3, lapMs: 78_000 },
      { round: 4, lapMs: 78_000 },
    ])
    leader.constructorPosition = 1
    // Zero overlapping rounds → fallback (negative OVR-based delta or 0)
    const result = deltaVsLeaderFromHistory([player, leader], 'mclaren')
    expect(result).toBeLessThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run test (expected: FAIL — module doesn't exist)**

Run: `npx vitest run tests/engine/engineering/car-performance-insights.test.ts`
Expected: import error, file not found.

- [ ] **Step 3: Implement the module**

Create `src/engine/engineering/car-performance-insights.ts`:

```ts
import type { Team } from '@/types/team'
import { deltaVsLeaderSeconds } from './factory-insights'

const MIN_HISTORY_ENTRIES = 3

/**
 * Rolling 3-race average of fastest-lap deltas between the player team and
 * the championship leader. Positive value = player is slower; negative =
 * player is faster (which means the player is actually the leader). Returns
 * 0 when the player IS the championship leader. Falls back to the existing
 * OVR-diff heuristic in `factory-insights.ts` when the player has fewer
 * than 3 fastest-lap entries OR fewer than 3 rounds overlap with the
 * leader's entries.
 */
export function deltaVsLeaderFromHistory(teams: Team[], playerTeamId: string): number {
  const player = teams.find((t) => t.id === playerTeamId)
  if (!player) return 0
  // Championship leader = team currently in P1.
  const leader = teams.find((t) => t.constructorPosition === 1)
  if (!leader || leader.id === playerTeamId) return 0

  const playerByRound = new Map(player.fastestLapHistory.map((e) => [e.round, e.lapMs]))
  const leaderByRound = new Map(leader.fastestLapHistory.map((e) => [e.round, e.lapMs]))

  // Walk rounds where BOTH have entries, newest-first, take up to MIN_HISTORY_ENTRIES.
  const sharedRounds = [...playerByRound.keys()]
    .filter((r) => leaderByRound.has(r))
    .sort((a, b) => b - a)
    .slice(0, MIN_HISTORY_ENTRIES)

  if (sharedRounds.length < MIN_HISTORY_ENTRIES) {
    // Fallback: existing OVR-based heuristic.
    return deltaVsLeaderSeconds(teams, playerTeamId)
  }

  const deltaMs = sharedRounds.reduce((acc, round) => {
    return acc + (playerByRound.get(round)! - leaderByRound.get(round)!)
  }, 0) / sharedRounds.length

  // Convert ms to seconds, two decimals — matches existing readout format.
  return Number((deltaMs / 1000).toFixed(2))
}
```

- [ ] **Step 4: Run test (expected: PASS)**

Run: `npx vitest run tests/engine/engineering/car-performance-insights.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engineering/car-performance-insights.ts tests/engine/engineering/car-performance-insights.test.ts
git commit -m "feat(factory): add deltaVsLeaderFromHistory with OVR-heuristic fallback"
```

---

## Task 9: Add `mtbfFromFailureLog` to the same module (TDD)

**Files:**
- Modify: `src/engine/engineering/car-performance-insights.ts`
- Modify: `tests/engine/engineering/car-performance-insights.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/engineering/car-performance-insights.test.ts`:

```ts
import { mtbfFromFailureLog } from '@/engine/engineering/car-performance-insights'
import type { ComponentAllocation, FailureEvent } from '@/types/team'

const makeComponents = (rows: Partial<ComponentAllocation>[]): ComponentAllocation[] =>
  rows.map((r) => ({
    element: r.element ?? 'ice',
    used: r.used ?? 0,
    limit: r.limit ?? 4,
    failureProbability: r.failureProbability ?? 0.03,
  }))

describe('mtbfFromFailureLog', () => {
  it('returns heuristic when fewer than 2 failure events', () => {
    const team = makeTeam('mclaren', [])
    team.car.reliability = 80
    team.components = makeComponents([
      { element: 'ice', used: 1, limit: 4 },
      { element: 'turbo', used: 1, limit: 4 },
    ])
    const result = mtbfFromFailureLog(team)
    expect(result).toBeGreaterThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('uses average laps-between-failures when 2+ events recorded', () => {
    const team = makeTeam('mclaren', [])
    team.failureEvents = [
      { round: 1, lap: 20, element: 'ice', driverId: 'norris' },
      { round: 3, lap: 30, element: 'turbo', driverId: 'norris' },
    ]
    // Average = (30 - 20) = 10 laps between, with one prior block
    // Specific implementation defines the exact formula; assert it's in a sane range.
    const result = mtbfFromFailureLog(team)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(70) // typical race lap counts
  })

  it('heuristic uses real per-element wear (a single dead element drags MTBF down)', () => {
    const teamFresh = makeTeam('mclaren', [])
    teamFresh.car.reliability = 80
    teamFresh.components = makeComponents([
      { element: 'ice', used: 1, limit: 4 },
      { element: 'turbo', used: 1, limit: 4 },
    ])
    const teamWornIce = makeTeam('mclaren', [])
    teamWornIce.car.reliability = 80
    teamWornIce.components = makeComponents([
      { element: 'ice', used: 4, limit: 4 }, // at limit — heavily worn
      { element: 'turbo', used: 1, limit: 4 },
    ])
    expect(mtbfFromFailureLog(teamWornIce)).toBeLessThan(mtbfFromFailureLog(teamFresh))
  })
})
```

- [ ] **Step 2: Run test (expected: FAIL — function doesn't exist)**

Run: `npx vitest run tests/engine/engineering/car-performance-insights.test.ts`
Expected: import error.

- [ ] **Step 3: Implement `mtbfFromFailureLog`**

Append to `src/engine/engineering/car-performance-insights.ts`. The existing `Team` import from Task 8 is reused; only `ComponentAllocation` needs a new import (or extend the existing import line):

```ts
// Extend the existing import from Task 8:
// import type { Team } from '@/types/team'
// → import type { Team, ComponentAllocation } from '@/types/team'

const MIN_FAILURE_EVENTS = 2

/**
 * Mean time between failures (laps). When the team has 2+ recorded failure
 * events this season, returns the average laps between adjacent failures
 * (chronologically by round, then lap). Otherwise falls back to a heuristic
 * grounded in `car.reliability` and the team's *worst* element wear ratio
 * (not the average) — a single nearly-dead component drags MTBF down even
 * if the rest of the fleet is fresh, matching the spec §4.1 contract.
 */
export function mtbfFromFailureLog(team: Team): number {
  if (team.failureEvents.length >= MIN_FAILURE_EVENTS) {
    return mtbfFromEvents(team.failureEvents)
  }
  return mtbfHeuristicWorstWear(team.car.reliability, team.components)
}

function mtbfFromEvents(
  events: ReadonlyArray<{ round: number; lap: number }>,
): number {
  // Sort chronologically: round asc, then lap asc.
  const sorted = [...events].sort((a, b) =>
    a.round === b.round ? a.lap - b.lap : a.round - b.round,
  )
  // Naive estimate: average laps between consecutive failures within the
  // same round; cross-round gaps treated as "the next race" with a
  // conservative 50-lap proxy. Implementation can refine in a later phase.
  let totalGap = 0
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]
    const b = sorted[i]
    totalGap += a.round === b.round ? Math.max(1, b.lap - a.lap) : 50
  }
  const gaps = sorted.length - 1
  return Number(Math.max(1, totalGap / gaps).toFixed(1))
}

function mtbfHeuristicWorstWear(
  reliability: number,
  components: ComponentAllocation[],
): number {
  const rel = Math.max(0, Math.min(100, reliability)) / 100
  if (components.length === 0) return Number((6 + rel * 24).toFixed(1))
  const worstWear = components.reduce(
    (acc, c) => Math.max(acc, c.used / Math.max(1, c.limit)),
    0,
  )
  const base = 6 + rel * 24 // 6 → 30 over reliability range
  const wearPenalty = 1 - worstWear * 0.5 // 1.0 → 0.5
  return Number(Math.max(1, base * wearPenalty).toFixed(1))
}
```

- [ ] **Step 4: Run test (expected: PASS)**

Run: `npx vitest run tests/engine/engineering/car-performance-insights.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engineering/car-performance-insights.ts tests/engine/engineering/car-performance-insights.test.ts
git commit -m "feat(factory): add mtbfFromFailureLog with worst-wear heuristic fallback"
```

---

## Task 10: Wire new helpers into `src/app/factory/page.tsx`

**Files:**
- Modify: `src/app/factory/page.tsx:14-26` (imports), `:60-65` (derivations), `:107-108` (props)

- [ ] **Step 1: Update imports**

In `src/app/factory/page.tsx`, around lines 14-26, add a new import:

```ts
import {
  deltaVsLeaderFromHistory,
  mtbfFromFailureLog,
} from '@/engine/engineering/car-performance-insights'
```

The existing imports `deltaVsLeaderSeconds` and `reliabilityMtbf` from `factory-insights` can stay (`car-performance-insights` delegates to them as fallbacks), but they're no longer called from the page directly.

- [ ] **Step 2: Replace the two heuristic calls with the new helpers**

Locate (around lines 60-65):

```ts
const leaderDelta = deltaVsLeaderSeconds(teams, playerTeam.id)
// ...
const mtbf = reliabilityMtbf(playerTeam.car, playerTeam.components)
```

Replace with:

```ts
const leaderDelta = deltaVsLeaderFromHistory(teams, playerTeam.id)
// ...
const mtbf = mtbfFromFailureLog(playerTeam)
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: full green.

- [ ] **Step 5: Manual smoke check via dev server**

Run: `npm run dev` (background)
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/factory --max-time 30`
Expected: HTTP 200.

Open `/factory` in the browser. With a fresh game (no race history), Δ vs Leader should match the prior heuristic value — the fallback path is active. After playing 3+ races with a team that holds the race-wide fastest at least once, Δ vs Leader should switch to the real-data path.

- [ ] **Step 6: Commit**

```bash
git add src/app/factory/page.tsx
git commit -m "feat(factory): route Δ vs Leader and MTBF through real-data insights module"
```

---

## Task 11: Update `docs/architecture/persistence-contract.md`

**Files:**
- Modify: `docs/architecture/persistence-contract.md` §1

- [ ] **Step 1: Locate the persisted-fields list**

Open `docs/architecture/persistence-contract.md` and find §1 (the explicit list of persisted fields).

- [ ] **Step 2: Add two entries**

Under the team-fields section, add:

```
- `team.fastestLapHistory: FastestLapEntry[]` — rolling buffer of race-wide fastest laps held by the team's drivers; capped at 6 entries; cleared at season end. Drives Factory Δ vs Leader. Schema bump: v8 → v9.
- `team.failureEvents: FailureEvent[]` — rolling buffer of mechanical-failure events; capped at 10 entries; cleared at season end. Reserved for future MTBF wiring (trigger lands when `checkMechanicalFailure` is invoked by the simulator). Schema bump: v8 → v9.
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/persistence-contract.md
git commit -m "docs(persistence): add fastestLapHistory + failureEvents to persisted fields list"
```

---

## Task 12: Determinism replay validation + final sweep

**Files:**
- (No code changes — pure validation)

- [ ] **Step 1: Run `npx tsc --noEmit`**

Expected: clean exit.

- [ ] **Step 2: Run `npx vitest run`**

Expected: full green, no skipped tests, no `@ts-ignore` introduced.

- [ ] **Step 3: Run `npm run lint`**

Expected: no new violations vs main.

- [ ] **Step 4: Determinism replay**

Run the determinism suite for the race engine. Expected file path is `tests/engine/race/race-simulator.test.ts` (and any sibling `race-bootstrap.test.ts` / `race-sim-worker.test.ts` that ships replay assertions). If the implementer does not find a "determinism" or "byte-identical" `describe` block in those files, surface that gap to the human — the determinism gate is a HARD STOP per AGENTS.md.

Run: `npx vitest run tests/engine/race`
Expected: green. Phase 1 added no PRNG-dependent code; the replay must remain byte-identical for the same seed.

- [ ] **Step 5: Manual playthrough (3 races)**

Start a new game. Play the first 3 races (any team). After race 3, navigate to `/factory` and verify:

- The radar, OVR, peer rank, peer averages, sparkline, last-upgrade round, projected grid loss, and aero panels look unchanged (Phase 1 does not touch them).
- Δ vs Leader should now reflect real data if the player team held a race-wide fastest at least once across 3 rounds with the leader. Otherwise it should match the OVR-heuristic value (fallback active).
- Reliability MTBF should reflect the heuristic with real per-element wear ratios — a team carrying a heavily-worn ICE should show a lower MTBF than a team with even wear.

- [ ] **Step 6: Update memory + finish branch**

The `project_factory_three_cards_design_paused.md` memory file's "Resume instructions" section can now be marked Phase 1 SHIPPED. Move the `project_factory_penalties_todo.md` reference to "still pending — folded into Phase 2."

```bash
git add C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_factory_three_cards_design_paused.md
git commit -m "memory(factory): mark Phase 1 SHIPPED; Phase 2 next"
```

- [ ] **Step 7: Optional — finishing-a-development-branch skill**

Use `superpowers:finishing-a-development-branch` to choose how to integrate Phase 1 work (PR vs direct merge depending on the team's flow). The plan does not pre-commit to a strategy.

---

## Acceptance criteria (Phase 1 done when ALL pass)

1. `npx tsc --noEmit` clean.
2. `npx vitest run` full green.
3. `npm run lint` no new violations.
4. Determinism replay byte-identical.
5. Migration v8 → v9 round-trip test passes; legacy save loads cleanly with both buffers initialized to `[]`.
6. Factory page renders without prop errors; Δ vs Leader and MTBF readouts derive from `car-performance-insights.ts`.
7. After 3+ rounds where the player held a race-wide fastest lap on overlapping rounds with the leader, Δ vs Leader switches from heuristic-fallback to averaged real-data delta.
8. `failureEvents` buffer remains empty (expected — trigger is intentionally unwired in Phase 1).
9. Persistence-contract.md §1 lists both new persisted fields.
10. No new `Math.random()` calls in any new file. No new browser API usage in any engine file.

---

## Out of scope for this phase (locked)

- Wiring `checkMechanicalFailure` into the race simulator. (Future phase — likely as part of Phase 2 wear ticking, but not committed in this spec.)
- Component wear ticking (`tickComponentWear`). Belongs to Phase 2 — Box 2.
- Per-element instance tracking. (Locked out of the entire spec, §9.)
- Any visual change to the Factory hero cards. (Phase 1 is purely a wiring/data swap behind unchanged props.)
- Any change to the race simulator (`src/engine/race/**`). The plumbing is read-only — we route an existing field, not produce a new one.
