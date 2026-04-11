# IP-00 - Current-State Baseline and Contract Freeze

## Summary
This phase freezes the post-v1.0.1 architecture as it exists today. It documents current runtime truth, updates architecture notes to match the codebase, adds characterization tests for the pure orchestrator layer, and performs a one-time data audit of the 2026 season dataset. No runtime behavior should change in this phase.

## Goals
- Capture the real current architecture after the selector, orchestrator, and persistence refactor.
- Record the gap between current runtime ownership and target runtime ownership.
- Establish stable contracts for later phases so worker and OpenF1 work do not start from stale assumptions.
- Add direct tests around orchestrator behavior.
- Verify that the 2026 season data (teams, drivers, circuits) is complete and internally consistent before calibration and engagement work builds on it.

## In Scope
- Refresh `docs/architecture/adr-001-system-architecture.md` so it reflects the current codebase.
- Add a new baseline document at `docs/architecture/current-state-baseline.md`.
- Document current ownership boundaries for store, orchestrator, race runtime, persistence, and selectors.
- Add `tests/engine/core/orchestrator.test.ts`.
- Re-run the existing engine/core/data test suite.
- **Data audit:** verify all 11 constructors, 22 drivers, and 22 circuits exist in the data layer with valid baseline attributes and no missing required fields.

## Out of Scope
- No worker migration.
- No race runtime refactor.
- No OpenF1 integration work.
- No persistence schema changes.
- No UI redesign.

## Key Changes
- Update ADR text so it states that `game-store.ts` is now a thin dispatch layer and `orchestrator.ts` owns management, post-race, and season-end gameplay flow.
- Update ADR text so it states that persistence is bootstrapped by `PersistenceProvider`, `setupPersistence()`, and `useSaveGame()`, not by store actions.
- Update ADR text so it explicitly acknowledges that current in-race authority still lives in `useRaceSimulation`, while target in-race authority remains the worker.
- Add `docs/architecture/current-state-baseline.md` with these sections:
  - Current Runtime Truth
  - Target Architecture
  - Confirmed Gaps
  - Frozen Boundaries for Next Phases
- Add characterization tests for:
  - `advanceGamePhase()`
  - `processPostRacePhase()`
  - `processSeasonEndPhase()`
- Record the following open gaps as frozen follow-up items:
  - `setDriverCommand` is still a placeholder.
  - race execution is still hook-owned.
  - worker contract is not production-ready.
  - race bootstrap still has non-deterministic pieces.
- **Data audit:** produce a short report (inline in `docs/architecture/current-state-baseline.md` or a separate `docs/data/2026-season-audit.md`) that lists:
  - which of the 11 constructors are present in `src/data/`
  - which of the 22 drivers are present and have all required attributes (pace, racecraft, experience, mentality, marketability, developmentPotential)
  - which of the 22 circuits are present and have valid spline or fallback data
  - any missing entries or null/undefined required fields

## Public Interfaces / Type Changes
- No runtime type changes are expected.
- No public store shape changes are expected.
- Documentation is allowed to become more precise than current code comments.
- Data audit may produce a list of required fixes but those fixes are out of scope for this phase unless they are trivially one-line corrections.

## Data Flow
- Current truth to document:
  - `gameStore` owns `world`, `eventCooldowns`, `lastRaceResults`, `lastSeasonEnd`.
  - store actions delegate pure gameplay transitions to `orchestrator.ts`.
  - persistence side effects subscribe to `world` changes through `setupPersistence()`.
  - manual save/load flows go through `useSaveGame()`.
  - strategy race runtime is still computed in `useRaceSimulation`.
- Target truth to document:
  - `gameStore` remains authority for app state and command dispatch.
  - worker becomes authority for in-progress race runtime in later phases.
  - UI reads narrow slices only.

## Risks / Rollback
- Risk: ADR updates could accidentally describe target architecture as if it were already implemented.
- Mitigation: clearly split "current runtime truth" from "target architecture" in both docs.
- Risk: data audit may surface missing driver or circuit data that later phases depend on.
- Mitigation: record all missing data in the audit report. Only fix trivially correctable gaps in this phase; schedule non-trivial data work as explicit tasks before IP-07 (which consumes circuit and driver data for calibration).
- Rollback: revert documentation and tests only; no runtime rollback path is needed because behavior is unchanged.

## Test Plan
- Add `tests/engine/core/orchestrator.test.ts`.
- Verify that orchestrator functions do not mutate input state.
- Run:
  - `npx vitest run tests/engine/core tests/engine/race tests/data`

## Acceptance Criteria
- ADR and `current-state-baseline.md` match current code behavior.
- Ownership boundaries are written down in one place and easy to reference.
- Orchestrator behavior is covered by direct tests.
- Existing tests remain green.
- No runtime behavior changes.
- Data audit report exists and identifies any missing or incomplete 2026 season entries.

## Assumptions
- The persistence refactor is directionally correct and should be preserved.
- Current race authority remains hook-owned for now.
- This phase is a documentation, characterization, and data-audit phase only.
- Any data gaps found during the audit that are non-trivial (e.g. missing full circuit spline sets) are recorded and scheduled before IP-07 begins, not silently skipped.
