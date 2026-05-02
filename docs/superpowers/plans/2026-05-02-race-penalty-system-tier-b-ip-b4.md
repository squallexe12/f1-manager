# Race Penalty System — Tier B v2, IP-B4 Implementation Plan
## Polish — Season-End Departures, Calibration Tightening, Telemetry, Edge-Case Closeout

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Close out Tier B v2 entirely. Wire the season-end processor to handle the IP-B3 declined-poaching carry-over (staff leaves at season end). Tighten frequency calibration from ±100% smoke band to ±20%. Surface pit-lane events in the commentary feed so the player sees pit-stop telemetry, not just outcomes. Document and defensively handle the edge cases the spec flagged (mid-pit safety car, rain transition during pit stop, mechanical-DNF mid-stop).

**Spec:** [docs/superpowers/specs/2026-05-02-race-penalty-system-tier-b-design.md](../specs/2026-05-02-race-penalty-system-tier-b-design.md) §6 (IP-B4)

**Pipeline:** sim-engine (season-end + telemetry fold + edge cases) → game-state (commentary integration) → verify.

---

## Pre-flight

- [ ] Clean working tree, green tests on `main` post-IP-B3.

---

## Phase 1 — Season-end declined-staff-departure

### Task 1: Season-end processor wires declined attempts

**Files:** modify `src/engine/core/season-end-processor.ts`, `tests/engine/core/season-end-processor.test.ts`

- [ ] At season end, scan `world.poachingAttempts` for `status: 'declined'` items. For each:
  - Remove the matched staff from the player team's roster (chief slot → null, or filter member out of `pitCrewMembers`).
  - The staff vanishes from the game (rival team's auto-roster doesn't exist in v2; the staff goes to "unknown rival roster" — documented gap).
  - Mark the attempt resolved by removing it from `poachingAttempts`.
- [ ] Also clear `matched` and `expired` attempts at season end so the array stays bounded across seasons.
- [ ] Tests: declined chief departs, declined member departs, matched/expired clear, open attempts persist.

---

## Phase 2 — Calibration tightening

### Task 2: Full-season frequency replay

**Files:** create `tests/engine/race/pit-lane-season-frequency.test.ts`

- [ ] Run a deterministic 22-race season at neutral 70/70/70 across 8 drivers. Count emitted `unsafe-release` / `pit-lane-speeding` / `failure-to-serve` events.
- [ ] Assert: 0–6 unsafe-release / 1–10 speeding / 0–2 failure-to-serve over the season. (Wider than the ±20% spec target for IP-B4 v1; tightens further as playtest grounds the numbers.)
- [ ] If the results land outside this band by >50%, tune `unsafeReleaseFaultThreshold` or `pitLaneSpeedingMeanOffsetKph`.

---

## Phase 3 — Telemetry → commentary

### Task 3: Pit-lane events surface as commentary

**Files:** modify `src/engine/race/race-simulator.ts` (or `pit-lane-engine.ts`), wherever `pitLaneEvents` is consumed

- [ ] At lap-end, fold pit-lane events into commentary entries with `severity: 'info'` and `category: 'pit'`. Each event becomes a one-line commentary string ("Verstappen enters pit lane at 232 km/h" / "Hamilton released, gap to Russell 0.4s" / etc.).
- [ ] Visible in the existing CommentaryFeed without further UI changes.

---

## Phase 4 — Edge-case defensive code

### Task 4: Edge-case audit + minimal hardening

**Files:** modify `src/engine/race/race-simulator.ts` if needed

- [ ] Confirm: a driver entering DNF mid-pit-stop (mechanical, crash) does not produce a stale pit-lane FSM entry that ticks indefinitely. Add a defensive `if (state.dnfDriverIds[driverId]) skip` guard if missing.
- [ ] Confirm: pit branch handles `state.safetyCar !== 'green'` — current behaviour (complete the stop normally) is acceptable per spec §5.13. Add a comment.
- [ ] Confirm: weather transition mid-stop doesn't crash; existing tire-swap math is compound-agnostic so this works.

---

## Phase 5 — Verification + Tier B closeout

### Task 5: Full-suite + lint + commit + push

- [ ] `npx tsc --noEmit` clean.
- [ ] `npx vitest run` all green.
- [ ] `npm run lint` no new errors on touched files.
- [ ] HTTP 200 on `/factory` + `/paddock`.
- [ ] Update [project_penalty_system_tier_b_in_progress.md](../../../C:/Users/kapsi/.claude/projects/c--Users-kapsi-OneDrive-Masa-st--f1-simulation/memory/project_penalty_system_tier_b_in_progress.md) to **Tier B SHIPPED**.

## Done Criteria

- [ ] All 5 tasks complete.
- [ ] Season-end declined-staff-departure mechanic firing.
- [ ] Frequency replay shows order-of-magnitude correct counts.
- [ ] Pit-lane events visible in commentary during a race.
- [ ] No regressions: determinism HARD GATE still green.
