# IP-03 - Worker Protocol Alignment

## Summary
This phase aligns the actual worker contract with the documented architecture and the TypeScript message definitions. It does not yet switch runtime authority to the worker; it makes the protocol trustworthy first.

## Goals
- Make worker message contracts canonical and type-safe.
- Eliminate drift between ADR, worker code, and `types/race.ts`.
- Make worker startup payloads complete enough for later authoritative rollout.
- Add message-flow tests before production usage.

## Execution Notes
- **Hard prerequisite: IP-02 must be complete.** The `RaceCommandEnvelope` type and the canonical command dispatch path from IP-02 are direct inputs to the worker `command` message payload here. Beginning IP-03 before IP-02 types are stable will force a second pass over the worker message contract.
- **Soft prerequisite: IP-01 should be complete or near-complete.** The `RaceBootstrapInput` shape from IP-01 becomes part of the worker `start` payload. If IP-01 runs in parallel and finishes close to IP-02, a brief shape-alignment review should occur before IP-03 begins in earnest.
- **Independent of IP-05:** persistence infrastructure changes do not affect the worker protocol.

## In Scope
- Update `WorkerInMessage` and `WorkerOutMessage` definitions.
- Align `src/workers/race-sim-worker.ts` with those definitions.
- Update ADR and data-layer docs if contract details change.
- Add worker message-flow tests.

## Out of Scope
- No worker authority switch.
- No race slice migration in the store yet.
- No MAX-speed batching implementation unless needed to define the contract.
- No OpenF1 work.

## Key Changes
- Canonicalize `start` payload so it includes the fields the worker actually needs, drawing from `RaceBootstrapInput` (IP-01) and `RaceCommandEnvelope` (IP-02):
  - race state
  - drivers
  - strategies
  - circuit
  - seed
- Remove unsafe placeholder initialization in the worker:
  - empty `drivers`
  - empty `tireStates`
  - force-casting with `as unknown as SimRaceState`
- Extend worker outputs to match the intended protocol, as needed:
  - `ready`
  - `lapUpdate`
  - `commentary`
  - `incident`
  - `raceEnd`
  - `error`
- Define future-facing protocol fields now if they reduce churn later:
  - optional `batch`
  - optional `fatal`
  - optional recovery metadata
- Update documentation so message payload examples match actual code.

## Public Interfaces / Type Changes
- `src/types/race.ts` worker message unions will change.
- Any future worker adapter helper may be added, recommended path: `src/workers/race-worker-protocol.ts`.
- Payloads must remain JSON-serializable and browser-worker-safe.
- The `start` payload should be a strict superset of `RaceBootstrapInput` from IP-01, extended with worker-specific fields. It must not duplicate or contradict that shape.
- The `command` payload must embed `RaceCommandEnvelope` from IP-02 without transformation.

## Data Flow
- Current:
  - worker expects incomplete startup data and reconstructs invalid placeholders.
- Target after this phase:
  - main thread can fully specify worker startup input.
  - worker returns typed events that match the docs.
  - message shapes are stable enough for later store mediation.

## Risks / Rollback
- Risk: changing message types early can temporarily diverge from the current unused worker path.
- Mitigation: treat this as a contract-hardening phase and add direct tests.
- Rollback: keep the new type layer and revert only worker runtime wiring if needed.

## Test Plan
- Add worker protocol tests, recommended path: `tests/engine/race/race-sim-worker.test.ts`.
- Verify:
  - `start` initializes without placeholders
  - `pause` and `resume` behave correctly
  - `command` and `strategyChange` mutate worker state predictably
  - `raceEnd` and `error` payload shapes are stable
- Add a serialization round-trip test for each message type to guarantee worker-safe payloads.
- Run:
  - `npx vitest run tests/engine/race tests/engine/core tests/data`

## Acceptance Criteria
- Worker input and output contracts are fully typed and documented.
- No invalid placeholder state remains in worker initialization.
- Worker message-flow tests exist and pass.
- ADR and implementation agree on protocol shape.
- `start` payload integrates `RaceBootstrapInput` from IP-01 without contradiction.
- `command` payload embeds `RaceCommandEnvelope` from IP-02 without transformation.

## Assumptions
- This phase exists to reduce future migration risk, not to flip the runtime path yet.
- Some future-facing fields can be added now if they are optional and low-risk.
- Store mediation will be introduced in the next phase, not this one.
- IP-02 types are frozen before this phase begins in earnest.
