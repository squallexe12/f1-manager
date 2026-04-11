# IP-02 - Command Authority and Race State Ownership

## Summary
This phase clarifies where race commands and in-race state authority live before the worker rollout. The goal is to stop relying on implicit hook-local ownership and make command flow explicit, serializable, and testable.

## Goals
- Define the authoritative owner of driver commands.
- Separate gameplay command authority from UI convenience state.
- Prepare command flow for later worker dispatch and replay logging.
- Keep the current race experience stable while ownership becomes explicit.

## Execution Notes
- **Parallel with IP-01:** IP-02 touches command dispatch and `game-store.ts`. IP-01 touches bootstrap helper creation and `strategy/page.tsx`. These are independent and can execute concurrently.
- **Parallel with IP-05:** IP-02 does not touch persistence infrastructure. Both can proceed simultaneously.
- **Prerequisite for IP-03:** The `RaceCommand`, `RaceCommandType`, and `RaceCommandEnvelope` types defined here become direct inputs to IP-03's worker message contract. IP-03 must not begin until these types are defined and stable, because the worker `start` and `command` payloads depend on them. A type review between IP-02 output and IP-03 input is the required synchronization gate.
- **Prerequisite for IP-04:** The single canonical command dispatch path established here is the one IP-04 will route through the store to the worker. IP-04 cannot safely introduce store mediation until the command authority path is unambiguous.

## In Scope
- Replace placeholder command handling in `game-store.ts`.
- Define a command model suitable for future worker messaging.
- Decide which race state is authoritative and which race state is render/cache state.
- Update the strategy flow so command changes pass through one canonical path.

## Out of Scope
- No worker execution handoff yet.
- No message batching yet.
- No OpenF1 integration.
- No persistence schema migration yet.

## Key Changes
- Introduce a canonical command model in the race domain, recommended additions:
  - `RaceCommand`
  - `RaceCommandType`
  - `RaceCommandEnvelope`
- Update `game-store.ts:setDriverCommand()` to become a real action rather than a no-op.
- Add an explicit race-command dispatch boundary. Recommended direction:
  - `gameStore` records command intent.
  - `useRaceSimulation` consumes command intent for now.
  - worker will consume the same command intent in later phases.
- Separate "authoritative race command state" from "UI selected command state" if both are needed.
- Decide and document where these live:
  - authoritative commands
  - rendered command badges
  - queued command changes while paused
- All types introduced here must be JSON-serializable. This is a hard requirement because IP-03 places them directly into worker message payloads.
- Add tests for:
  - command dispatch
  - command replacement/update behavior
  - paused-state queue semantics if introduced in this phase

## Public Interfaces / Type Changes
- Extend `src/types/race.ts` with explicit command types.
- Update any hook or component signatures that currently pass only raw `DriverCommand` strings if a richer command envelope is needed.
- Preserve user-facing command options and UI labels.
- `RaceCommandEnvelope` should include at minimum: `type`, `driverId`, `payload`, and `timestamp` so IP-03 can embed it in a worker message without transformation.

## Data Flow
- Current:
  - command buttons update hook-local race state directly.
  - store command action is a placeholder.
- Target after this phase:
  - UI dispatches command intent through one canonical path.
  - command state is serializable and can be logged or replayed.
  - current hook loop consumes command state from that canonical source.

## Risks / Rollback
- Risk: command timing semantics could drift while ownership is moved.
- Mitigation: preserve current behavior first and only change ownership path, not gameplay logic.
- Rollback: keep the new types but temporarily route back to the current hook path.

## Test Plan
- Add or extend tests for command dispatch flow, recommended path: `tests/engine/race/race-command-flow.test.ts`.
- Validate that command changes preserve current race behavior.
- Run:
  - `npx vitest run tests/engine/race tests/engine/core tests/data`

## Acceptance Criteria
- `setDriverCommand()` is no longer a placeholder.
- Command flow has one documented authoritative path.
- Commands are serializable and suitable for replay/worker transfer.
- `RaceCommandEnvelope` can be JSON round-tripped without data loss (verified by test).
- No visible regression in current race controls.

## Assumptions
- Authoritative race runtime still remains in the hook during this phase.
- Commands should remain human-readable and JSON-safe.
- This phase should not yet introduce queue persistence into saves unless strictly necessary.
- The command envelope shape should be reviewed against `RaceBootstrapInput` from IP-01 before IP-03 begins, to confirm the combined worker startup payload is coherent.
