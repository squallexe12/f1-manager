# IP-07 - OpenF1 Calibration Features

## Summary
This phase uses OpenF1 data to improve realism in controlled, optional ways. It should enrich the simulation with better profiles and heuristics while preserving offline-first behavior and deterministic fallback paths.

## Goals
- Improve realism without making the game depend on live network access.
- Introduce optional calibration profiles for weather, pit loss, stints, overtakes, and circuit context.
- Deliver low-risk data-backed features before bigger gameplay expansions.

## Execution Notes
- **Hard prerequisite: IP-06 must be complete.** Calibration profiles are built on top of the repository and normalizer layer from IP-06.
- **Data completeness gate:** Before shipping any player-visible calibration feature, confirm that all 22 circuits targeted for that feature have fixture coverage and valid internal data. The IP-00 data audit and IP-06 gap notes are the reference. Do not ship calibration for a circuit where the fallback is the only tested path — that defeats the purpose.
- **Game balance review gate:** Before merging any calibration profile into the main build, run a comparison test that measures lap time distribution, pit window distribution, and race outcome variance with and without the profile active. If either distribution shifts by more than 15% at the mean, the profile values need review before shipping. This gate exists because calibration numbers that seem minor (e.g. a 2-second pit loss adjustment) can compound across 20 laps to produce a materially different race outcome.

## In Scope
- Add optional circuit-level calibration profiles.
- Improve track map source handling.
- Add pre-race and practice intelligence features powered by normalized OpenF1 data.
- Use OpenF1-derived values only through controlled profiles and fallbacks.

## Out of Scope
- No live companion mode yet.
- No hard dependency on OpenF1 availability.
- No direct replacement of the entire simulation model with historical replay data.

## Key Changes
- Extend circuit and race domain models with optional calibration fields, for example:
  - `weatherProfile`
  - `pitLossProfile`
  - `stintProfile`
  - `overtakeProfile`
  - `trackMapSource`
- Replace the naive one-lap location heuristic in the current track mapper with one of these controlled sources:
  - lap-bounded location windows
  - official circuit metadata
  - curated fallback spline data
- Add pre-race intelligence outputs, such as:
  - expected stint lengths
  - pit-loss ranges
  - overtake opportunity hints
  - weather volatility outlook
- Keep all calibration opt-in and optional.
- Add a balance test harness at `tests/engine/race/calibration-balance.test.ts` that:
  - runs the race simulation 100 times for a sample circuit with and without each profile active
  - asserts that mean lap time, mean pit window, and win probability distributions shift by no more than the allowed tolerance (default 15%)
  - can be run manually before any calibration merge

## Public Interfaces / Type Changes
- `src/types/race.ts` and related circuit types may gain optional calibration references.
- The simulation should consume calibration profiles through pure inputs, not through fetch calls.
- Fallback behavior must be encoded explicitly.
- Calibration types must carry a `source` field (e.g. `'openf1-historical' | 'curated' | 'fallback'`) so downstream code and tests can distinguish data-backed values from internal heuristics.

## Data Flow
- OpenF1 repository produces normalized datasets.
- Calibration builders derive circuit/race profiles from those datasets.
- Race bootstrap or sim helpers consume those profiles when available.
- If profiles are missing, the current internal heuristics remain in effect.

## Risks / Rollback
- Risk: realism adjustments can unintentionally change game balance.
- Mitigation: all calibration profiles are optional with explicit fallback paths; the balance test harness must pass before any profile is merged; a `source` field on each profile makes the data provenance visible in tests.
- Risk: circuits with incomplete fixture data receive silent fallback without the developer realizing calibration was not applied.
- Mitigation: the `source` field on calibration types makes fallback explicit. Add a development-mode log when a circuit falls back to internal heuristics instead of a data-backed profile.
- Rollback: disable profile consumption while retaining repository and calibration-builder code.

## Test Plan
- Add tests for profile builders:
  - weather profile derivation
  - pit-loss profile derivation
  - stint heuristic derivation
  - overtake profile derivation
- Add tests proving clean fallback behavior when no profile exists.
- Add `tests/engine/race/calibration-balance.test.ts` (see Key Changes above).
- Run:
  - `npx vitest run tests`

## Acceptance Criteria
- Simulation can consume optional calibration profiles safely.
- No network call is required during normal gameplay.
- Existing fallback heuristics remain available.
- At least one player-facing low-risk feature is powered by calibration data.
- Balance test harness passes for every circuit that has a shipped calibration profile.
- Each calibration type carries a `source` field and the development-mode fallback log is present.

## Assumptions
- Calibration is advisory or profile-based, not authoritative replay.
- Curated fallback splines remain valid until data-backed map sources are better.
- Practice and pre-race surfaces are the safest first places to expose calibration value.
- The 15% balance tolerance is a starting value and can be adjusted if playtesting shows it is too tight or too loose, but it must be explicitly revised rather than silently bypassed.
