# Graph Report - ./src  (2026-04-11)

## Corpus Check
- Corpus is ~42,011 words - fits in a single context window. You may not need a graph.

## Summary
- 256 nodes · 423 edges · 15 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `SaveSystem` - 9 edges
2. `getAllDepartmentDecisions()` - 5 edges
3. `WeatherEngine` - 4 edges
4. `getSplinePosition()` - 3 edges
5. `createInitialFinance()` - 3 edges
6. `initializeGame()` - 3 edges
7. `processRnDCycle()` - 3 edges
8. `simulateLap()` - 3 edges
9. `handleAdvance()` - 2 edges
10. `handleStartSession()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "UI Primitives & Data"
Cohesion: 0.08
Nodes (0): 

### Community 1 - "Race Weekend UI Components"
Cohesion: 0.06
Nodes (2): handleAdvance(), handleStartSession()

### Community 2 - "Car Performance Engine"
Cohesion: 0.09
Nodes (6): applyAging(), clamp(), calculateCarPerformance(), clamp(), estimateMarketValue(), evaluateOffer()

### Community 3 - "Core Game Types & Cards"
Cohesion: 0.1
Nodes (8): getRatingColor(), PrestigeMeter(), getAvailableSponsors(), prestigeLevel(), createInitialFinance(), defaultPrestigeForTeam(), initializeGame(), prestigeToScore()

### Community 4 - "Race Mechanics Engine"
Cohesion: 0.09
Nodes (8): postMessage(), simulateNextLap(), calculateBaseLapTime(), simulateLap(), simulateRace(), calculateDegradation(), degradeTire(), WeatherEngine

### Community 5 - "Game Orchestration & AI"
Cohesion: 0.1
Nodes (5): advanceGamePhase(), processManagementEntry(), advanceRnD(), processRnDCycle(), unlockDependents()

### Community 6 - "App Layout & Persistence"
Cohesion: 0.11
Nodes (1): SaveSystem

### Community 7 - "Paddock Events & Narrative"
Cohesion: 0.16
Nodes (0): 

### Community 8 - "Finance & Post-Race Processing"
Cohesion: 0.18
Nodes (4): clamp(), updateMood(), estimatePrizeMoney(), processPostRace()

### Community 9 - "Regulation Engine"
Cohesion: 0.29
Nodes (2): applySeasonRegulations(), getRegulationsForSeason()

### Community 10 - "Circuit Map Rendering"
Cohesion: 0.38
Nodes (3): drawCars(), getSplinePosition(), lerp()

### Community 11 - "Department AI Decisions"
Cohesion: 0.6
Nodes (5): commercialDirectorDecision(), getAllDepartmentDecisions(), raceEngineerDecision(), teamManagerDecision(), technicalDirectorDecision()

### Community 12 - "OpenF1 Track Mapper"
Cohesion: 0.67
Nodes (2): fetchTrackSpline(), normalizeCoordinates()

### Community 13 - "Animation Primitives"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Tooltip Component"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Animation Primitives`** (2 nodes): `animated.tsx`, `FadeIn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tooltip Component`** (2 nodes): `tooltip.tsx`, `Tooltip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `UI Primitives & Data` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Race Weekend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Car Performance Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Core Game Types & Cards` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Race Mechanics Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Game Orchestration & AI` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `App Layout & Persistence` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._