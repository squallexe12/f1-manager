# Race Penalty System — Tier B v2, IP-B3 Implementation Plan
## Engine ↔ Staff Connection + Calibration + Poaching

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect IP-B2's staff system to IP-B1's engine. Replace the hardcoded 70/70/70 staff sub-attributes in `race-simulator.ts` with `aggregateCrewRatings(chief, members)` per team. Tune calibration to hit per-season frequency targets. Ship poaching alerts on the Paddock page with counter-offer prompts so the staff investment loop has consequences both ways (you can be poached, you can poach back).

**Spec:** [docs/superpowers/specs/2026-05-02-race-penalty-system-tier-b-design.md](../specs/2026-05-02-race-penalty-system-tier-b-design.md) §5.11, §6 (IP-B3)

**Pipeline (per AGENTS.md):** sim-engine (aggregate baseline + race-sim wiring + poaching engine) → game-state (orchestrator step + store actions) → ui-interface (Paddock alert + counter-offer modal) → verify.

---

## Pre-flight

- [ ] Confirm clean working tree (`git status`).
- [ ] `npx tsc --noEmit` and `npx vitest run` green on `main` post-IP-B2.

---

## Phase 1 — Engine ↔ Staff connection

### Task 1: Bump `aggregateCrewRatings` empty baseline from 50 to 70

**Files:** modify `src/engine/staff/pit-crew.ts`, `tests/engine/staff/pit-crew.test.ts`

- [ ] No-chief / no-members baseline changes from 50 → 70.
- [ ] **Rationale:** AI teams in IP-B3 have `pitCrewChief: null` + empty members. The engine reads each team's aggregated ratings uniformly; if "no staff" returned 50, AI cars would have ~10× the speeding rate of real F1 (50 discipline = stddev 1.0; speeding fires ~3% per stop = ~30/season per team).
- [ ] Update tests asserting the old 50 baseline.

### Task 2: Wire `aggregateCrewRatings` into `race-simulator.ts`

**Files:** modify `src/engine/race/race-simulator.ts`

- [ ] In the `pittingThisLap.push(...)` block, replace the hardcoded
  ```ts
  releaseRating: 70, speedDisciplineRating: 70, serviceTimeRating: 70
  ```
  with values computed from the driver's team's pit crew via `aggregateCrewRatings(team.pitCrewChief, team.pitCrewMembers)`.
- [ ] Add a determinism replay test verifying that two seeded races with the same staff configuration produce byte-identical output.

---

## Phase 2 — Calibration tuning

### Task 3: Multi-car unsafe-release smoke check

**Files:** modify `tests/engine/race/pit-lane-calibration.test.ts`

- [ ] Add a multi-car scenario where 3-5 cars enter the pit lane on the same lap. Verify unsafe-release events fire at a rate consistent with ~1-2 / season.

### Task 4: Frequency calibration verification

**Files:** modify `tests/engine/race/pit-lane-calibration.test.ts`

- [ ] Tighten the per-season frequency assertions: at 70 baseline (no-staff or neutral-hired), ~3-5 speeding events and ~1-2 unsafe-release events per simulated season.
- [ ] If actuals miss by >50%, adjust `pitLaneSpeedingMeanOffsetKph` in `src/data/penalty-calibration.ts` and re-run.

---

## Phase 3 — Poaching engine

### Task 5: `src/engine/staff/poaching.ts`

**Files:** create `src/engine/staff/poaching.ts`, `tests/engine/staff/poaching.test.ts`

- [ ] `evaluatePoachingAttempts(world, currentRound, rng)` — pure function. Scans rival AI teams; when an AI team's pit-crew quality is materially worse than the player's AND the AI has budget headroom, raises a `PoachingAttempt` targeting one of the player's high-rated chief-or-member slots.
- [ ] One attempt per round max (rate-limit so the player isn't spammed).
- [ ] Deterministic on `(seed, round)`.
- [ ] Tests: deterministic, single-attempt-per-round cap, attempts only target player.

### Task 6: Orchestrator `runStaffMarket` step

**Files:** modify `src/engine/core/orchestrator.ts`

- [ ] In the management-phase advancement, after R&D processing and before AI team decisions, call `evaluatePoachingAttempts(world, currentRound, rng)` and append any returned attempts to `world.poachingAttempts`.
- [ ] Determinism preserved (same seed + same round produces same attempts).

### Task 7: Counter-offer state machine

**Files:** modify `src/types/staff.ts`, `src/engine/staff/hiring.ts`, `src/stores/game-store.ts`

- [ ] `PoachingAttempt` already has `status: 'open' | 'matched' | 'declined' | 'expired'` from IP-B2. Wire the transitions:
  - `matchOffer(attemptId)` — player matches the offered salary; rival walks; attempt → `matched`.
  - `declineOffer(attemptId)` — player declines; staff leaves at end of current season → `declined`.
  - Auto-`expired` on round > `expiresOnRound` if neither action taken.
- [ ] Salary update on match: bump the relevant staff member's contract.salary to the offered amount.
- [ ] Store actions: `matchPoachingOffer(attemptId)`, `declinePoachingOffer(attemptId)`.

---

## Phase 4 — UI surfaces

### Task 8: Paddock-page poaching alert banner

**Files:** modify `src/app/(dashboard)/page.tsx` (or wherever the Paddock page lives)

- [ ] Render an open-attempts banner on the Paddock page. Each open attempt shows: rival team, target staff name + role, offered salary vs. current salary, Match / Decline buttons.

### Task 9: Counter-offer prompt UI

**Files:** create `src/components/paddock/poaching-alert.tsx`

- [ ] Detail card on alert click: full comparison + 1-click match-or-decline.
- [ ] Bonus: subtle attention indicator on Paddock nav when ≥1 open attempt exists.

---

## Phase 5 — Verification

### Task 10: Full-suite + lint + commit + push

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx vitest run` all green.
- [ ] `npm run lint` no new errors on touched files.
- [ ] HTTP 200 on `/factory` (Pit-Crew card still works) and on the Paddock page.
- [ ] Update [project_penalty_system_tier_b_in_progress.md](../../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_penalty_system_tier_b_in_progress.md).
- [ ] Hand off to IP-B4 (edge-case polish).

## Done Criteria for IP-B3

- [ ] All 10 tasks complete and committed.
- [ ] Engine reads per-team staff ratings uniformly (no more hardcoded 70/70/70).
- [ ] Calibration smoke check shows ~1-2 unsafe / ~3-5 speeding per simulated season at neutral baseline.
- [ ] Poaching attempts fire on AI management cycles; player can match or decline.
- [ ] Determinism replay HARD GATE still green.

## Risks for IP-B3

- **Calibration drift after the 50 → 70 baseline change.** Bumping no-staff baseline reshapes the speeding distribution. May need to tune `pitLaneSpeedingMeanOffsetKph` (currently -1) up by ~0.5 to keep the per-season target.
- **Poaching frequency feels spammy.** Single-attempt-per-round cap is the first defense; if playtest still complains, gate by AI team's prestige tier.
- **Counter-offer UX:** the alert needs to feel timely (you'd notice if your chief was leaving) but not nagging. Lean toward "subtle until clicked" for v1; tune in IP-B4 polish.
