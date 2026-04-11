# IP-01 - Determinism and Race Bootstrap Cleanup

## Summary
This phase removes non-deterministic race bootstrap behavior and makes race initialization reproducible. It does not move execution to the worker yet; it stabilizes the preconditions so later worker work can be verified reliably.

## Goals
- Eliminate non-deterministic values from race start.
- Define an explicit, reproducible race bootstrap contract.
- Preserve the current UX while making race startup testable.
- Create a determinism gate for later phases.

## Execution Notes
- **Parallel with IP-05:** IP-01 touches only race bootstrap logic. IP-05 touches only persistence infrastructure. The two do not share code paths and can be executed concurrently if two developers are available. Neither is a prerequisite for the other.
- **Relationship with IP-02:** IP-01 and IP-02 address adjacent problems (deterministic bootstrap input and canonical command dispatch). They can also be executed in parallel. However, the `RaceBootstrapInput` shape defined in IP-01 should be reviewed alongside the `RaceCommandEnvelope` shape from IP-02 before IP-03 begins, to ensure the combined startup payload the worker will eventually receive is coherent. A brief alignment check at the IP-03 entry point is the only required synchronization point.

## In Scope
- Replace `Math.random()`-based race bootstrap values with seed-derived values.
- Define a canonical race-start input shape.
- Ensure weather, track temperature, and bootstrap defaults are deterministic for a given seed and context.
- Add determinism tests around race bootstrap and same-seed repeatability.

## Out of Scope
- No worker authority changes.
- No command ownership redesign.
- No store slice expansion yet.
- No OpenF1-derived calibration yet.

## Key Changes
- Update `src/app/strategy/page.tsx` so `handleStartRace()` no longer uses `Math.random()` for `trackTemp`.
- Introduce a small pure race bootstrap helper in the race/core domain, recommended path: `src/engine/race/race-bootstrap.ts`.
- Move all race bootstrap defaults into that helper:
  - initial weather
  - track temperature
  - initial safety car state
  - initial positions and race init metadata
- Keep `game-store.ts:initGame()` random seed fallback unchanged unless a direct reproducibility issue is discovered there. The focus of this phase is in-race determinism, not campaign-seed generation policy.
- Add tests that verify:
  - same seed + same circuit + same driver inputs produce identical bootstrap output
  - race start state is stable across repeated runs
  - bootstrap remains JSON-serializable

## Public Interfaces / Type Changes
- Add a small internal bootstrap interface, for example:
  - `RaceBootstrapInput`
  - `RaceBootstrapOutput`
- Keep component-facing `startRace(...)` parameters stable if possible.
- If a new helper is introduced, it must be pure and framework-agnostic.
- The shape of `RaceBootstrapInput` should be designed with IP-03 in mind: it will become part of the worker `start` payload, so every field must be JSON-serializable and self-contained.

## Data Flow
- Current:
  - Strategy page assembles race state inline.
  - `trackTemp` currently comes from `Math.random()`.
- Target after this phase:
  - Strategy page passes deterministic input into a pure bootstrap helper.
  - Bootstrap helper returns canonical initial race state.
  - Hook receives already deterministic race start state.

## Risks / Rollback
- Risk: race feel may change slightly because previous randomness was uncontrolled.
- Mitigation: preserve current approximate ranges and only replace randomness source, not design intent.
- Rollback: revert bootstrap helper integration and keep tests that reveal the gap.

## Test Plan
- Add a dedicated bootstrap test file, recommended path: `tests/engine/race/race-bootstrap.test.ts`.
- Extend race determinism tests so repeated starts with the same seed match exactly.
- Run:
  - `npx vitest run tests/engine/race tests/engine/core tests/data`

## Acceptance Criteria
- No `Math.random()` remains in race bootstrap flow.
- Same seed and same starting context produce identical bootstrap output.
- Race start remains functionally identical to the player from a UX perspective.
- Tests prove reproducibility.
- `RaceBootstrapInput` is JSON-serializable (verified by test or explicit serialization assertion).

## Assumptions
- Campaign-level random seed assignment can remain unchanged for now.
- Track temperature and initial weather should remain within the current gameplay envelope.
- This phase prepares the system for command ownership and worker rollout, but does not perform either.
- `RaceBootstrapInput` shape can be kept minimal now and extended in IP-03 when the full worker startup payload is canonicalized.
