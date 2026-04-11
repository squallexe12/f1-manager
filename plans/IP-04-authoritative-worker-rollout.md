# IP-04 - Authoritative Worker Rollout

## Summary
This phase moves the race loop from hook-owned execution to worker-owned execution in a staged, low-risk rollout. The UI must remain stable, and the transition should happen through store-mediated state updates rather than direct component-to-worker coupling.

## Goals
- Make the worker the authority for in-progress race simulation.
- Keep UI surfaces responsive and functionally unchanged.
- Introduce store-mediated race updates and command dispatch.
- Provide a bounded recovery path for worker failures.

## Execution Notes
- **Hard prerequisites: IP-01, IP-02, IP-03 must all be complete.** This phase depends on the deterministic bootstrap shape (IP-01), the canonical command types (IP-02), and the trustworthy worker message protocol (IP-03). Beginning here with any of those unresolved means the new store race slice will be built on an unstable contract.
- **Relationship with IP-05:** IP-04 introduces a new race runtime slice to the store. IP-05 hardens persistence. These two phases interact at one specific point: the question of whether the race runtime slice lives inside or outside `world`. This must be decided at the start of IP-04 and communicated to IP-05. See the Race Slice Ownership Decision section below.

## Race Slice Ownership Decision

This decision must be made and recorded before any implementation begins. It determines whether the new race runtime slice is autosaved and whether IP-05 needs a schema migration.

**Option A: Race runtime slice lives OUTSIDE `world`.**
- The autosave subscriber in `setupPersistence()` fires only on `world` reference changes and will never capture race runtime state.
- Mid-race state is transient. A page reload during a race returns the player to the pre-race strategy screen.
- IP-05 requires no schema changes.
- This is the recommended default. Race simulation is a session-scoped activity and mid-race save/resume adds significant complexity without matching player value.

**Option B: Race runtime slice lives INSIDE `world`.**
- Autosave will fire on every lap update, creating a high-frequency write load during active races. This must be profiled before shipping.
- IP-05 will need a schema version bump to account for the new fields.
- Mid-race page reload can theoretically resume where the player left off.
- Only adopt this option if mid-race save/resume is a confirmed product requirement for this phase.

**Record the chosen option in `docs/architecture/current-state-baseline.md` before implementation begins. IP-05 depends on this recorded decision.**

## In Scope
- Add a dedicated race runtime slice to the store or an equivalent store-owned race state surface.
- Instantiate and manage the worker from a store-mediated or hook-adapter boundary.
- Route command dispatch through store to worker.
- Feed UI from worker updates rather than hook-owned simulation state.
- Implement staged rollout behavior.
- Implement Tier 1 worker failure recovery (see below).

## Out of Scope
- No persistence redesign.
- No OpenF1-driven simulation changes.
- No gameplay expansion features.
- No live companion mode.
- No Tier 2 mid-race checkpoint resume (explicitly deferred to IP-05 or a future dedicated phase).

## Key Changes
- Introduce a store-level race slice, recommended fields:
  - phase
  - lap
  - totalLaps
  - timing
  - tire states
  - commentary
  - incidents
  - command state
  - worker status (`idle` | `starting` | `running` | `paused` | `error` | `finished`)
- Refactor `useRaceSimulation` into a UI adapter around store-managed race runtime rather than the race runtime owner.
- Staged rollout:
  - Stage A: worker runs in mirror mode behind a feature flag or internal switch — both hook and worker compute in parallel, worker output is logged but not rendered.
  - Stage B: store consumes worker updates as the canonical race source — UI reads from store race slice, hook still runs but is no longer authoritative.
  - Stage C: hook-owned simulation loop removed or permanently disabled — only after Stage B is verified stable.
- **Tier 1 recovery (in scope):**
  - Capture `workerStatus` in the store race slice.
  - On worker error, set `workerStatus` to `error` and surface a recovery UI that allows the player to restart the race from its beginning.
  - Do not attempt to resume from mid-race state in this tier.
  - Log the error with enough context for debugging (last received lap update, worker error message).
- **Tier 2 recovery (explicitly out of scope):**
  - True mid-race checkpoint resume requires a serializable snapshot of full worker state, a schema version in persistence, and load-from-checkpoint logic.
  - This is a standalone feature. Defer it to IP-05 or a future phase, depending on the Race Slice Ownership Decision above.

## Public Interfaces / Type Changes
- Store interface will gain race-runtime actions and state.
- `useRaceSimulation` public return shape may change to read from store-backed state.
- Worker lifecycle status types: `WorkerStatus = 'idle' | 'starting' | 'running' | 'paused' | 'error' | 'finished'`.

## Data Flow
- Current:
  - strategy page starts race
  - hook owns simulation loop
  - UI reads hook state
- Target after this phase:
  - strategy page triggers store race start action
  - store posts `start` to worker
  - worker emits updates
  - store applies updates to race slice
  - UI reads store race slice
  - commands go UI -> store -> worker

## Risks / Rollback
- Risk: worker rollout can break race controls, pause/resume, or timing updates.
- Mitigation: use staged rollout and keep the current hook path available until Stage B parity is confirmed.
- Risk: race slice ownership decision could create unexpected autosave behavior.
- Mitigation: explicitly record the decision before coding begins and verify the persistence behavior in the Stage A period.
- Rollback: switch back to hook-owned execution while keeping the new store race slice and worker protocol work intact.

## Test Plan

### Automated Tests
- Add integration tests for:
  - race start (worker receives well-formed `start` payload)
  - lap updates (store slice updates on each `lapUpdate` message)
  - pause/resume (worker and store state stay synchronized)
  - command dispatch (UI -> store -> worker message emitted with correct `RaceCommandEnvelope`)
  - race end (`raceEnd` message transitions store phase correctly)
  - worker error state (`error` message sets `workerStatus` to `error`)
- Add smoke coverage for strategy page using store-backed race state if feasible.
- Run:
  - `npx vitest run tests/engine/race tests/engine/core tests/data`

### Manual Test Checklist (required before Stage C)
The following flows must be exercised manually before the hook-owned simulation loop is removed. Automated tests verify contract shape; this list verifies end-to-end UX fidelity.

- [ ] Start a race from the Strategy page. Lap counter increments, commentary appears, and tire state changes are visible.
- [ ] Pause the race mid-lap. All visible state freezes. Resume from pause. Simulation continues from the correct lap and tire state.
- [ ] Issue a tire strategy change command. The command badge updates and the change is reflected in the subsequent lap simulation.
- [ ] Issue a driver mode change (push/conserve). Pace delta is reflected in subsequent lap times.
- [ ] Trigger or observe a Safety Car event. Race pace adjusts correctly and resumes after the VSC/SC period ends.
- [ ] Allow a race to complete naturally to the final lap. `raceEnd` is received, results screen renders, and post-race phase transitions correctly.
- [ ] Force a worker error (by killing the worker mid-race in development mode). `workerStatus` transitions to `error`, the recovery UI is visible, and restarting the race from beginning works.
- [ ] Verify that no console errors or unhandled promise rejections appear during any of the above flows.

**Stage C (hook removal) must not proceed if any manual checklist item is failing.**

## Acceptance Criteria
- Race simulation runs off the main thread.
- UI renders from worker-fed state.
- Commands flow through store and worker, not directly into local simulation state.
- Existing race UX remains intact.
- Tier 1 failure behavior is bounded: `workerStatus` reflects errors, recovery UI exists, restart from beginning works.
- Race Slice Ownership Decision is recorded in architecture docs before implementation begins.
- Manual test checklist is complete before Stage C.

## Assumptions
- Store mediation is required; components should not talk to the worker directly.
- Tier 1 recovery (restart from beginning) is sufficient for this phase. Tier 2 (mid-race resume) is not.
- Mirror mode is acceptable if it materially reduces migration risk.
- The Race Slice Ownership Decision defaults to Option A (slice outside `world`) unless a product reason for Option B is confirmed.
