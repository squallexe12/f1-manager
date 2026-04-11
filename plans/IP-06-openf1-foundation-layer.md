# IP-06 - OpenF1 Foundation Layer

## Summary
This phase introduces OpenF1 as a normalized data layer rather than a direct-fetch convenience utility. It creates the adapter/repository foundation needed for later realism and engagement features while keeping core simulation formulas untouched.

## Goals
- Isolate OpenF1 behind a stable internal interface.
- Prevent raw API payloads from leaking into components or gameplay logic.
- Support both historical and future live datasets through one domain-facing layer.
- Make the integration testable with fixtures instead of live network calls.

## Execution Notes
- **Prerequisite: IP-00 data audit must be reviewed.** The data audit in IP-00 produces a report of which circuits and drivers have complete data. Before building the OpenF1 repository, confirm that all 22 circuits targeted for calibration in IP-07 are present in the internal data layer. If the audit revealed missing circuit entries, those gaps must be resolved before IP-06 begins — otherwise the repository and normalizer work in this phase will build adapters for circuits that have no internal counterpart.
- **Can run in parallel with IP-01 through IP-05.** OpenF1 integration does not touch the race loop, command system, worker protocol, or persistence layer. It is an independent data access module.

## In Scope
- Add an OpenF1 repository/adapter layer.
- Introduce normalized domain types for meetings, sessions, weather, laps, stints, pit, race control, radio, location, and circuit metadata.
- Define fixture-based parsing and caching strategy.
- Document endpoint usage and integration boundaries.

## Out of Scope
- No simulation-calibration formulas yet.
- No network-dependent gameplay features.
- No live realtime mode implementation.
- No direct component fetches.

## Key Changes
- Add a new data access module group, recommended path:
  - `src/integrations/openf1/`
  - `src/integrations/openf1/client.ts`
  - `src/integrations/openf1/repository.ts`
  - `src/integrations/openf1/normalizers.ts`
  - `src/integrations/openf1/types.ts`
- Define normalized internal types, for example:
  - `OpenF1Meeting`
  - `OpenF1Session`
  - `OpenF1WeatherProfile`
  - `OpenF1StintDataset`
  - `OpenF1PitDataset`
  - `OpenF1RaceControlEvent`
- Move existing track-mapper utility onto this foundation instead of keeping it as a one-off fetch helper.
- Add integration docs at `docs/integrations/openf1.md`, including:
  - supported endpoints
  - which circuits have confirmed fixture data
  - which circuits from the IP-00 audit are not yet covered and are known gaps

## Public Interfaces / Type Changes
- Add internal repository interfaces only; no UI-facing API should consume raw OpenF1 shapes.
- Extend internal race/circuit domain types only where needed to reference normalized external data.
- Network client behavior should be injectable so tests can use fixtures.

## Data Flow
- Current:
  - one utility fetches OpenF1 location directly.
- Target after this phase:
  - repository fetches raw payload
  - normalizer converts raw payload to internal types
  - app code consumes normalized models only
  - tests run entirely on fixtures

## Risks / Rollback
- Risk: over-designing the integration before actual calibration work.
- Mitigation: keep the first version narrow and endpoint-driven, not abstraction-heavy.
- Risk: building normalizers for circuits that have no internal counterpart if the IP-00 data audit is not reviewed first.
- Mitigation: cross-check the IP-00 data audit report before starting normalizer work. Record any gaps explicitly in the integration docs.
- Rollback: preserve the normalized type layer even if repository shape needs simplification.

## Test Plan
- Add fixture-based tests for all supported endpoint normalizers.
- Add repository tests with mocked fetch responses.
- Run:
  - `npx vitest run tests`

## Acceptance Criteria
- OpenF1 access exists through a dedicated repository/adapter layer.
- Raw payloads do not leak into UI components.
- The integration can be tested without network access.
- Endpoint usage and boundaries are documented.
- Integration docs note which circuits have confirmed fixture coverage and which are outstanding gaps from the IP-00 audit.

## Assumptions
- Historical OpenF1 data is the first supported mode.
- Live mode remains a future extension.
- The initial supported endpoint set should cover only the roadmap needs, not all endpoints.
- Any circuit data gaps identified in the IP-00 audit that were not resolved before IP-06 must be tracked and prioritized before IP-07 begins.
