# Race Penalty System — Tier B v2, IP-B2 Implementation Plan
## Staff Schema + Factory UI

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the staff-management layer of Tier B: a procgen pit-crew talent pool deterministic-from-seed, hireable chief + 6 members per team with `Contract`-shaped fields (forward-compatible with future negotiation), Factory-page Pit-Crew card + Staff Market modal, and store actions for hire / fire. **Engine reads stay neutral 70/70/70 — IP-B3 wires `aggregateCrewRatings` into the simulator.**

**Architecture:** New types under `src/types/staff.ts`. New engine modules under `src/engine/staff/` (procgen-names, staff-distributions, talent-pool, pit-crew, hiring). Schema bump 11 → 12 adding `team.pitCrewChief`, `team.pitCrewMembers`, `world.staffMarket`, `world.poachingAttempts`. Two new store actions. Three new Factory components.

**Spec:** [docs/superpowers/specs/2026-05-02-race-penalty-system-tier-b-design.md](../specs/2026-05-02-race-penalty-system-tier-b-design.md) §5.7–5.11

**Pipeline (per AGENTS.md):** sim-engine (types, engine modules) → game-state (schema bump, store actions) → ui-interface (Factory components) → verify.

---

## Pre-flight

- [ ] Confirm clean working tree (`git status`).
- [ ] `npx tsc --noEmit` and `npx vitest run` green on `main` post-IP-B1.

---

## Phase 1 — Type foundations

### Task 1: Staff types

**Files:** create `src/types/staff.ts`

- [ ] StaffContract, PitCrewChief, PitCrewMember, PitCrewRole, FreeAgent, PoachingAttempt, StaffMarket types per spec §5.9.
- [ ] `npx tsc --noEmit` green.

### Task 2: Extend Team interface

**Files:** modify `src/types/team.ts`

- [ ] Add `pitCrewChief: PitCrewChief | null`, `pitCrewMembers: PitCrewMember[]` to `Team`.
- [ ] Doc comments referencing spec.

### Task 3: Extend FullGameState

**Files:** modify `src/engine/core/state-manager.ts` (FullGameState only — initialization in Task 9)

- [ ] Add `staffMarket: StaffMarket` and `poachingAttempts: PoachingAttempt[]` to `FullGameState`.

---

## Phase 2 — Pure engine modules

Each module ships with tests (TDD: write tests first, RED, then implement, GREEN). Use `superpowers:test-driven-development`.

### Task 4: procgen-names

**Files:** create `src/engine/staff/procgen-names.ts`, `tests/engine/staff/procgen-names.test.ts`

- [ ] Deterministic name + nationality + age generators using PRNG.
- [ ] Tests: same seed → same output; pool size assertion; reasonable age distribution.

### Task 5: staff-distributions

**Files:** create `src/data/staff-distributions.ts`

- [ ] Sampling distributions per spec §5.10: chief gaussian(70, 15) clamped [30, 99]; member gaussian(65, 18) clamped [25, 99]; salary linear in attribute level.

### Task 6: talent-pool

**Files:** create `src/engine/staff/talent-pool.ts`, `tests/engine/staff/talent-pool.test.ts`

- [ ] `generateTalentPool(seed, season, poolSize)` returns `{ chiefs, members }`.
- [ ] Determinism test (same seed → identical pool).
- [ ] Pool size assertions.

### Task 7: pit-crew aggregation

**Files:** create `src/engine/staff/pit-crew.ts`, `tests/engine/staff/pit-crew.test.ts`

- [ ] `aggregateCrewRatings(chief, members)` → `{ release, speedDiscipline, serviceTime }`.
- [ ] Defaults to 50/50/50 when chief is null.
- [ ] Lollipop role dominates `release`; all members contribute to `serviceTime`.

### Task 8: hiring

**Files:** create `src/engine/staff/hiring.ts`, `tests/engine/staff/hiring.test.ts`

- [ ] `hireStaffMember(market, team, staffId)` and `hireStaffChief` — pure, returns new market + team state.
- [ ] `fireStaffMember(market, team, staffId)` — returns to pool with -2 attribute decay.
- [ ] Tests cover slot-occupied case (auto-fire), severance.

---

## Phase 3 — Persistence + initialization

### Task 9: Schema bump 11 → 12

**Files:** modify `src/engine/core/save-system.ts`, `docs/architecture/persistence-contract.md`

- [ ] Bump `SCHEMA_VERSION` to 12.
- [ ] Add `MIGRATIONS[11]`: defaults `pitCrewChief: null`, `pitCrewMembers: []`, `staffMarket: { chiefs: [], members: [], lastRefreshedSeason: 0 }`, `poachingAttempts: []`.
- [ ] Update persistence-contract.md.
- [ ] Test: round-trip a v11 fixture, assert v12 shape.

### Task 10: state-manager initialization

**Files:** modify `src/engine/core/state-manager.ts`

- [ ] `buildTeam` and `applyScenarioToTeam` initialize `pitCrewChief: null`, `pitCrewMembers: []`.
- [ ] `initializeGame` initializes `staffMarket` via `generateTalentPool(seed, season, DEFAULT_POOL_SIZE)`, `poachingAttempts: []`.

---

## Phase 4 — Store actions

### Task 11: gameStore.hireStaff + fireStaff

**Files:** modify `src/stores/game-store.ts`

- [ ] Two thin dispatch actions, calling pure helpers from `src/engine/staff/hiring.ts`.
- [ ] Update `world` immutably.
- [ ] Test: store action correctness via fake-indexeddb.

---

## Phase 5 — UI

### Task 12: PitCrewCard component

**Files:** create `src/components/factory/pit-crew-card.tsx`

- [ ] Hero strip card matching CarPerformanceCard / PowerUnitCard / AeroCard idiom.
- [ ] Shows chief portrait (initials block), 3 attribute readouts, aggregate sub-attributes badge, free-agent market button.
- [ ] Empty state (no chief hired): "Hire a chief" CTA.

### Task 13: PitCrewRoster component

**Files:** create `src/components/factory/pit-crew-roster.tsx`

- [ ] Six-row table (lollipop, front-jack, rear-jack, 2× wheel-off, 2× wheel-on).
- [ ] Each row: name, rating, salary, fire button.

### Task 14: StaffMarketModal

**Files:** create `src/components/factory/staff-market-modal.tsx`

- [ ] Tabbed (Chiefs / Members per role).
- [ ] Hire button per row.

### Task 15: Wire into Factory page

**Files:** modify `src/app/factory/page.tsx`

- [ ] PitCrewCard slots into the `fac-hero` grid alongside the existing three cards.

---

## Phase 6 — Verification

### Task 16: Full-suite + lint + commit + push

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx vitest run` all green.
- [ ] `npm run lint` no new errors on touched files.
- [ ] Pit-Crew card visible in `npm run dev` → /factory.
- [ ] Update [project_penalty_system_tier_b_in_progress.md](../../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_penalty_system_tier_b_in_progress.md).
- [ ] Hand off to IP-B3.

## Done Criteria for IP-B2

- [ ] All 16 tasks complete and committed.
- [ ] Schema 12 migration verified by test.
- [ ] PitCrewCard + StaffMarketModal render correctly in three states: no chief / partial roster / full roster.
- [ ] Hiring + firing work end-to-end through the store.
- [ ] Engine still reads neutral 70/70/70 — `aggregateCrewRatings` not yet called from race-simulator (that's IP-B3).

## Risks for IP-B2

- **Procgen name distribution.** Need a small first-name + last-name table per nationality. Keep tables short for IP-B2; expand in IP-B4 polish if names feel stale across many saves.
- **UI scope creep.** Three new components are tightly coupled. Resist temptation to add poaching alert UI here — that ships in IP-B3.
- **Schema-bump testing.** A v11 → v12 fixture is the highest-risk surface; one missing default and an existing save can crash on load.
