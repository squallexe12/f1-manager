# Graph Report - .  (2026-04-26)

## Corpus Check
- Large corpus: 251 files · ~204,756 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 807 nodes · 1231 edges · 57 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.81)
- Token cost: 315,249 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Race Penalty System Tier A v1 Design Spec` - 23 edges
2. `Current-State Baseline (Post-v1.0.1)` - 22 edges
3. `penalty-engine.ts` - 20 edges
4. `src/workers/race-sim-worker.ts` - 17 edges
5. `Factory Page Architecture` - 14 edges
6. `raceRuntime slice` - 10 edges
7. `car-performance-insights.ts` - 10 edges
8. `Persistence Contract` - 10 edges
9. `Factory Box 1 Car Performance Plan` - 10 edges
10. `SaveSystem` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Race Penalty System Tier A v1 Design Spec` --semantically_similar_to--> `Community: Penalty System (18 nodes)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-04-25-race-penalty-system-tier-a-design.md → graphify-out/GRAPH_REPORT.md
- `evaluateContestedEvent()` --semantically_similar_to--> `God Node: evaluateContestedEvent() (4 edges)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-04-25-race-penalty-system-tier-a-design.md → graphify-out/GRAPH_REPORT.md
- `src/engine/core/save-system.ts` --semantically_similar_to--> `God Node: SaveSystem (9 edges)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-04-25-race-penalty-system-tier-a-design.md → graphify-out/GRAPH_REPORT.md
- `CLAUDE.md - Mission Control PRD` --references--> `Progressive Disclosure (Glance/Detail/Deep Dive)`  [EXTRACTED]
  CLAUDE.md → AGENTS.md
- `ADR-001: System Architecture` --references--> `Game Phase Finite State Machine`  [EXTRACTED]
  docs/architecture/adr-001-system-architecture.md → AGENTS.md

## Hyperedges (group relationships)
- **Implementation Phases Pipeline** — ip_01_bootstrap, ip_02_command_authority, ip_03_worker_protocol, ip_04_worker_authority, ip_05_persistence, ip_06_openf1_integration, ip_07_openf1_extended, ip_08_engineer_recommendations, ip_09_penalty_tier_a [EXTRACTED 1.00]
- **Four-Agent Routing Architecture** — agent_sim_engine, agent_game_state, agent_ui_interface, agent_verify [EXTRACTED 1.00]
- **Factory Three-Cards Workstream** — plan_factory_box1, plan_factory_box2, factory_page_doc, power_unit_card_tsx [EXTRACTED 0.90]
- **Implementation Pipeline (IP-00 through IP-08)** — ip_00_baseline, ip_01_determinism, ip_02_command_authority, ip_03_worker_protocol, ip_04_worker_rollout, ip_05_persistence_hardening, ip_06_openf1_foundation, ip_07_openf1_calibration, ip_08_gameplay_expansion [EXTRACTED 1.00]
- **Factory Three-Card Phased Implementation** — factory_phase_1, factory_phase_2, factory_phase_3, factory_three_cards_design [EXTRACTED 1.00]
- **Penalty Engine Pure Functions** — evaluate_contested_event, open_investigation, resolve_investigations, select_sanction, expire_penalty_points [EXTRACTED 1.00]

## Communities

### Community 0 - "Race Calibration & Broadcast"
Cohesion: 0.04
Nodes (27): buildSetup(), makeDriverPool(), Chrome Component Prop Interfaces Baseline, calculateStrategyOptions(), computeHeuristicOffset(), computeStintBasedOffset(), bootstrapRace(), deriveRaceSeed() (+19 more)

### Community 1 - "Component Aging & Strategy (Box 2)"
Cohesion: 0.03
Nodes (6): applyAging(), clamp(), DriverCard(), moodPill(), clamp(), updateMood()

### Community 2 - "Car Performance Card (Box 1)"
Cohesion: 0.04
Nodes (16): calculateCarPerformance(), Car Performance Card (Box 1), clamp(), car-performance-insights.ts, mtbfFromEvents(), mtbfFromFailureLog(), mtbfHeuristicWorstWear(), estimateMarketValue() (+8 more)

### Community 3 - "Budget Engine & Calendar"
Cohesion: 0.05
Nodes (20): commercialDirectorDecision(), generateRecommendations(), getAllDepartmentDecisions(), raceEngineerDecision(), teamManagerDecision(), technicalDirectorDecision(), generateWeeklySchedule(), pickRndFocus() (+12 more)

### Community 4 - "Aero/Penalty Cross-Concepts (Box 3)"
Cohesion: 0.04
Nodes (51): AeroBooking, aero-budget.ts, Aero Testing Card (Box 3), AppliedPenalty, 12-point ban threshold, Community: Orchestrator & AI Teams (6 nodes), Community: Penalty System (18 nodes), Community: Race Sim Worker (10 nodes) (+43 more)

### Community 5 - "UI Cards & Buttons"
Cohesion: 0.04
Nodes (4): handleAdvance(), handleStartSession(), getRatingColor(), PrestigeMeter()

### Community 6 - "Architecture & Game State Core"
Cohesion: 0.06
Nodes (52): ADR-001: System Architecture, advanceGamePhase(), game-state agent, sim-engine agent, Current-State Baseline (Post-v1.0.1), Data Layer Architecture, Engine Purity Invariant, FullGameState type (+44 more)

### Community 7 - "Agents & Project Docs"
Cohesion: 0.05
Nodes (41): ui-interface agent, verify agent, Broadcast Pit-Wall Design System, src/engine/engineering/car-performance-insights.ts, src/engine/engineering/car-performance.ts, CLAUDE.md - Mission Control PRD, src/engine/engineering/component-lifecycle.ts, src/engine/engineering/component-strategy.ts (+33 more)

### Community 8 - "Game Store & Recommendations"
Cohesion: 0.05
Nodes (8): applyRecommendationAction(), parseStrategyAction(), IP-05 Persistence Hardening, Option A: race slice OUTSIDE world, Option B: race slice INSIDE world, docs/architecture/persistence-contract.md, Race Slice Ownership Decision (Option A vs B), useSaveGame()

### Community 9 - "Circuit Map & OpenF1 Client"
Cohesion: 0.1
Nodes (16): drawCars(), getSplinePosition(), lerp(), clamp01(), linearSlope(), mapOpenF1CompoundToPirelli(), normalizeCalibrationProfile(), normalizeOvertakeCalibration() (+8 more)

### Community 10 - "Events & Narrative Feed"
Cohesion: 0.08
Nodes (2): estimatePrizeMoney(), processPostRace()

### Community 11 - "Orchestrator & AI Teams"
Cohesion: 0.1
Nodes (8): advanceGamePhase(), drainPendingSwaps(), processManagementEntry(), applySeasonRegulations(), getRegulationsForSeason(), advanceRnD(), processRnDCycle(), unlockDependents()

### Community 12 - "Race Sim Worker"
Cohesion: 0.12
Nodes (11): src/workers/race-sim-worker.ts, emitError(), __handleMessage(), lastValidLap(), postEvent(), resolveLabel(), simulateNextLap(), isCommandMessage() (+3 more)

### Community 13 - "Calibration & Engineer Recommendations"
Cohesion: 0.14
Nodes (16): adr-001-system-architecture.md, Calibration Balance Test Harness (15% tolerance), Calibration Profiles (weather/pit-loss/stint/overtake/trackMap), Calibration source field (openf1-historical/curated/fallback), computeRecommendations(), current-state-baseline.md, 2026 Season Data Audit (11 teams, 22 drivers, 22 circuits), Engineer Recommendations / EngineerPanel (+8 more)

### Community 14 - "Calibration Profile Registry"
Cohesion: 0.2
Nodes (9): deepCloneProfile(), hydrateBuiltInProfiles(), loadCalibrationProfile(), registerCalibrationProfile(), resolveCalibrationForCircuit(), sanitizeCalibrationProfile(), sanitizePitLossCalibration(), sanitizeStintCalibration() (+1 more)

### Community 15 - "Save System & Migrations"
Cohesion: 0.17
Nodes (2): migrateToCurrent(), SaveSystem

### Community 16 - "Penalty System Tier A & FIA Rules"
Cohesion: 0.23
Nodes (13): F1 Rules and Penalty System Technical Reference, 2025 F1 Sporting Regulations, FIA ISC Appendix B Code of Conduct, FIA ISC Appendix L Driving Standards, FIA 2025 Penalty and Point Guidelines, IP-09 Penalty System Tier A, src/data/penalty-calibration.ts, src/engine/race/penalty-engine.ts (+5 more)

### Community 17 - "Top Nav & Page Shell"
Cohesion: 0.2
Nodes (0): 

### Community 18 - "Race Sim Test Fixtures"
Cohesion: 0.46
Nodes (6): buildPitState(), mockDrivers(), mockRaceSetup(), mockRaceState(), mockStrategies(), setupState()

### Community 19 - "Atoms (Legacy JSX)"
Cohesion: 0.33
Nodes (0): 

### Community 20 - "Hero Timing Panels (Legacy)"
Cohesion: 0.33
Nodes (0): 

### Community 21 - "Kinetic Design Snapshot"
Cohesion: 0.4
Nodes (5): Kinetic Route Baseline Snapshot, Kinetic Design Tokens (lime/cyan/dark), src/components/layout/nav-bar.tsx, src/components/layout/page-shell.tsx, src/components/layout/top-bar.tsx

### Community 22 - "Strategy Map (Legacy)"
Cohesion: 0.5
Nodes (0): 

### Community 23 - "Phase Screens (Legacy)"
Cohesion: 0.5
Nodes (0): 

### Community 24 - "Mission Control Design Spec"
Cohesion: 0.67
Nodes (4): Design Decisions Table, Design Specification â€” Product Summary, Component State Matrix, Implementation Plan Overview

### Community 25 - "Aero & Donut Charts"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Animations"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Tooltip"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Project Scaffolding Plan"
Cohesion: 1.0
Nodes (2): Implementation File Map, Task 1: Project Scaffolding & Design System

### Community 29 - "Core Game Loop Rationale"
Cohesion: 1.0
Nodes (2): Core Game Loop Architecture, Rationale: Hybrid Phase Game Flow (Management + Race)

### Community 30 - "Six Engines & Narrative Rationale"
Cohesion: 1.0
Nodes (2): Six Simulation Engines, Rationale: Full Living World Narrative (All 6 Threads)

### Community 31 - "Next Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Next Config"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Vitest Config"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Legacy Data Module"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Legacy Factory Data"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Legacy Paddock Data"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Health Widget"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Test Setup"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "User Journeys Doc"
Cohesion: 1.0
Nodes (1): Frontend User Journeys

### Community 41 - "Progressive Disclosure Doc"
Cohesion: 1.0
Nodes (1): Frontend Interaction Patterns (Progressive Disclosure)

### Community 42 - "Responsive Breakpoints Doc"
Cohesion: 1.0
Nodes (1): Responsive Behavior & Breakpoints

### Community 43 - "Animation Spec Doc"
Cohesion: 1.0
Nodes (1): Animation Specifications

### Community 44 - "Accessibility Spec Doc"
Cohesion: 1.0
Nodes (1): Accessibility Specifications (WCAG 2.1 AA)

### Community 45 - "Delegation System Doc"
Cohesion: 1.0
Nodes (1): Delegation System (4 Department Heads)

### Community 46 - "AI Team Behavior Doc"
Cohesion: 1.0
Nodes (1): AI Team Behavior Model

### Community 47 - "Starting Scenarios Doc"
Cohesion: 1.0
Nodes (1): Starting Scenarios (Golden Era, Rebuild, Newcomer, Crisis)

### Community 48 - "Screen Architecture Doc"
Cohesion: 1.0
Nodes (1): Screen Architecture (7 Screens)

### Community 49 - "Kinetic Command Visual System Doc"
Cohesion: 1.0
Nodes (1): Visual Design System: Kinetic Command

### Community 50 - "Tire Model Reference"
Cohesion: 1.0
Nodes (1): src/engine/race/tire-model.ts

### Community 51 - "Weather Reference"
Cohesion: 1.0
Nodes (1): src/engine/race/weather.ts

### Community 52 - "Overtake Reference"
Cohesion: 1.0
Nodes (1): src/engine/race/overtake.ts

### Community 53 - "Pit Strategy Reference"
Cohesion: 1.0
Nodes (1): src/engine/race/pit-strategy.ts

### Community 54 - "Race Runtime Slice"
Cohesion: 1.0
Nodes (1): src/stores/race-runtime-slice.ts

### Community 55 - "Driver Type"
Cohesion: 1.0
Nodes (1): src/types/driver.ts

### Community 56 - "Drivers Page"
Cohesion: 1.0
Nodes (1): src/app/drivers/page.tsx

## Knowledge Gaps
- **115 isolated node(s):** `Frontend User Journeys`, `Frontend Interaction Patterns (Progressive Disclosure)`, `Responsive Behavior & Breakpoints`, `Animation Specifications`, `Accessibility Specifications (WCAG 2.1 AA)` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Animations`** (2 nodes): `animated.tsx`, `FadeIn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tooltip`** (2 nodes): `tooltip.tsx`, `Tooltip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Project Scaffolding Plan`** (2 nodes): `Implementation File Map`, `Task 1: Project Scaffolding & Design System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Core Game Loop Rationale`** (2 nodes): `Core Game Loop Architecture`, `Rationale: Hybrid Phase Game Flow (Management + Race)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Six Engines & Narrative Rationale`** (2 nodes): `Six Simulation Engines`, `Rationale: Full Living World Narrative (All 6 Threads)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vitest Config`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Legacy Data Module`** (1 nodes): `data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Legacy Factory Data`** (1 nodes): `factory-data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Legacy Paddock Data`** (1 nodes): `paddock-data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Health Widget`** (1 nodes): `health-widget.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Setup`** (1 nodes): `setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Journeys Doc`** (1 nodes): `Frontend User Journeys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Progressive Disclosure Doc`** (1 nodes): `Frontend Interaction Patterns (Progressive Disclosure)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Responsive Breakpoints Doc`** (1 nodes): `Responsive Behavior & Breakpoints`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Animation Spec Doc`** (1 nodes): `Animation Specifications`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accessibility Spec Doc`** (1 nodes): `Accessibility Specifications (WCAG 2.1 AA)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Delegation System Doc`** (1 nodes): `Delegation System (4 Department Heads)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Team Behavior Doc`** (1 nodes): `AI Team Behavior Model`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Starting Scenarios Doc`** (1 nodes): `Starting Scenarios (Golden Era, Rebuild, Newcomer, Crisis)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Screen Architecture Doc`** (1 nodes): `Screen Architecture (7 Screens)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Kinetic Command Visual System Doc`** (1 nodes): `Visual Design System: Kinetic Command`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tire Model Reference`** (1 nodes): `src/engine/race/tire-model.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Weather Reference`** (1 nodes): `src/engine/race/weather.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Overtake Reference`** (1 nodes): `src/engine/race/overtake.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pit Strategy Reference`** (1 nodes): `src/engine/race/pit-strategy.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Race Runtime Slice`** (1 nodes): `src/stores/race-runtime-slice.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Driver Type`** (1 nodes): `src/types/driver.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drivers Page`** (1 nodes): `src/app/drivers/page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `raceRuntime slice` connect `Architecture & Game State Core` to `Race Calibration & Broadcast`, `Game Store & Recommendations`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `Current-State Baseline (Post-v1.0.1)` connect `Architecture & Game State Core` to `Penalty System Tier A & FIA Rules`, `Agents & Project Docs`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `penalty-engine.ts` connect `Aero/Penalty Cross-Concepts (Box 3)` to `Race Calibration & Broadcast`, `Events & Narrative Feed`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Current-State Baseline (Post-v1.0.1)` (e.g. with `ADR-001: System Architecture` and `Factory Page Architecture`) actually correct?**
  _`Current-State Baseline (Post-v1.0.1)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Factory Page Architecture` (e.g. with `Current-State Baseline (Post-v1.0.1)` and `Factory Box 1 Car Performance Plan`) actually correct?**
  _`Factory Page Architecture` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Frontend User Journeys`, `Frontend Interaction Patterns (Progressive Disclosure)`, `Responsive Behavior & Breakpoints` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Race Calibration & Broadcast` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._