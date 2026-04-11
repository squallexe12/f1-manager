# IP-05 - Persistence Hardening

## Summary
This phase productionizes the new persistence split while preserving its separation from gameplay logic. The objective is to make autosave, save/load, import/export, and future migration behavior observable and reliable without re-coupling persistence to the store.

## Goals
- Keep persistence outside gameplay orchestration.
- Improve observability and failure handling.
- Complete save/load UX foundations.
- Make future schema growth safer.

## Execution Notes
- **Parallel with IP-01 and IP-02:** Persistence infrastructure is already decoupled from the race loop and command dispatch. IP-05 can begin immediately after IP-00 and run concurrently with IP-01 and IP-02. This eliminates one phase of sequential waiting on the critical path.
- **Synchronization gate with IP-04:** Before finalizing the persistence contract in this phase, the Race Slice Ownership Decision from IP-04 must be known. That decision determines whether the new race runtime slice enters the `world` object (requiring a schema migration here) or lives outside it (requiring no schema change). The two options and their persistence implications are documented below. If IP-05 and IP-04 overlap in time, this section should be reviewed and aligned before any schema or migration code is written.

## Race Slice Interaction (from IP-04)

IP-04 introduces a new race runtime slice to the store. This phase must explicitly handle the persistence consequence of whichever ownership option IP-04 chose.

**If IP-04 chose Option A (race slice outside `world`):**
- Autosave subscriber fires only on `world` reference changes. The race runtime slice is never saved.
- No schema migration is required in this phase.
- Verify explicitly that the autosave subscriber does not accidentally capture any race runtime fields.
- Document in `docs/architecture/persistence-contract.md` that race runtime state is intentionally transient.

**If IP-04 chose Option B (race slice inside `world`):**
- The autosave subscriber will fire on every lap update. Before accepting this, profile the write frequency against a 60-lap race. If autosave fires more than once per simulated minute of real time, add a debounce or minimum interval to `setupPersistence()`.
- A schema version bump is required. Define `SCHEMA_VERSION = 2` and add a migration path that safely handles saves written before the race runtime fields existed.
- The schema migration must handle the case where a loaded save has no race runtime fields (first load of an old save) without throwing.

**The chosen option and its persistence handling must be recorded in `docs/architecture/persistence-contract.md`.**

## In Scope
- Harden `setupPersistence()` autosave behavior.
- Improve manual save/load pathways in `useSaveGame()`.
- Document persistence contracts.
- Add tests for persistence subscriber behavior and migration hooks.
- Address race slice interaction per IP-04's chosen option (see above).

## Out of Scope
- No worker rollout work.
- No OpenF1 integration.
- No game-feature expansion.
- No redesign of the `SaveSystem` storage backend unless required by correctness.
- No Tier 2 mid-race checkpoint resume (this remains deferred unless explicitly pulled forward).

## Key Changes
- Add autosave error visibility instead of silent failure swallowing:
  - lightweight debug logging in development
  - optional UI-facing notification surface later
- Define autosave trigger rules clearly:
  - fire only on `world` reference change (Option A) or with debounce (Option B)
  - never create extra render subscriptions
- Finish manual save/load UX contract:
  - slot naming behavior
  - auto-save resume behavior
  - load-game entry point completion
- Add a persistence contract document at `docs/architecture/persistence-contract.md` covering:
  - which store fields are persisted and which are intentionally transient
  - autosave trigger rules
  - schema version history and migration entry points
  - confirmed interaction with race runtime slice from IP-04
- Define future migration entry points now, even if only one schema version exists.

## Public Interfaces / Type Changes
- `useSaveGame()` may gain richer status fields if needed, such as:
  - `lastAction`
  - `lastError`
  - `isSaving`
  - `isLoading`
- Save metadata types may be centralized if they are currently duplicated.
- No change should force persistence concerns back into `gameStore`.
- If Option B was chosen in IP-04, add a `schemaVersion` field to the save format and a `migrations` map.

## Data Flow
- Current:
  - `PersistenceProvider` boots `setupPersistence()`
  - store `world` changes trigger autosave
  - manual save/load uses `useSaveGame()`
- Target after this phase:
  - same structure remains
  - failures become visible and testable
  - save/load/import/export behavior is formally documented
  - race slice interaction is explicitly handled and documented

## Risks / Rollback
- Risk: adding observability could accidentally introduce new subscriptions or UI coupling.
- Mitigation: keep persistence status mostly imperative and side-effect oriented.
- Risk: if Option B was chosen in IP-04 and autosave fires too frequently during races, performance degrades.
- Mitigation: profile write frequency before merging. Add a debounce floor to `setupPersistence()` if lap updates trigger autosave more than a tolerable rate.
- Rollback: keep docs and tests, disable new failure reporting if it causes churn.

## Test Plan
- Add tests for:
  - autosave subscription firing on `world` changes only (Option A) or with correct debounce (Option B)
  - manual save/load success and failure
  - delete/list operations
  - schema migration entry point behavior (no-op for v1, upgrade path for v2 if Option B)
  - loading an old save (pre-race-slice) without throwing, if Option B was chosen
- Run:
  - `npx vitest run tests/engine/core tests/data`

## Acceptance Criteria
- Persistence remains decoupled from store gameplay logic.
- Autosave behavior is visible and testable.
- Manual save/load flow is complete enough for continued roadmap work.
- Future schema versioning has a documented path.
- `docs/architecture/persistence-contract.md` exists and explicitly documents the race slice interaction decision from IP-04.
- If Option B: schema migration path exists and is tested for backward compatibility.
- If Option A: autosave subscriber is verified to never capture race runtime fields.

## Assumptions
- IndexedDB remains the persistence backend.
- The Race Slice Ownership Decision from IP-04 is known before persistence contract documentation begins.
- Autosave frequency can continue to follow `world` reference changes unless profiling proves it too noisy (Option A default).
- UI polish for save management can remain basic if contract clarity is achieved.
