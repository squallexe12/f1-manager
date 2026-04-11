# IP-08 - Gameplay and Engagement Expansion

## Summary
This phase layers new player-facing novelty on top of the stabilized architecture. It uses the stronger worker, persistence, and OpenF1 foundations to deliver richer race drama, decision-making, and scenario variety without eroding system safety.

## Goals
- Increase player engagement through systems that feel additive, not bolted on.
- Use prior architecture work to unlock richer commentary, race drama, and challenge modes.
- Keep new features data-driven and extensible where possible.

## Execution Notes
- **Hard prerequisite: IP-04, IP-06, and IP-07 must all be complete.** New engagement systems consume worker-emitted race events (IP-04), calibration profiles (IP-07), and OpenF1-normalized data (IP-06). Building on top of these before they are stable will produce features that need to be rebuilt when the foundations change.
- **This plan is a roadmap document, not an executable spec.** Unlike IP-00 through IP-07, IP-08 covers multiple distinct content systems. Before work begins on any individual feature, a sub-plan (same format as IP-00 through IP-07) must be written for it. This document defines what those features are, what order makes sense, and what each sub-plan must address. The first sub-plan is provided below as a template.
- **Ship one system at a time.** Each content system (engineer prompts, challenge mode, expanded commentary) is independently additive. Do not begin a second system until the first is merged, tested, and verified not to break determinism or worker ownership boundaries.

## In Scope
- Expand commentary and incident storytelling.
- Add engineer prompts and pit-window recommendation system.
- Add challenge and historic scenario modes.
- Define the extension path for a future live companion mode without implementing it.

## Out of Scope
- No destabilizing core-system rewrites.
- No bypassing worker/store/persistence contracts.
- No direct raw OpenF1 consumption in components.
- No live companion mode implementation (path is defined here; implementation is a separate phase).

## Feature Priority Order

The following features are listed in recommended ship order. Each requires a dedicated sub-plan before work begins.

1. **Engineer Prompts and Pit-Window Recommendations** — highest player value, lowest risk. Uses worker lap updates already flowing through the store. Sub-plan provided below.
2. **Expanded Commentary and Incident Storytelling** — builds on the event fabric already present in the worker. Medium complexity.
3. **Challenge and Historic Scenario Mode** — requires a scenario seed/context package system. Highest complexity; should be last.
4. **Live Companion Mode extension path** — defined here as a doc note, not implemented.

---

## Sub-Plan: Feature 1 — Engineer Prompts and Pit-Window Recommendations

### Summary
Add an engineer recommendation layer to the Strategy Room that reads live race state from the store race slice and surfaces pit-window confidence, tire-life warnings, and gap-based tactical prompts. This is the safest first engagement feature because it is read-only relative to the simulation: it consumes race state and produces UI messages without touching the simulation loop.

### Goals
- Surface actionable engineer advice during a live race without coupling to simulation internals.
- Use calibration profiles from IP-07 (pit loss ranges, stint profiles) where available.
- Keep recommendations data-driven so new rules can be added without code changes.

### In Scope
- Add a pure recommendation engine at `src/engine/race/engineer-recommendations.ts`.
- Define recommendation rule types and a rule registry at `src/data/engineer-rules/`.
- Render recommendations in the Strategy Room UI as a collapsible engineer panel.
- Use calibration profiles as inputs when available; fall back to internal heuristics when not.

### Out of Scope
- No AI/LLM-generated text.
- No autonomous strategy execution (recommendations are advisory only).
- No new worker messages — reads from the existing store race slice.

### Key Changes

**Engine layer:**
- Add `src/engine/race/engineer-recommendations.ts`:
  - Export `computeRecommendations(state: RaceSlice, profiles: CalibrationProfiles): EngineerRecommendation[]`
  - This function is pure — no side effects, no fetches, no store access.
- Add types to `src/types/race.ts`:
  - `EngineerRecommendation` — `{ id: string; severity: 'info' | 'warn' | 'critical'; message: string; lap: number; context: RecommendationContext }`
  - `RecommendationContext` — structured payload so UI can render rich tooltips without string parsing.

**Rule registry:**
- Add `src/data/engineer-rules/index.ts` — exports a `RULE_REGISTRY: EngineerRule[]`.
- Add `src/data/engineer-rules/pit-window.ts` — rules for optimal pit window, undercut threat, overcut opportunity.
- Add `src/data/engineer-rules/tire-life.ts` — rules for tire-life warnings at configurable thresholds.
- Add `src/data/engineer-rules/gap-delta.ts` — rules for gap-to-car-ahead and gap-to-car-behind tactical prompts.
- Each rule file exports one or more `EngineerRule` objects conforming to:
  - `{ id: string; evaluate: (state: RaceSlice, profiles: CalibrationProfiles) => EngineerRecommendation | null }`

**UI layer:**
- Add `src/components/strategy/EngineerPanel.tsx` — renders the active recommendation list.
- Integrate into `src/app/strategy/page.tsx` as a collapsible panel below the tire strategy section.
- Recommendations update on each lap update from the store race slice (no additional subscriptions).

### Public Interfaces / Type Changes
- `EngineerRecommendation`, `RecommendationContext`, `EngineerRule` added to `src/types/race.ts` or a new `src/types/recommendations.ts`.
- `computeRecommendations` is exported from the engine layer for direct testing.
- `EngineerPanel` accepts `recommendations: EngineerRecommendation[]` as a prop — no direct store access inside the component.

### Data Flow
- Store race slice emits lap updates via existing worker → store path (IP-04).
- Strategy page reads `lap`, `timing`, `tireStates` from store race slice.
- `computeRecommendations(raceSlice, calibrationProfiles)` is called on each lap update.
- Resulting `EngineerRecommendation[]` is passed as a prop to `EngineerPanel`.
- `EngineerPanel` renders severity-colored cards with message and context tooltip.

### Risks / Rollback
- Risk: recommendations fire too frequently and become noise.
- Mitigation: add a `cooldownLaps` field to `EngineerRule` so the same rule cannot fire on consecutive laps. Default to 3 laps between repeat suggestions.
- Risk: rule output feels generic without calibration data.
- Mitigation: rules explicitly check for profile availability and adjust message copy accordingly (`"pit window opening (historical data)"` vs `"pit window opening (estimated)"`).
- Rollback: remove `EngineerPanel` from the strategy page and keep engine + rule files for later use.

### Test Plan
- Add `tests/engine/race/engineer-recommendations.test.ts`:
  - verify each rule file fires correctly given synthetic race state inputs.
  - verify `cooldownLaps` prevents repeat firing.
  - verify graceful output when calibration profiles are absent.
- Add component tests for `EngineerPanel` rendering with mock recommendations.
- Run: `npx vitest run tests/engine/race tests/data`

### Acceptance Criteria
- `computeRecommendations` is pure and covered by unit tests.
- At least three distinct rule types are active (pit window, tire life, gap delta).
- `EngineerPanel` renders without errors during a live race and updates on each lap.
- No new worker messages or store subscriptions are added.
- All rules have a `cooldownLaps` guard.
- Feature can be completely removed by deleting `EngineerPanel` from the strategy page without affecting any other system.

---

## Remaining Features — Sub-Plans Required Before Work Begins

### Feature 2: Expanded Commentary and Incident Storytelling

Before starting, write a sub-plan covering:
- The event types to add (race control narrative, radio-inspired flavor, rivalry/momentum events).
- Where new event types are defined (`src/types/race.ts` extension vs. a new `src/types/events.ts`).
- How new event types are emitted from the worker without breaking the existing `commentary` and `incident` message shapes.
- Which events are data-file-driven vs. code-rule-driven.
- A test plan for event generation ordering and severity filtering.

### Feature 3: Challenge and Historic Scenario Mode

Before starting, write a sub-plan covering:
- The scenario seed/context package format (`src/data/challenges/`).
- How a scenario bootstrap overrides the normal `RaceBootstrapInput` from IP-01.
- Save/load interaction — are challenge runs persisted separately from career saves?
- A minimum viable set of 3 scenarios to ship with the feature.
- A test plan for scenario bootstrap determinism and correct scenario-state reset.

### Feature 4: Live Companion Mode Extension Path

This is not implemented in IP-08. The following is recorded for planning purposes only.

Live companion mode would consume live OpenF1 telemetry in place of or alongside the simulated race. It requires:
- An event-stream client in the OpenF1 integration layer (IP-06 extension).
- A switchable race state source in the store race slice — either simulated (worker) or live (OpenF1 stream).
- The store architecture from IP-04 makes this feasible: swapping the state source does not require UI changes.

When this is prioritized, it should be written as IP-09 using the same plan format.

---

## General Acceptance Criteria for IP-08
- Each shipped feature is additive and does not break determinism, persistence, or worker ownership boundaries.
- Each feature is covered by a dedicated sub-plan before implementation begins.
- Features are shipped and verified one at a time, not in parallel.
- Content systems use data files and rule registries rather than hardcoded branching wherever possible.
- Feature 1 (engineer prompts) is the first to ship and serves as a template for subsequent sub-plans.

## Assumptions
- Core architectural phases (IP-00 through IP-07) are complete before IP-08 begins.
- Content systems favor data files and rule registries over hardcoded logic.
- Live companion mode remains a future phase (IP-09 or later) unless separately pulled forward.
- The 15% balance tolerance from IP-07 applies to any calibration-profile-consuming recommendation rule.
