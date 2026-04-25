# Graph Report - .  (2026-04-25)

## Corpus Check
- 213 files · ~178,591 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 572 nodes · 936 edges · 31 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `SaveSystem` - 9 edges
2. `normalizeCalibrationProfile()` - 6 edges
3. `getAllDepartmentDecisions()` - 6 edges
4. `normalizeTireCalibration()` - 5 edges
5. `simulateNextLap()` - 5 edges
6. `__handleMessage()` - 5 edges
7. `mockRaceState()` - 5 edges
8. `deepCloneProfile()` - 4 edges
9. `sanitizeCalibrationProfile()` - 4 edges
10. `evaluateContestedEvent()` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (17): calculateStrategyOptions(), computeHeuristicOffset(), computeStintBasedOffset(), bootstrapRace(), deriveRaceSeed(), deriveRaceIntel(), describeOvertakeHint(), describeWeatherOutlook() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (2): handleAdvance(), handleStartSession()

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (4): DriverCard(), moodPill(), clamp(), updateMood()

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (10): commercialDirectorDecision(), generateRecommendations(), getAllDepartmentDecisions(), raceEngineerDecision(), teamManagerDecision(), technicalDirectorDecision(), advanceGamePhase(), processManagementEntry() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (2): applyRecommendationAction(), parseStrategyAction()

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (8): applyAging(), clamp(), getRatingColor(), PrestigeMeter(), applySeasonRegulations(), getRegulationsForSeason(), getAvailableSponsors(), prestigeLevel()

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (7): estimateMarketValue(), evaluateOffer(), advanceRnD(), processRnDCycle(), unlockDependents(), TeamHeroCard(), trendClass()

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (19): buildSetup(), makeDriverPool(), clamp01(), computeAttackerFault(), computeDefenderFault(), evaluateContestedEvent(), severityFromScore(), baseInput() (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (16): drawCars(), getSplinePosition(), lerp(), clamp01(), linearSlope(), mapOpenF1CompoundToPirelli(), normalizeCalibrationProfile(), normalizeOvertakeCalibration() (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (12): generateWeeklySchedule(), pickRndFocus(), pickSponsorFocus(), forecastWeather(), getNextRaceBrief(), applyScenarioToTeam(), buildTeam(), createInitialFinance() (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (4): calculateCarPerformance(), clamp(), car(), team()

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (10): emitError(), __handleMessage(), lastValidLap(), postEvent(), resolveLabel(), simulateNextLap(), isCommandMessage(), isSetSpeedMessage() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (2): migrateToCurrent(), SaveSystem

### Community 13 - "Community 13"
Cohesion: 0.2
Nodes (9): deepCloneProfile(), hydrateBuiltInProfiles(), loadCalibrationProfile(), registerCalibrationProfile(), resolveCalibrationForCircuit(), sanitizeCalibrationProfile(), sanitizePitLossCalibration(), sanitizeStintCalibration() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.2
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 20`** (2 nodes): `animated.tsx`, `FadeIn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `tooltip.tsx`, `Tooltip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `factory-data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `paddock-data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `health-widget.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._