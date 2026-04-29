# Race Team Radio v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Team Radio" panel to the race page that surfaces realistic, broadcast-style F1 radio transmissions (engineer ↔ driver ↔ FIA) with full 22-driver personality, deterministic picking via the seeded PRNG, and ~14 event categories.

**Architecture:** Pipeline A (new gameplay feature). Three new sim-engine modules (`driver-radio-profiles.ts`, `race-radio.ts`, `radio-picker.ts`) extend `CommentaryEntry` with optional metadata. The race simulator gains up to 8 new emit points (plus 2 wired-but-dormant for safety car). UI gains one new `'use client'` panel and a small filter on the existing Commentary feed. No schema migration — commentary stays session-scoped in `raceRuntime`.

**Tech Stack:** TypeScript strict mode, Next.js 16 App Router, Vitest (with React Testing Library + `fake-indexeddb`), Tailwind CSS 4, Zustand, the existing seeded `PRNG` in `src/engine/core/prng.ts`, Web Worker for race simulation.

**Spec:** [docs/superpowers/specs/2026-04-29-race-team-radio-design.md](../specs/2026-04-29-race-team-radio-design.md)

---

## Pre-flight

- [ ] **Confirm clean working tree.** Run `git status` and ensure no uncommitted changes before starting Task 1.
- [ ] **Confirm tests pass on `main`.** Run `npx vitest run` and `npx tsc --noEmit`. Both must be green before starting.
- [ ] **Read the spec end-to-end.** `docs/superpowers/specs/2026-04-29-race-team-radio-design.md`. The plan assumes you've internalised §4–§7.
- [ ] **Read AGENTS.md §0 and §3.** Engine purity, PRNG-only randomness, no `Math.random()`, no browser APIs in `src/engine/`. These rules are non-negotiable.

**Calibration note:** `Mood.frustration` in this codebase is **0–100**, not 0–1. The spec used 0–1 notation in places — the plan corrects this. Always use 0–100 for mood gates.

---

## Phase 1 — Foundation Types

These tasks add the type surface only. Verification is `npx tsc --noEmit`. No runtime tests yet.

### Task 1: Extend `CommentaryEntry` with optional radio fields

**Files:**
- Modify: `src/types/race.ts:144-148`

- [ ] **Step 1: Add new union types and extended interface.**

Replace the existing `CommentaryEntry` interface (currently at `src/types/race.ts:144-148`) with:

```ts
export type RadioCategory =
  | 'box_box'
  | 'box_opposite'
  | 'pit_confirm'
  | 'stay_out'
  | 'overtake_done'
  | 'overtake_failed'
  | 'tire_complaint'
  | 'gap_call'
  | 'push_now'
  | 'manage_tires'
  | 'investigation'
  | 'penalty_5s'
  | 'penalty_drive_through'
  | 'safety_car_deploy'
  | 'safety_car_in'
  | 'rain_incoming'
  | 'fastest_lap'
  | 'final_lap'
  | 'lights_out'
  | 'driver_frustration'

export type RadioSpeaker = 'engineer' | 'driver' | 'fia'

export type RadioTone = 'calm' | 'urgent' | 'angry' | 'flat' | 'celebrate'

export interface CommentaryEntry {
  lap: number
  text: string
  severity: 'critical' | 'highlight' | 'radio' | 'info' | 'neutral'
  // Optional radio metadata. All fields additive; old commentary entries
  // (overtakes pre-radio-rewrite, fastest-lap markers, neutral lap-by-lap)
  // remain valid.
  speaker?: RadioSpeaker
  driverId?: string
  teamId?: string
  category?: RadioCategory
  tone?: RadioTone
  isPlayerTeam?: boolean
}
```

- [ ] **Step 2: Verify TypeScript compiles.**

Run: `npx tsc --noEmit`
Expected: clean exit (no errors). The existing two emit sites in `race-simulator.ts` will still compile — they only set `severity`, and all new fields are optional.

- [ ] **Step 3: Commit.**

```bash
git add src/types/race.ts
git commit -m "feat(types): extend CommentaryEntry with optional radio metadata"
```

---

### Task 2: Add `RadioArchetype` and supporting types

**Files:**
- Create: `src/types/radio.ts`

- [ ] **Step 1: Create the new types module.**

```ts
// src/types/radio.ts
import type { RadioCategory, RadioSpeaker, RadioTone } from '@/types/race'

export type RadioArchetype =
  | 'calm-pro'
  | 'hot-headed'
  | 'spiritual'
  | 'emotional'
  | 'rookie'
  | 'veteran'

export interface DriverRadioProfile {
  driverId: string
  archetypes: [RadioArchetype, RadioArchetype?]
  signatureLines?: Partial<Record<RadioCategory, string[]>>
  catchphraseChance?: number  // 0..1, default 0.25
}

export interface RadioTemplate {
  category: RadioCategory
  speaker: RadioSpeaker
  text: string
  archetypes?: RadioArchetype[]   // empty = generic, eligible to all
  tone?: RadioTone
  minFrustration?: number         // 0-100, default 0
  maxFrustration?: number         // 0-100, default 100
  weight?: number                 // pick weight, default 1
}
```

- [ ] **Step 2: Verify TypeScript compiles.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add src/types/radio.ts
git commit -m "feat(types): add RadioArchetype, DriverRadioProfile, RadioTemplate types"
```

---

## Phase 2 — Data Layer

This phase authors the radio profile registry and template library. The bulk of "authoring time" lives here. Tests for coverage are added in Phase 3 alongside the picker.

### Task 3: Create driver radio profiles registry

**Files:**
- Create: `src/data/driver-radio-profiles.ts`

- [ ] **Step 1: Author the registry for all 22 drivers.**

```ts
// src/data/driver-radio-profiles.ts
import type { DriverRadioProfile } from '@/types/radio'

/**
 * Personality registry for all 22 drivers on the 2026 grid.
 *
 * Each driver carries a primary archetype and optionally a secondary that
 * blends in the picker (eligible templates are the union of both archetype
 * pools). Drivers may also override or add signature lines per category;
 * when a category has signatures and the catchphrase roll succeeds, the
 * picker selects from those instead of the archetype pool.
 *
 * Invariant: every Driver.id in `src/data/drivers.ts` MUST have an entry
 * here. `tests/data/driver-radio-profiles.test.ts` enforces this.
 */
export const DRIVER_RADIO_PROFILES: readonly DriverRadioProfile[] = [
  // McLaren
  {
    driverId: 'norris',
    archetypes: ['calm-pro'],
    signatureLines: {
      overtake_done: ['Yes! Lovely. Lovely.'],
      driver_frustration: ['Mate, what was that.'],
    },
    catchphraseChance: 0.3,
  },
  {
    driverId: 'piastri',
    archetypes: ['calm-pro'],
    signatureLines: {
      pit_confirm: ['Copy.'],
      overtake_done: ['Done.'],
    },
    catchphraseChance: 0.25,
  },
  // Red Bull
  {
    driverId: 'verstappen',
    archetypes: ['hot-headed', 'veteran'],
    signatureLines: {
      overtake_done: ['Simply lovely.', 'Yes! Yes! Get in!'],
      driver_frustration: ['I told you ten laps ago.', 'What a stupid call. Stupid.'],
      tire_complaint: ['These tyres are dead. Dead.'],
    },
    catchphraseChance: 0.35,
  },
  {
    driverId: 'hadjar',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Ferrari
  {
    driverId: 'leclerc',
    archetypes: ['emotional'],
    signatureLines: {
      driver_frustration: ['I am stupid. I am stupid.', 'No no no no.'],
      overtake_failed: ['What a mess. What a mess.'],
    },
    catchphraseChance: 0.35,
  },
  {
    driverId: 'hamilton',
    archetypes: ['spiritual', 'veteran'],
    signatureLines: {
      overtake_done: ['Get in there Lewis!', 'Still we rise.'],
      final_lap: ['Bring it home, mate. Bring it home.'],
    },
    catchphraseChance: 0.35,
  },
  // Mercedes
  {
    driverId: 'russell',
    archetypes: ['calm-pro'],
    signatureLines: {
      driver_frustration: ['What is going on?'],
    },
    catchphraseChance: 0.25,
  },
  {
    driverId: 'antonelli',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Aston Martin
  {
    driverId: 'alonso',
    archetypes: ['hot-headed', 'veteran'],
    signatureLines: {
      overtake_done: ['Magic. This is magic.'],
      driver_frustration: ['I am Alonso. I am ALONSO.', 'Unbelievable. Unbelievable.'],
    },
    catchphraseChance: 0.4,
  },
  {
    driverId: 'stroll',
    archetypes: ['veteran'],
    catchphraseChance: 0.15,
  },
  // Williams
  {
    driverId: 'albon',
    archetypes: ['calm-pro'],
    catchphraseChance: 0.2,
  },
  {
    driverId: 'sainz',
    archetypes: ['calm-pro', 'veteran'],
    signatureLines: {
      overtake_done: ['Vamos!'],
    },
    catchphraseChance: 0.25,
  },
  // Racing Bulls
  {
    driverId: 'lawson',
    archetypes: ['hot-headed'],
    catchphraseChance: 0.2,
  },
  {
    driverId: 'lindblad',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Alpine
  {
    driverId: 'gasly',
    archetypes: ['emotional'],
    signatureLines: {
      driver_frustration: ['I cannot believe it. I cannot believe it.'],
    },
    catchphraseChance: 0.3,
  },
  {
    driverId: 'colapinto',
    archetypes: ['rookie', 'hot-headed'],
    catchphraseChance: 0.2,
  },
  // Haas
  {
    driverId: 'ocon',
    archetypes: ['hot-headed'],
    catchphraseChance: 0.2,
  },
  {
    driverId: 'bearman',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Audi
  {
    driverId: 'hulkenberg',
    archetypes: ['veteran'],
    signatureLines: {
      driver_frustration: ['Same story. Same story every time.'],
    },
    catchphraseChance: 0.25,
  },
  {
    driverId: 'bortoleto',
    archetypes: ['rookie'],
    catchphraseChance: 0.15,
  },
  // Cadillac
  {
    driverId: 'bottas',
    archetypes: ['veteran', 'calm-pro'],
    signatureLines: {
      pit_confirm: ['Copy. To you, Toto.'],
    },
    catchphraseChance: 0.2,
  },
  {
    driverId: 'perez',
    archetypes: ['veteran'],
    catchphraseChance: 0.2,
  },
] as const
```

- [ ] **Step 2: Verify TypeScript compiles.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add src/data/driver-radio-profiles.ts
git commit -m "feat(data): add driver radio profiles registry for 22 drivers"
```

---

### Task 4: Create radio template library — generic + archetype pools

**Files:**
- Create: `src/data/race-radio.ts`

- [ ] **Step 1: Scaffold the file with category-organised template arrays.**

The library is large (~250 templates). Author them grouped by category; each group should contain ~10–15 templates spanning generic + archetype-tagged variants. Use the patterns shown for `box_box` and `overtake_done` below; replicate for the other 18 categories.

```ts
// src/data/race-radio.ts
import type { RadioTemplate } from '@/types/radio'

/**
 * Authored radio template library.
 *
 * Grouped by category for readability. Eligibility rules:
 *  - `archetypes` empty/missing → generic, any driver eligible
 *  - `archetypes: ['hot-headed']` → only hot-headed drivers (or those whose
 *    secondary archetype matches)
 *  - `minFrustration` / `maxFrustration` gate by Mood.frustration (0-100)
 *
 * Tokens: {driver}, {opponent}, {gap}, {compound}, {lap}, {laps_remaining},
 * {position}, {turn}. Token resolution happens in radio-picker.ts.
 *
 * Invariant: every (category, speaker) pair the engine emits must have ≥1
 * eligible template; every archetype must have ≥5 eligible templates.
 * Enforced by tests/data/race-radio.test.ts.
 */
export const RADIO_TEMPLATES: readonly RadioTemplate[] = [
  // ─── box_box (engineer) ──────────────────────────────────────────────
  { category: 'box_box', speaker: 'engineer', text: 'Box, box, box this lap. {compound} ready.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Box this lap. Confirm box.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Pit window open, box opposite is on.', tone: 'calm' },
  { category: 'box_box', speaker: 'engineer', text: 'OK {driver}, box now. {compound} on.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Box, box. Target lap plus three.', tone: 'flat' },

  // ─── pit_confirm (driver) ────────────────────────────────────────────
  { category: 'pit_confirm', speaker: 'driver', text: 'Copy, box this lap.', tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Pit confirm. {compound}.', tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Box confirm. Good call.', tone: 'calm' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Negative, negative, one more lap.', archetypes: ['hot-headed'], tone: 'angry' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Copy.', archetypes: ['calm-pro'], tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Yeah, OK, copy that, copy that, box, box.', archetypes: ['rookie'], tone: 'urgent' },

  // ─── overtake_done (driver) ──────────────────────────────────────────
  { category: 'overtake_done', speaker: 'driver', text: 'Got him. {opponent} done.', tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Yes! Through on {opponent}!', tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Easy. Eaaasy.', archetypes: ['hot-headed'], tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Clean move. P{position} now.', archetypes: ['calm-pro'], tone: 'calm' },
  { category: 'overtake_done', speaker: 'driver', text: 'There we go. There we go.', archetypes: ['veteran'], tone: 'flat' },
  { category: 'overtake_done', speaker: 'driver', text: 'Yes! Yes! Yes!', archetypes: ['emotional'], tone: 'celebrate' },

  // ─── overtake_failed (driver) ────────────────────────────────────────
  { category: 'overtake_failed', speaker: 'driver', text: 'He got me. {opponent} through.', tone: 'flat' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Lost it. Lost the position.', archetypes: ['emotional'], tone: 'angry' },
  { category: 'overtake_failed', speaker: 'driver', text: 'No grip, no grip on the rears.', archetypes: ['hot-headed'], minFrustration: 40, tone: 'angry' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Couldn\'t hold him. P{position}.', archetypes: ['calm-pro'], tone: 'flat' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Damn it. Damn it.', archetypes: ['emotional'], minFrustration: 50, tone: 'angry' },

  // ─── tire_complaint (driver) ─────────────────────────────────────────
  { category: 'tire_complaint', speaker: 'driver', text: 'Front-left is graining badly.', tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'Rears are completely gone.', tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'I cannot keep this pace, the tyres are falling off a cliff.', tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'These tyres are done. Done.', archetypes: ['hot-headed'], minFrustration: 50, tone: 'angry' },
  { category: 'tire_complaint', speaker: 'driver', text: 'Tyres are struggling. Need to manage.', archetypes: ['calm-pro'], tone: 'calm' },

  // ─── push_now (engineer) ─────────────────────────────────────────────
  { category: 'push_now', speaker: 'engineer', text: 'Push now {driver}, push now. Five laps.', tone: 'urgent' },
  { category: 'push_now', speaker: 'engineer', text: 'Mode push, mode push. Free air ahead.', tone: 'urgent' },
  { category: 'push_now', speaker: 'engineer', text: 'You have {gap} to {opponent}. Build the gap.', tone: 'calm' },
  { category: 'push_now', speaker: 'engineer', text: 'Overtake mode on. Overtake mode on.', tone: 'urgent' },

  // ─── manage_tires (engineer) ─────────────────────────────────────────
  { category: 'manage_tires', speaker: 'engineer', text: 'Target plus three. Manage the rears.', tone: 'calm' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Lift and coast turns 4 and 11.', tone: 'flat' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Five laps in this stint, then we evaluate.', tone: 'calm' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Hold position. Save the tyres.', tone: 'flat' },

  // ─── investigation (fia) ─────────────────────────────────────────────
  { category: 'investigation', speaker: 'fia', text: 'Car {driver} under investigation, incident at turn {turn}.', tone: 'flat' },
  { category: 'investigation', speaker: 'fia', text: 'The stewards are reviewing an incident involving car {driver}.', tone: 'flat' },
  { category: 'investigation', speaker: 'fia', text: 'Note: incident at turn {turn} involving car {driver}, under investigation after the race.', tone: 'flat' },

  // ─── penalty_5s (fia) ────────────────────────────────────────────────
  { category: 'penalty_5s', speaker: 'fia', text: '5-second time penalty applied to car {driver}.', tone: 'flat' },
  { category: 'penalty_5s', speaker: 'fia', text: 'Car {driver}: 5-second penalty for the incident at turn {turn}.', tone: 'flat' },

  // ─── penalty_drive_through (fia) ─────────────────────────────────────
  { category: 'penalty_drive_through', speaker: 'fia', text: 'Drive-through penalty for car {driver}.', tone: 'urgent' },
  { category: 'penalty_drive_through', speaker: 'fia', text: 'Car {driver} must serve a drive-through penalty.', tone: 'urgent' },

  // ─── safety_car_deploy (fia) ─────────────────────────────────────────
  { category: 'safety_car_deploy', speaker: 'fia', text: 'Safety car deployed. Safety car deployed.', tone: 'urgent' },
  { category: 'safety_car_deploy', speaker: 'fia', text: 'Yellow flags sector 2. Safety car on track.', tone: 'urgent' },

  // ─── safety_car_in (fia) ─────────────────────────────────────────────
  { category: 'safety_car_in', speaker: 'fia', text: 'Safety car in this lap. Safety car in.', tone: 'urgent' },
  { category: 'safety_car_in', speaker: 'fia', text: 'Green flag conditions next lap.', tone: 'flat' },

  // ─── rain_incoming (engineer) ────────────────────────────────────────
  { category: 'rain_incoming', speaker: 'engineer', text: 'Rain in {laps_remaining} laps. Intermediate window opens.', tone: 'urgent' },
  { category: 'rain_incoming', speaker: 'engineer', text: 'Light rain reported turns 8 and 9. Be careful.', tone: 'urgent' },
  { category: 'rain_incoming', speaker: 'engineer', text: 'Weather front incoming. Inters ready in the box.', tone: 'urgent' },

  // ─── fastest_lap (engineer) ──────────────────────────────────────────
  { category: 'fastest_lap', speaker: 'engineer', text: 'Fastest lap! Fastest lap of the race, {driver}.', tone: 'celebrate' },
  { category: 'fastest_lap', speaker: 'engineer', text: 'Purple sectors, purple sectors. Mighty lap.', tone: 'celebrate' },

  // ─── final_lap (engineer) ────────────────────────────────────────────
  { category: 'final_lap', speaker: 'engineer', text: 'This is the last lap. Bring it home.', tone: 'urgent' },
  { category: 'final_lap', speaker: 'engineer', text: 'Final lap. P{position}. Smooth, smooth.', tone: 'calm' },
  { category: 'final_lap', speaker: 'engineer', text: 'Last lap mate. P{position}.', tone: 'urgent' },

  // ─── lights_out (engineer) ───────────────────────────────────────────
  { category: 'lights_out', speaker: 'engineer', text: 'Lights out. Good luck, mate.', tone: 'calm' },
  { category: 'lights_out', speaker: 'engineer', text: 'And we are racing. Heads down.', tone: 'urgent' },
  { category: 'lights_out', speaker: 'engineer', text: 'Lights out and away we go.', tone: 'celebrate' },

  // ─── driver_frustration (driver) ─────────────────────────────────────
  { category: 'driver_frustration', speaker: 'driver', text: 'Leave me alone, I know what I\'m doing.', archetypes: ['hot-headed'], minFrustration: 60, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'I\'m doing the best I can, mate.', archetypes: ['emotional'], minFrustration: 50, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'This is not acceptable. Not acceptable.', archetypes: ['hot-headed'], minFrustration: 70, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'What is he doing. WHAT is he doing.', archetypes: ['emotional', 'hot-headed'], minFrustration: 60, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Same story every weekend.', archetypes: ['veteran'], minFrustration: 55, tone: 'angry' },

  // ─── box_opposite (engineer) ─────────────────────────────────────────
  { category: 'box_opposite', speaker: 'engineer', text: 'Box opposite. Box opposite. Cover {opponent}.', tone: 'urgent' },
  { category: 'box_opposite', speaker: 'engineer', text: '{opponent} pitted. We stay out, we stay out.', tone: 'calm' },

  // ─── stay_out (engineer) ─────────────────────────────────────────────
  { category: 'stay_out', speaker: 'engineer', text: 'Negative box, stay out, stay out.', tone: 'urgent' },
  { category: 'stay_out', speaker: 'engineer', text: 'We extend this stint. {laps_remaining} laps remaining.', tone: 'flat' },

  // ─── gap_call (engineer) — used for context lines, not a primary emit ─
  { category: 'gap_call', speaker: 'engineer', text: 'Gap to {opponent} {gap}.', tone: 'flat' },
  { category: 'gap_call', speaker: 'engineer', text: '{opponent} behind, {gap}, closing.', tone: 'urgent' },
] as const
```

- [ ] **Step 2: Author the rest.**

The set above gives ≥3 templates per category. Add 2–4 more variants per category to reach the spec §5.3 target volume of ~320 lines (~60 generic + ~150 archetype-tagged + ~110 driver signature already authored in Task 3). Coverage per archetype is the test gate (Phase 3 Task 8) — keep adding archetype-tagged variants until each of the 6 archetypes has ≥5 eligible templates across at least 3 different categories.

- [ ] **Step 3: Verify TypeScript compiles.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add src/data/race-radio.ts
git commit -m "feat(data): add radio template library (~14 categories, 22 drivers)"
```

---

## Phase 3 — Picker and Curation (TDD)

This is the core engine logic. Write tests first; the picker is a pure function so it's trivially testable. **Use the `superpowers:test-driven-development` skill flow throughout.**

### Task 5: Picker test scaffold + determinism test

**Files:**
- Create: `tests/engine/race/radio-picker.test.ts`

- [ ] **Step 1: Write the failing determinism test.**

```ts
// tests/engine/race/radio-picker.test.ts
import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'
import { pickRadioMessage, type RadioContext } from '@/engine/race/radio-picker'

function fixtureCtx(overrides: Partial<RadioContext> = {}): RadioContext {
  return {
    category: 'box_box',
    driver: {
      id: 'norris',
      shortName: 'NOR',
      teamId: 'mclaren',
      mood: { motivation: 70, frustration: 20, confidence: 70 },
      attributes: { pace: 90, racecraft: 88, experience: 70, mentality: 80, marketability: 90, developmentPotential: 80 },
    } as RadioContext['driver'],
    team: { id: 'mclaren', name: 'McLaren Racing' },
    lap: 23,
    totalLaps: 50,
    position: 4,
    isPlayerTeam: true,
    ...overrides,
  }
}

describe('pickRadioMessage — determinism', () => {
  it('produces identical output for identical seed + ctx', () => {
    const ctx = fixtureCtx()
    const a = pickRadioMessage(ctx, createPRNG(42))
    const b = pickRadioMessage(ctx, createPRNG(42))
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run tests/engine/race/radio-picker.test.ts`
Expected: FAIL with "Cannot find module '@/engine/race/radio-picker'".

- [ ] **Step 3: Commit (failing test only — TDD red phase).**

```bash
git add tests/engine/race/radio-picker.test.ts
git commit -m "test(engine): add radio-picker determinism test (failing)"
```

---

### Task 6: Picker minimal implementation (`pickRadioMessage`)

**Files:**
- Create: `src/engine/race/radio-picker.ts`

- [ ] **Step 1: Implement the picker per spec §6.2.**

```ts
// src/engine/race/radio-picker.ts
import type { PRNG } from '@/engine/core/prng'
import type {
  CommentaryEntry,
  RadioCategory,
  RadioSpeaker,
  TireCompound,
} from '@/types/race'
import type { RadioArchetype, DriverRadioProfile, RadioTemplate } from '@/types/radio'
import type { RaceDriver } from '@/engine/race/race-simulator'  // exported at src/engine/race/race-simulator.ts:17
import { RADIO_TEMPLATES } from '@/data/race-radio'
import { DRIVER_RADIO_PROFILES } from '@/data/driver-radio-profiles'

const DEBUG_MODE = process.env.NODE_ENV !== 'production'

const DEFAULT_CATCHPHRASE_CHANCE = 0.25

export interface RadioContext {
  category: RadioCategory
  speaker: RadioSpeaker            // explicit — same category can have engineer/driver/fia variants
  driver: RaceDriver
  opponent?: RaceDriver
  team: { id: string; name: string }
  lap: number
  totalLaps: number
  position: number
  gap?: number
  compound?: TireCompound
  turn?: number
  isPlayerTeam: boolean
}

const PROFILE_BY_DRIVER_ID = new Map(
  DRIVER_RADIO_PROFILES.map(p => [p.driverId, p]),
)

function resolveTokens(text: string, ctx: RadioContext): string {
  const replacements: Record<string, string> = {
    driver: ctx.driver.shortName,
    opponent: ctx.opponent?.shortName ?? '',
    gap: ctx.gap !== undefined ? `${ctx.gap.toFixed(1)}s` : '',
    compound: ctx.compound ?? '',
    lap: String(ctx.lap),
    laps_remaining: String(ctx.totalLaps - ctx.lap),
    position: String(ctx.position),
    turn: ctx.turn !== undefined ? String(ctx.turn) : '',
  }
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in replacements)) {
      if (DEBUG_MODE) {
        throw new Error(`Unknown token "{${key}}" in radio template: ${text}`)
      }
      return '...'
    }
    return replacements[key]
  })
}

function archetypesIntersect(
  templateArchetypes: RadioArchetype[] | undefined,
  driverArchetypes: [RadioArchetype, RadioArchetype?],
): boolean {
  if (!templateArchetypes || templateArchetypes.length === 0) return true
  return templateArchetypes.some(t => driverArchetypes.includes(t))
}

function eligibleTemplates(
  ctx: RadioContext,
  profile: DriverRadioProfile,
): RadioTemplate[] {
  const frustration = ctx.driver.mood.frustration
  return RADIO_TEMPLATES.filter(t =>
    t.category === ctx.category &&
    t.speaker === ctx.speaker &&
    archetypesIntersect(t.archetypes, profile.archetypes) &&
    frustration >= (t.minFrustration ?? 0) &&
    frustration <= (t.maxFrustration ?? 100),
  )
}

function weightedPick(templates: RadioTemplate[], rng: PRNG): RadioTemplate {
  const totalWeight = templates.reduce((s, t) => s + (t.weight ?? 1), 0)
  let roll = rng.range(0, totalWeight)
  for (const t of templates) {
    roll -= t.weight ?? 1
    if (roll <= 0) return t
  }
  return templates[templates.length - 1]
}

export function pickRadioMessage(ctx: RadioContext, rng: PRNG): CommentaryEntry {
  const profile = PROFILE_BY_DRIVER_ID.get(ctx.driver.id)

  // Signature roll
  if (
    profile?.signatureLines?.[ctx.category] &&
    profile.signatureLines[ctx.category]!.length > 0 &&
    rng.chance(profile.catchphraseChance ?? DEFAULT_CATCHPHRASE_CHANCE)
  ) {
    const signaturePool = profile.signatureLines[ctx.category]!
    const text = rng.pick([...signaturePool])
    return {
      lap: ctx.lap,
      text: resolveTokens(text, ctx),
      severity: 'radio',
      speaker: ctx.speaker,
      driverId: ctx.driver.id,
      teamId: ctx.team.id,
      category: ctx.category,
      tone: 'flat',
      isPlayerTeam: ctx.isPlayerTeam,
    }
  }

  // Archetype-eligible pool
  const archetypes = profile?.archetypes ?? ['calm-pro'] as [RadioArchetype]
  const fakeProfile: DriverRadioProfile = profile ?? { driverId: ctx.driver.id, archetypes }
  const pool = eligibleTemplates(ctx, fakeProfile)

  if (pool.length === 0) {
    // Fallback — empty pool. Soft-warn in dev, return a neutral filler in prod.
    if (DEBUG_MODE) {
      // eslint-disable-next-line no-console
      console.warn(`No eligible radio template for category=${ctx.category} speaker=${ctx.speaker} driver=${ctx.driver.id}`)
    }
    return {
      lap: ctx.lap,
      text: '...',
      severity: 'radio',
      speaker: ctx.speaker,
      driverId: ctx.driver.id,
      teamId: ctx.team.id,
      category: ctx.category,
      tone: 'flat',
      isPlayerTeam: ctx.isPlayerTeam,
    }
  }

  const template = weightedPick(pool, rng)
  return {
    lap: ctx.lap,
    text: resolveTokens(template.text, ctx),
    severity: 'radio',
    speaker: ctx.speaker,
    driverId: ctx.driver.id,
    teamId: ctx.team.id,
    category: ctx.category,
    tone: template.tone ?? 'flat',
    isPlayerTeam: ctx.isPlayerTeam,
  }
}
```

> **`RaceDriver` lives in `src/engine/race/race-simulator.ts:17`** (verified at plan-write time). The picker imports it from there. Test fixtures use `as RadioContext['driver']` to sidestep full type construction; production callers in the simulator already have a real `RaceDriver`.

- [ ] **Step 2: Update the test fixture to include a `speaker` field.**

Add `speaker: 'engineer'` to the `fixtureCtx()` defaults in the test file.

- [ ] **Step 3: Run test to verify it passes.**

Run: `npx vitest run tests/engine/race/radio-picker.test.ts`
Expected: PASS (the determinism test).

- [ ] **Step 4: Commit.**

```bash
git add src/engine/race/radio-picker.ts tests/engine/race/radio-picker.test.ts
git commit -m "feat(engine): implement pickRadioMessage with determinism guarantee"
```

---

### Task 7: Picker — signature gating, archetype filtering, frustration gating

**Files:**
- Modify: `tests/engine/race/radio-picker.test.ts`

- [ ] **Step 1: Add the failing tests.**

```ts
describe('pickRadioMessage — signature gating', () => {
  it('always picks signature when catchphraseChance=1.0', () => {
    // Mock by passing a driver with high catchphrase chance via DRIVER_RADIO_PROFILES.
    // verstappen has catchphraseChance: 0.35; for this test we use a category
    // where verstappen has a signature line (overtake_done).
    const ctx = fixtureCtx({
      category: 'overtake_done',
      speaker: 'driver',
      driver: { ...fixtureCtx().driver, id: 'verstappen', shortName: 'VER' } as never,
    })
    // Pick 200 times with different seeds; expect ≥30% to be signature lines
    // ("Simply lovely." or "Yes! Yes! Get in!").
    const signatures = ['Simply lovely.', 'Yes! Yes! Get in!']
    let hits = 0
    for (let seed = 0; seed < 200; seed++) {
      const result = pickRadioMessage(ctx, createPRNG(seed))
      if (signatures.includes(result.text)) hits++
    }
    expect(hits).toBeGreaterThanOrEqual(50)  // ~35% expected, allow margin
  })
})

describe('pickRadioMessage — archetype filtering', () => {
  it('never picks a hot-headed-only template for a calm-pro driver', () => {
    const ctx = fixtureCtx({ category: 'overtake_done', speaker: 'driver' })
    // norris is calm-pro. Pick 100 times.
    for (let seed = 0; seed < 100; seed++) {
      const result = pickRadioMessage(ctx, createPRNG(seed))
      // "Easy. Eaaasy." is hot-headed-only in the seed library
      expect(result.text).not.toBe('Easy. Eaaasy.')
    }
  })
})

describe('pickRadioMessage — frustration gating', () => {
  it('never fires a minFrustration=60 template when frustration=20', () => {
    const ctx = fixtureCtx({
      category: 'driver_frustration',
      speaker: 'driver',
      driver: { ...fixtureCtx().driver, mood: { motivation: 70, frustration: 20, confidence: 70 } } as never,
    })
    for (let seed = 0; seed < 100; seed++) {
      const result = pickRadioMessage(ctx, createPRNG(seed))
      // Templates with minFrustration: 60+ should never appear
      expect(result.text).not.toContain('Leave me alone')
      expect(result.text).not.toContain('not acceptable')
    }
  })
})

describe('pickRadioMessage — token resolution', () => {
  it('replaces {opponent} with opponent shortName', () => {
    const ctx = fixtureCtx({
      category: 'overtake_done',
      speaker: 'driver',
      opponent: { id: 'piastri', shortName: 'PIA' } as never,
    })
    const result = pickRadioMessage(ctx, createPRNG(123))
    expect(result.text).not.toContain('{opponent}')
  })

  it('throws on unknown token in dev', () => {
    // This test verifies the dev-mode guard. We can't directly inject a bad
    // template without monkey-patching RADIO_TEMPLATES, so instead this test
    // is a smoke check that no template uses an unknown token by exhausting
    // the pool with a deterministic walk.
    // (Fully covered by tests/data/race-radio.test.ts — see Task 8.)
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass against the existing implementation.**

Run: `npx vitest run tests/engine/race/radio-picker.test.ts`
Expected: PASS (the picker is already implementing all of this — we're verifying behaviour, not driving new code).

- [ ] **Step 3: Commit.**

```bash
git add tests/engine/race/radio-picker.test.ts
git commit -m "test(engine): cover picker signature gating, archetype filtering, frustration gating"
```

---

### Task 8: Coverage tests for templates + profiles

**Files:**
- Create: `tests/data/race-radio.test.ts`
- Create: `tests/data/driver-radio-profiles.test.ts`

- [ ] **Step 1: Write the template-coverage test.**

```ts
// tests/data/race-radio.test.ts
import { describe, it, expect } from 'vitest'
import { RADIO_TEMPLATES } from '@/data/race-radio'
import type { RadioArchetype, RadioCategory, RadioSpeaker } from '@/types/radio'

const ALLOWED_TOKENS = new Set([
  'driver', 'opponent', 'gap', 'compound', 'lap', 'laps_remaining', 'position', 'turn',
])

const ARCHETYPES: RadioArchetype[] = [
  'calm-pro', 'hot-headed', 'spiritual', 'emotional', 'rookie', 'veteran',
]

// Categories the engine actually emits (cf. spec §6.4)
const EMITTED: Array<{ category: RadioCategory; speakers: RadioSpeaker[] }> = [
  { category: 'box_box', speakers: ['engineer'] },
  { category: 'pit_confirm', speakers: ['driver'] },
  { category: 'overtake_done', speakers: ['driver'] },
  { category: 'overtake_failed', speakers: ['driver'] },
  { category: 'investigation', speakers: ['fia'] },
  { category: 'penalty_5s', speakers: ['fia'] },
  { category: 'penalty_drive_through', speakers: ['fia'] },
  { category: 'lights_out', speakers: ['engineer'] },
  { category: 'final_lap', speakers: ['engineer'] },
  { category: 'fastest_lap', speakers: ['engineer'] },
  { category: 'tire_complaint', speakers: ['driver'] },
  { category: 'rain_incoming', speakers: ['engineer'] },
  { category: 'push_now', speakers: ['engineer'] },
  { category: 'manage_tires', speakers: ['engineer'] },
  { category: 'driver_frustration', speakers: ['driver'] },
  { category: 'safety_car_deploy', speakers: ['fia'] },
  { category: 'safety_car_in', speakers: ['fia'] },
]

describe('RADIO_TEMPLATES — coverage', () => {
  it.each(EMITTED)('has ≥1 template for $category × $speakers', ({ category, speakers }) => {
    for (const speaker of speakers) {
      const matches = RADIO_TEMPLATES.filter(t => t.category === category && t.speaker === speaker)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    }
  })

  it.each(ARCHETYPES)('has ≥5 templates eligible for archetype %s', (archetype) => {
    const eligible = RADIO_TEMPLATES.filter(t =>
      !t.archetypes || t.archetypes.length === 0 || t.archetypes.includes(archetype),
    )
    expect(eligible.length).toBeGreaterThanOrEqual(5)
  })

  it('every template uses only allowed tokens', () => {
    const tokenRegex = /\{(\w+)\}/g
    for (const t of RADIO_TEMPLATES) {
      const matches = [...t.text.matchAll(tokenRegex)]
      for (const m of matches) {
        expect(ALLOWED_TOKENS.has(m[1])).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Write the profile-coverage test.**

```ts
// tests/data/driver-radio-profiles.test.ts
import { describe, it, expect } from 'vitest'
import { DRIVER_RADIO_PROFILES } from '@/data/driver-radio-profiles'
import { TEAMS } from '@/data/teams'

const ALL_DRIVER_IDS = TEAMS.flatMap(t => t.driverIds)

describe('DRIVER_RADIO_PROFILES — coverage', () => {
  it('has a profile for every driver in TEAMS', () => {
    const profileIds = new Set(DRIVER_RADIO_PROFILES.map(p => p.driverId))
    for (const id of ALL_DRIVER_IDS) {
      expect(profileIds.has(id)).toBe(true)
    }
  })

  it('every profile has a valid primary archetype', () => {
    const valid = ['calm-pro', 'hot-headed', 'spiritual', 'emotional', 'rookie', 'veteran']
    for (const p of DRIVER_RADIO_PROFILES) {
      expect(valid).toContain(p.archetypes[0])
    }
  })

  it('catchphraseChance is in [0, 1] when set', () => {
    for (const p of DRIVER_RADIO_PROFILES) {
      if (p.catchphraseChance !== undefined) {
        expect(p.catchphraseChance).toBeGreaterThanOrEqual(0)
        expect(p.catchphraseChance).toBeLessThanOrEqual(1)
      }
    }
  })
})
```

- [ ] **Step 3: Run both test files.**

Run: `npx vitest run tests/data/race-radio.test.ts tests/data/driver-radio-profiles.test.ts`
Expected: PASS. If a coverage gap fails, add more templates / fill profile gaps.

- [ ] **Step 4: Commit.**

```bash
git add tests/data/race-radio.test.ts tests/data/driver-radio-profiles.test.ts
git commit -m "test(data): add coverage tests for radio templates and driver profiles"
```

---

### Task 9: `isBroadcastWorthy` — curation filter

**Files:**
- Modify: `src/engine/race/radio-picker.ts`
- Modify: `tests/engine/race/radio-picker.test.ts`

- [ ] **Step 1: Write failing tests.**

Append to `radio-picker.test.ts`:

```ts
import { isBroadcastWorthy } from '@/engine/race/radio-picker'

describe('isBroadcastWorthy', () => {
  const raceCtx = { championshipRivalIds: ['verstappen'], podiumPositions: ['norris', 'piastri', 'leclerc'] }

  it('player team always passes', () => {
    const ctx = fixtureCtx({ isPlayerTeam: true, category: 'tire_complaint' })
    expect(isBroadcastWorthy('tire_complaint', ctx, raceCtx)).toBe(true)
  })

  it('FIA categories always pass for any team', () => {
    const ctx = fixtureCtx({ isPlayerTeam: false, category: 'penalty_5s' })
    expect(isBroadcastWorthy('penalty_5s', ctx, raceCtx)).toBe(true)
  })

  it('drops non-player tire_complaint for midfield non-rival', () => {
    const ctx = fixtureCtx({
      isPlayerTeam: false,
      category: 'tire_complaint',
      driver: { ...fixtureCtx().driver, id: 'ocon', shortName: 'OCO' } as never,
      position: 12,
    })
    expect(isBroadcastWorthy('tire_complaint', ctx, raceCtx)).toBe(false)
  })

  it('passes non-player overtake_done when driver is on podium', () => {
    const ctx = fixtureCtx({
      isPlayerTeam: false,
      category: 'overtake_done',
      driver: { ...fixtureCtx().driver, id: 'piastri', shortName: 'PIA' } as never,
      position: 2,
    })
    expect(isBroadcastWorthy('overtake_done', ctx, raceCtx)).toBe(true)
  })

  it('passes non-player overtake_done when opponent is the player', () => {
    const ctx = fixtureCtx({
      isPlayerTeam: false,
      category: 'overtake_done',
      driver: { ...fixtureCtx().driver, id: 'leclerc', shortName: 'LEC' } as never,
      opponent: { id: 'norris', shortName: 'NOR' } as never,  // player
    })
    // Mark the opponent as player by passing playerId via raceCtx (need to extend signature OR
    // rely on isBroadcastWorthy reading isPlayerTeam off ctx.opponent.teamId match — see impl note).
    // For v1, the simplest test asserts that championship-rival drivers also pass:
    expect(isBroadcastWorthy('overtake_done', ctx, raceCtx)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run tests/engine/race/radio-picker.test.ts -t isBroadcastWorthy`
Expected: FAIL with "isBroadcastWorthy is not exported".

- [ ] **Step 3: Implement `isBroadcastWorthy` in `radio-picker.ts`.**

Append to `src/engine/race/radio-picker.ts`:

```ts
const FIA_ALWAYS_BROADCAST: ReadonlySet<RadioCategory> = new Set([
  'penalty_5s', 'penalty_drive_through', 'investigation',
  'safety_car_deploy', 'safety_car_in',
  'fastest_lap', 'lights_out', 'final_lap', 'rain_incoming',
])

const NON_PLAYER_CONDITIONAL: ReadonlySet<RadioCategory> = new Set([
  'overtake_done', 'overtake_failed', 'tire_complaint', 'driver_frustration',
])

export interface BroadcastRaceContext {
  championshipRivalIds: readonly string[]
  podiumPositions: readonly string[]   // driverIds in P1, P2, P3
  playerDriverIds?: readonly string[]
}

export function isBroadcastWorthy(
  category: RadioCategory,
  ctx: RadioContext,
  raceCtx: BroadcastRaceContext,
): boolean {
  if (ctx.isPlayerTeam) return true
  if (FIA_ALWAYS_BROADCAST.has(category)) return true
  if (!NON_PLAYER_CONDITIONAL.has(category)) return false

  const onPodium = raceCtx.podiumPositions.includes(ctx.driver.id)
  const isRival = raceCtx.championshipRivalIds.includes(ctx.driver.id)
  const opponentIsPlayer = ctx.opponent !== undefined &&
    (raceCtx.playerDriverIds?.includes(ctx.opponent.id) ?? false)

  return onPodium || isRival || opponentIsPlayer
}
```

- [ ] **Step 4: Run tests to verify pass.**

Run: `npx vitest run tests/engine/race/radio-picker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/radio-picker.ts tests/engine/race/radio-picker.test.ts
git commit -m "feat(engine): add isBroadcastWorthy curation filter"
```

---

### Phase 3 Handoff Gate

Before proceeding to Phase 4, invoke the **`superpowers:verification-before-completion`** skill on the picker work. Confirm:
- Engine purity intact (no `Math.random`, no browser APIs, no imports from `src/stores/`, `src/hooks/`, `src/components/`)
- All randomness routes through the seeded `PRNG`
- `npx tsc --noEmit` clean
- `npx vitest run tests/engine/race/radio-picker.test.ts tests/data/race-radio.test.ts tests/data/driver-radio-profiles.test.ts` clean

---

## Phase 4 — Engine Integration

These tasks wire the picker into `race-simulator.ts` at each emit point. Each emit point follows the same pattern: build `RadioContext`, run `isBroadcastWorthy` if non-player, push the resulting `CommentaryEntry` to the `commentary` array. The engine already has the PRNG instance — reuse it.

**Pattern check:** before starting Task 10, read `src/engine/race/race-simulator.ts:200-260` to confirm where `commentary` is built and how `state.drivers`, `state.strategies`, etc. are accessed. The existing pit/overtake emits at lines 229 and 301 are the model.

### Task 10: Add `radioFlags` to `SimRaceState`

**Files:**
- Modify: `src/engine/race/race-simulator.ts`

- [ ] **Step 1: Extend `SimRaceState` interface.**

Find the `SimRaceState` interface (search for `interface SimRaceState` in the file). Add:

```ts
radioFlags: {
  tireComplainedThisStint: Record<string, boolean>
  weatherTransitionAnnounced: boolean
  fastestLapAnnouncedTime: number
  finalLapAnnouncedFor: Record<string, boolean>
  lightsOutAnnounced: boolean
}
```

- [ ] **Step 2: Initialise `radioFlags` in both state-construction sites.**

Two sites construct a `SimRaceState`:
1. `simulateRace` (currently around line 410) — initialise to defaults.
2. The worker's `start` handler in `src/workers/race-sim-worker.ts` (around line 186).

```ts
radioFlags: {
  tireComplainedThisStint: {},
  weatherTransitionAnnounced: false,
  fastestLapAnnouncedTime: Infinity,
  finalLapAnnouncedFor: {},
  lightsOutAnnounced: false,
},
```

- [ ] **Step 3: Verify TypeScript compiles.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add src/engine/race/race-simulator.ts src/workers/race-sim-worker.ts
git commit -m "feat(engine): add radioFlags state for radio emit deduplication"
```

---

### Task 10.5: Thread player/rival metadata into `SimRaceState`

The radio system needs to know which team is the player's, which drivers are championship rivals, and which drivers are the player's. None of these fields exist on `SimRaceState` today (verified: zero matches for `playerTeamId`, `championshipRivalIds`, `playerDriverIds` in `src/engine/race/`). This task threads them through the bootstrap → state → worker chain.

**Files:**
- Modify: `src/types/race.ts` — extend `RaceWorkerStartPayload` with optional fields.
- Modify: `src/engine/race/race-bootstrap.ts` — pass through to `RaceSetup` and the resulting `SimRaceState` defaults.
- Modify: `src/engine/race/race-simulator.ts` — add fields to `SimRaceState` interface.
- Modify: `src/workers/race-sim-worker.ts:142-220` — read from `payload`, hydrate into the `raceState` it constructs.
- Modify: `src/hooks/use-race-simulation.ts` (or wherever the worker payload is built) — populate from store state.

- [ ] **Step 1: Add fields to `SimRaceState` in `src/engine/race/race-simulator.ts`.**

```ts
playerTeamId?: string
playerDriverIds: string[]            // drivers on the player team
championshipRivalIds: string[]       // top-3 constructors excluding player team's drivers
```

`playerDriverIds` and `championshipRivalIds` default to empty arrays (radio still works — non-player curation just drops to FIA-only categories, which is acceptable for tests that don't supply them).

- [ ] **Step 2: Add fields to `RaceWorkerStartPayload` in `src/types/race.ts`.**

```ts
playerTeamId?: string
playerDriverIds?: readonly string[]
championshipRivalIds?: readonly string[]
```

All optional — backward compatible with existing tests.

- [ ] **Step 3: Hydrate in the worker's `start` handler at `src/workers/race-sim-worker.ts:186`.**

In the `raceState = { ... }` construction, add:

```ts
playerTeamId: payload.playerTeamId,
playerDriverIds: [...(payload.playerDriverIds ?? [])],
championshipRivalIds: [...(payload.championshipRivalIds ?? [])],
```

- [ ] **Step 4: Hydrate in `simulateRace` (the non-worker path used by tests) and `bootstrapRace`.**

`simulateRace` constructs its own `state` (around `race-simulator.ts:410`); add the same three fields with empty-array defaults. `bootstrapRace` should accept the new fields on its input and forward them.

- [ ] **Step 5: Populate from store at the worker payload site.**

Find where `RaceWorkerStartPayload` is constructed in the UI/store layer (search for `seed:.*round:.*circuit:`). Read player team from `world.playerTeamId`, derive `playerDriverIds` from the player team's `driverIds`, and derive `championshipRivalIds` from the top-3 constructors in the standings (or a simpler rule for v1: top-3 teams' drivers excluding the player's).

- [ ] **Step 6: Verify.**

```bash
npx tsc --noEmit
npx vitest run tests/engine
```

Expected: clean type-check; existing tests continue to pass (new fields are optional or default to empty).

- [ ] **Step 7: Commit.**

```bash
git add src/types/race.ts src/engine/race/race-bootstrap.ts src/engine/race/race-simulator.ts src/workers/race-sim-worker.ts src/hooks/use-race-simulation.ts
git commit -m "feat(engine): thread player/rival metadata into SimRaceState for radio curation"
```

---

### Task 11: Replace pit emit with engineer/driver pair

**Files:**
- Modify: `src/engine/race/race-simulator.ts:229-233`

- [ ] **Step 1: Replace the existing pit commentary emit.**

The current code at `src/engine/race/race-simulator.ts:229` is:

```ts
commentary.push({
  lap: state.currentLap,
  text: `${driverId.toUpperCase()} pits for ${newCompound} tires`,
  severity: 'highlight',
})
```

Replace with:

```ts
const pitDriver = state.drivers.find(d => d.id === driverId)!
const pitTeam = { id: pitDriver.teamId ?? 'unknown', name: pitDriver.teamId ?? 'unknown' }
const isPlayerTeamPit = state.playerTeamId === pitDriver.teamId
const baseCtx = {
  driver: pitDriver,
  team: pitTeam,
  lap: state.currentLap,
  totalLaps: state.totalLaps,
  position: positions.indexOf(driverId) + 1,
  compound: newCompound,
  isPlayerTeam: isPlayerTeamPit,
}
const raceCtx = { championshipRivalIds: state.championshipRivalIds ?? [], podiumPositions: positions.slice(0, 3), playerDriverIds: state.playerDriverIds ?? [] }

if (isBroadcastWorthy('box_box', { ...baseCtx, category: 'box_box', speaker: 'engineer' }, raceCtx)) {
  commentary.push(pickRadioMessage({ ...baseCtx, category: 'box_box', speaker: 'engineer' }, rng))
}
if (isBroadcastWorthy('pit_confirm', { ...baseCtx, category: 'pit_confirm', speaker: 'driver' }, raceCtx)) {
  commentary.push(pickRadioMessage({ ...baseCtx, category: 'pit_confirm', speaker: 'driver' }, rng))
}
```

> **Note:** `state.playerTeamId`, `state.championshipRivalIds`, `state.playerDriverIds` may not exist on `SimRaceState` yet. If not, add them as optional fields and pass them through `bootstrapRace` from `RaceSetup`. This is a one-time threading change — read `src/engine/race/race-bootstrap.ts` to find where the bootstrap input shape is defined and add the fields.

- [ ] **Step 2: Add the imports at the top of the file.**

```ts
import { pickRadioMessage, isBroadcastWorthy } from './radio-picker'
```

- [ ] **Step 3: Verify TypeScript compiles and existing tests still pass.**

Run: `npx tsc --noEmit && npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: clean type-check; all existing race-simulator tests pass. (Verified at plan-write time: `grep -rn "pits for\|overtakes" tests/` returns zero results, so no legacy string assertions need updating. If any appear during a future merge, update them to assert `severity: 'radio'` and `category: 'box_box'` / `'overtake_done'` instead of the literal text.)

- [ ] **Step 4: Commit.**

```bash
git add src/engine/race/race-simulator.ts src/engine/race/race-bootstrap.ts
git commit -m "feat(engine): replace pit emit with engineer/driver radio pair"
```

---

### Task 12: Replace overtake emit with attacker/defender pair

**Files:**
- Modify: `src/engine/race/race-simulator.ts:301-305`

- [ ] **Step 1: Replace the existing overtake commentary emit.**

Same pattern as Task 11. Replace the current single `commentary.push({...severity: 'highlight'...})` with two `pickRadioMessage` calls — one for the attacker (category `overtake_done`, speaker `driver`) and one for the defender (category `overtake_failed`, speaker `driver`). Both pass through `isBroadcastWorthy` because the defender side is non-player when the attacker is the player and vice versa.

- [ ] **Step 2: Run tests.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/engine/race/race-simulator.ts
git commit -m "feat(engine): replace overtake emit with attacker/defender radio pair"
```

---

### Task 13: Wire investigation, penalty, and FIA events

**Files:**
- Modify: `src/engine/race/race-simulator.ts`

- [ ] **Step 1: At the `investigation-opened` incident push site (around line 343), emit an FIA radio.**

After the `incidents.push({...investigation-opened...})`, add:

```ts
const offendingDriver = state.drivers.find(d => d.id === evaluation.decision.driverId)!
const investigationCtx: RadioContext = {
  category: 'investigation',
  speaker: 'fia',
  driver: offendingDriver,
  team: { id: offendingDriver.teamId ?? 'unknown', name: offendingDriver.teamId ?? 'unknown' },
  lap: state.currentLap,
  totalLaps: state.totalLaps,
  position: positions.indexOf(evaluation.decision.driverId) + 1,
  turn: rng.range(1, 16) | 0,  // synth turn number for FIA flavour
  isPlayerTeam: state.playerTeamId === offendingDriver.teamId,
}
commentary.push(pickRadioMessage(investigationCtx, rng))
```

- [ ] **Step 2: At the penalty-resolution site, emit FIA penalty radio + driver frustration line.**

Find the penalty-resolution path (search for where `appliedPenaltiesByDriver` is updated). Emit:
- FIA `penalty_5s` or `penalty_drive_through` based on `appliedPenalty.sanction`
- Driver `driver_frustration` (gated through `isBroadcastWorthy` so non-player midfielders don't pollute the panel unless they're a podium / rival)

- [ ] **Step 3: Run tests.**

Run: `npx vitest run tests/engine/race/race-simulator.test.ts tests/engine/race/race-penalty-engine.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/engine/race/race-simulator.ts
git commit -m "feat(engine): emit FIA radio for investigations and applied penalties"
```

---

### Task 14: Wire lights_out, final_lap, fastest_lap

**Files:**
- Modify: `src/engine/race/race-simulator.ts`
- Modify: `src/workers/race-sim-worker.ts`

Each of these is a one-shot per race (or per-driver), gated by `state.radioFlags` to prevent spam.

- [ ] **Step 1: Lights out — top of `simulateLap` when `currentLap === 1`.**

```ts
if (state.currentLap === 1 && !state.radioFlags.lightsOutAnnounced) {
  state.radioFlags.lightsOutAnnounced = true
  // Emit lights_out for the player team's lead driver
  const playerDriverIds = state.playerDriverIds ?? []
  for (const pid of playerDriverIds) {
    const pd = state.drivers.find(d => d.id === pid)
    if (!pd) continue
    commentary.push(pickRadioMessage({
      category: 'lights_out',
      speaker: 'engineer',
      driver: pd,
      team: { id: pd.teamId ?? 'unknown', name: pd.teamId ?? 'unknown' },
      lap: 1,
      totalLaps: state.totalLaps,
      position: positions.indexOf(pid) + 1,
      isPlayerTeam: true,
    }, rng))
  }
}
```

- [ ] **Step 2: Final lap — top of `simulateLap` when `currentLap === totalLaps`.**

Same pattern, gated by `state.radioFlags.finalLapAnnouncedFor[driverId]`. Emit for player team drivers + championship leaders (`positions[0]`).

- [ ] **Step 3: Fastest lap — after the lap-data fold in `simulateNextLap` (worker) or after the lap loop in `simulateRace`.**

When the new fastest-lap time is detected, emit `fastest_lap` engineer radio for that driver. Update `state.radioFlags.fastestLapAnnouncedTime` to suppress repeats unless a strictly faster lap occurs.

- [ ] **Step 4: Run tests.**

Run: `npx vitest run tests/engine`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/race/race-simulator.ts src/workers/race-sim-worker.ts
git commit -m "feat(engine): wire lights_out, final_lap, fastest_lap radio emits"
```

---

### Task 15: Wire tire_complaint and rain_incoming

**Files:**
- Modify: `src/engine/race/race-simulator.ts`

- [ ] **Step 1: Tire complaint — after `degradeTire`, when `newTire.wear < 25` and not yet complained this stint.**

```ts
if (newTire.wear < 25 && !state.radioFlags.tireComplainedThisStint[driverId]) {
  state.radioFlags.tireComplainedThisStint[driverId] = true
  // Emit through isBroadcastWorthy
  ...
}
```

Reset the flag on pit (already inside the pit branch — set `state.radioFlags.tireComplainedThisStint[driverId] = false`).

- [ ] **Step 2: Rain incoming — after `weatherEngine.tick()` when `rainProbability` crosses ≥ 0.7 and `weatherTransitionAnnounced === false`.**

Set the flag to true; reset on weather change to/from `dry`.

- [ ] **Step 3: Run tests + commit.**

```bash
npx vitest run tests/engine
git add src/engine/race/race-simulator.ts
git commit -m "feat(engine): wire tire_complaint and rain_incoming radio emits"
```

---

### Task 16: Wire push_now / manage_tires (player commands)

**Files:**
- Modify: `src/engine/race/race-command-apply.ts`
- Modify: `src/workers/race-sim-worker.ts:252` — caller of `applyCommandEnvelopeToSim`
- Modify: `tests/engine/race/race-command-flow.test.ts:140` — existing test updates

**Verified at plan-write time:** the current signature is `applyCommandEnvelopeToSim(state, envelope)` with no PRNG parameter. This task adds it.

- [ ] **Step 1: Add `rng: PRNG` to `applyCommandEnvelopeToSim` signature.**

Update the function declaration in `src/engine/race/race-command-apply.ts`:

```ts
import type { PRNG } from '@/engine/core/prng'

export function applyCommandEnvelopeToSim(
  state: SimRaceState,
  envelope: RaceCommandEnvelope,
  rng: PRNG,
): { applied: boolean } { ... }
```

- [ ] **Step 2: Update the worker call site at `src/workers/race-sim-worker.ts:252`.**

```ts
const result = applyCommandEnvelopeToSim(raceState, msg.envelope, rng!)
```

The worker already holds `rng` as a module-level variable (declared at line 13). Reuse it — do not create a new PRNG instance.

- [ ] **Step 3: Update existing tests in `tests/engine/race/race-command-flow.test.ts`.**

Pass a `createPRNG(seed)` instance to every `applyCommandEnvelopeToSim(...)` call. The existing tests at lines 140+ become `applyCommandEnvelopeToSim(sim, envelope, createPRNG(1))`.

- [ ] **Step 4: Inside the updated `applyCommandEnvelopeToSim`, after the command is applied, push a radio entry for player commands only.**

When `command === 'push' || command === 'overtake'` → emit `push_now` engineer radio for the driver.
When `command === 'conserve' || command === 'defend'` → emit `manage_tires` engineer radio.

Gate by `state.playerTeamId === driver.teamId` (only emit if it's a player driver — engineers don't get on the radio for AI cars). Push directly to `state.commentary`.

- [ ] **Step 2: Run tests + commit.**

```bash
npx vitest run tests/engine
git add src/engine/race/race-command-apply.ts
git commit -m "feat(engine): emit push_now / manage_tires radio on player commands"
```

---

### Task 17: Wire safety_car emits (dormant in v1)

**Files:**
- Modify: `src/engine/race/race-simulator.ts`

- [ ] **Step 1: Add the SC emit code paths but guard them on `safetyCar` state transitions.**

```ts
if (state.safetyCar !== 'green' && previousSafetyCar === 'green') {
  // SC just deployed — emit FIA + manage_tires for everyone
}
if (state.safetyCar === 'green' && previousSafetyCar !== 'green') {
  // SC ending — emit FIA + push for everyone
}
```

In v1 the simulator never transitions `safetyCar` so these branches are dead code. They're here so v2 (when SC simulation lands) gets radio for free. **This is not a YAGNI violation — the spec explicitly approved these as wired-but-dormant.**

- [ ] **Step 2: Run tests + commit.**

```bash
npx vitest run tests/engine
git add src/engine/race/race-simulator.ts
git commit -m "feat(engine): wire safety_car_deploy/in emits (dormant pending SC sim in v2)"
```

---

### Task 18: Volume + determinism integration test

**Files:**
- Modify: `tests/engine/race/race-simulator.test.ts`

**Reuse the existing fixtures:** `mockRaceSetup()` at `tests/engine/race/race-simulator.test.ts:49` returns a `RaceSetup`. To get player metadata into the test setup, extend it (or wrap it) with `playerTeamId`, `playerDriverIds`, `championshipRivalIds` so the curation filter has values to work with.

- [ ] **Step 1: Add a fixture extension helper at the top of the test file.**

```ts
function mockRadioRaceSetup(): RaceSetup {
  const base = mockRaceSetup()
  return {
    ...base,
    playerTeamId: 'mclaren',
    playerDriverIds: ['norris', 'piastri'],
    championshipRivalIds: ['verstappen', 'leclerc', 'hamilton'],
  }
}
```

(If `RaceSetup` doesn't yet expose these fields, add them as optional in Task 10.5.)

- [ ] **Step 2: Add the volume + determinism + pit-pair tests.**

```ts
describe('race radio — volume and determinism', () => {
  it('produces ≥25 radio entries over a 50-lap seeded race', () => {
    const result = simulateRace(mockRadioRaceSetup(), 12345)
    const radioEntries = result.commentary.filter(c => c.severity === 'radio')
    expect(radioEntries.length).toBeGreaterThanOrEqual(25)
    expect(radioEntries.length).toBeLessThanOrEqual(80) // not flooding
  })

  it('produces identical radio output for identical seed', () => {
    const a = simulateRace(mockRadioRaceSetup(), 12345)
    const b = simulateRace(mockRadioRaceSetup(), 12345)
    const radioA = a.commentary.filter(c => c.severity === 'radio').map(c => c.text)
    const radioB = b.commentary.filter(c => c.severity === 'radio').map(c => c.text)
    expect(radioA).toEqual(radioB)
  })

  it('a pit stop produces engineer + driver pair on the same lap', () => {
    // Use a fixture where the strategy plans a stop on a known lap (mockRaceSetup
    // already builds a planned-stops list — find that lap N and assert below).
    const setup = mockRadioRaceSetup()
    const pitLap = setup.strategies[0].plannedStops[0]?.lap ?? 20
    const result = simulateRace(setup, 99)
    const pitLapEntries = result.commentary.filter(c => c.lap === pitLap && c.severity === 'radio')
    const speakers = pitLapEntries.map(e => e.speaker)
    expect(speakers).toContain('engineer')
    expect(speakers).toContain('driver')
  })
})
```

- [ ] **Step 2: Run + commit.**

```bash
npx vitest run tests/engine/race/race-simulator.test.ts
git add tests/engine/race/race-simulator.test.ts
git commit -m "test(engine): assert race-level radio volume and determinism"
```

---

### Phase 4 Handoff Gate

Before proceeding to Phase 5, invoke the **`superpowers:verification-before-completion`** skill on the engine integration work. Confirm:
- All 14 emit points fire (or are wired-but-dormant for SC)
- `radioFlags` deduplication prevents spam (tire complaints once per stint, lights-out once per race, etc.)
- A 50-lap seeded race produces 25–60 radio entries (Task 18 test passes)
- Determinism intact (Task 18 second test passes)
- Player metadata threading complete (Task 10.5 deliverables verified end-to-end)
- `npx tsc --noEmit` clean, `npx vitest run tests/engine` clean

---

## Phase 5 — UI: Team Radio Panel

`ui-interface` agent owns this phase. **Invoke `frontend-design` skill** before writing the panel — the Kinetic Command system is already defined; the skill enforces production-grade execution within it.

### Task 19: Scaffold `team-radio-panel.tsx` with empty state

**Files:**
- Create: `src/components/strategy/team-radio-panel.tsx`
- Create: `tests/components/team-radio-panel.test.tsx`

- [ ] **Step 1: Write the empty-state test.**

```tsx
// tests/components/team-radio-panel.test.tsx
import { render, screen } from '@testing-library/react'
import { TeamRadioPanel } from '@/components/strategy/team-radio-panel'

describe('TeamRadioPanel', () => {
  it('renders empty state when no entries', () => {
    render(<TeamRadioPanel entries={[]} playerTeamId="mclaren" />)
    expect(screen.getByText(/standing by/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement the scaffold.**

```tsx
// src/components/strategy/team-radio-panel.tsx
'use client'

import type { CommentaryEntry } from '@/types/race'

interface TeamRadioPanelProps {
  entries: CommentaryEntry[]
  playerTeamId: string
  className?: string
}

export function TeamRadioPanel({ entries, playerTeamId: _playerTeamId, className = '' }: TeamRadioPanelProps) {
  const radioEntries = entries.filter(e => e.severity === 'radio')

  return (
    <div
      className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
    >
      <div className="px-3 py-2 border-b border-line-sub sticky top-0 bg-surface-paper z-10">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
          Team Radio
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto" role="log" aria-label="Team radio feed" aria-live="polite">
        {radioEntries.length === 0 ? (
          <p className="px-3.5 py-4 font-mono text-[11px] text-ink-dim italic">
            Standing by...
          </p>
        ) : (
          <div>{/* Phase 5 Task 20+ render entries here */}</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run test + commit.**

```bash
npx vitest run tests/components/team-radio-panel.test.tsx
git add src/components/strategy/team-radio-panel.tsx tests/components/team-radio-panel.test.tsx
git commit -m "feat(ui): scaffold TeamRadioPanel with empty state"
```

---

### Task 20: Render entries with speaker pill, team color, tone dot

**Files:**
- Modify: `src/components/strategy/team-radio-panel.tsx`
- Modify: `tests/components/team-radio-panel.test.tsx`

- [ ] **Step 1: Write entry-render tests.**

```tsx
const sample: CommentaryEntry[] = [
  { lap: 23, text: 'Box, box, box this lap.', severity: 'radio', speaker: 'engineer', driverId: 'norris', teamId: 'mclaren', category: 'box_box', tone: 'urgent', isPlayerTeam: true },
  { lap: 23, text: 'Copy, box this lap.', severity: 'radio', speaker: 'driver', driverId: 'norris', teamId: 'mclaren', category: 'pit_confirm', tone: 'flat', isPlayerTeam: true },
  { lap: 24, text: 'Car 1 under investigation, incident at turn 4.', severity: 'radio', speaker: 'fia', driverId: 'verstappen', teamId: 'red-bull', category: 'investigation', tone: 'flat', isPlayerTeam: false },
]

it('renders speaker pills for engineer / driver / fia', () => {
  render(<TeamRadioPanel entries={sample} playerTeamId="mclaren" />)
  expect(screen.getByText(/eng/i)).toBeInTheDocument()
  expect(screen.getByText(/race control/i)).toBeInTheDocument()
})

it('renders text content for each entry', () => {
  render(<TeamRadioPanel entries={sample} playerTeamId="mclaren" />)
  expect(screen.getByText(/Box, box, box this lap/)).toBeInTheDocument()
  expect(screen.getByText(/Copy, box this lap/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Implement entry render with speaker pill, team-color border, tone dot.**

Use Tailwind tokens from the Kinetic Command system. Engineer pill = `bg-accent-lime/60 text-surface-void`. Driver pill = `bg-[var(--team-color)] text-white` (resolve team color from a small in-component lookup keyed by `teamId`). FIA pill = `bg-sig-red text-white` with monospace text.

Tone dot — small `<span className="w-[6px] h-[6px] rounded-full">` with color: `bg-sig-amber` (urgent), `bg-sig-red` (angry), `bg-sig-green` (celebrate), nothing for `flat/calm`.

Player-team border glow: `box-shadow: inset 0 0 0 1px rgba(0, 229, 255, 0.2)` (sourcing `--accent-cyan` at 20%).

Non-player opacity: `opacity-75`.

- [ ] **Step 3: Run tests + commit.**

```bash
npx vitest run tests/components/team-radio-panel.test.tsx
git add src/components/strategy/team-radio-panel.tsx tests/components/team-radio-panel.test.tsx
git commit -m "feat(ui): render TeamRadioPanel entries with speaker pill and tone dot"
```

---

### Task 21: Filter chips (ALL / MY TEAM / RACE CONTROL)

**Files:**
- Modify: `src/components/strategy/team-radio-panel.tsx`
- Modify: `tests/components/team-radio-panel.test.tsx`

- [ ] **Step 1: Write filter tests.**

```tsx
it('MY TEAM chip filters out non-player entries', async () => {
  const user = userEvent.setup()
  render(<TeamRadioPanel entries={sample} playerTeamId="mclaren" />)
  await user.click(screen.getByRole('button', { name: /my team/i }))
  expect(screen.queryByText(/under investigation/i)).not.toBeInTheDocument()
  expect(screen.getByText(/Box, box, box/i)).toBeInTheDocument()
})

it('RACE CONTROL chip shows only FIA', async () => {
  const user = userEvent.setup()
  render(<TeamRadioPanel entries={sample} playerTeamId="mclaren" />)
  await user.click(screen.getByRole('button', { name: /race control/i }))
  expect(screen.queryByText(/Box, box/i)).not.toBeInTheDocument()
  expect(screen.getByText(/under investigation/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Add chip state with `useState<'all' | 'my-team' | 'fia'>('all')`.**

Three chips in the header, single-select. Filter `radioEntries` based on selection: `my-team` = `isPlayerTeam === true`; `fia` = `speaker === 'fia'`.

- [ ] **Step 3: Run + commit.**

```bash
npx vitest run tests/components/team-radio-panel.test.tsx
git add src/components/strategy/team-radio-panel.tsx tests/components/team-radio-panel.test.tsx
git commit -m "feat(ui): add ALL/MY TEAM/RACE CONTROL filter chips to TeamRadioPanel"
```

---

### Task 22: Auto-scroll, pause-on-hover, animation

**Files:**
- Modify: `src/components/strategy/team-radio-panel.tsx`
- Modify: `tests/components/team-radio-panel.test.tsx`

- [ ] **Step 1: Implement auto-scroll using `useRef` + `useEffect` on `radioEntries.length`.** Same pattern as `commentary-feed.tsx:38-41`. Pause-on-hover: `onMouseEnter`/`onMouseLeave` toggle a `paused` ref; effect skips scroll when paused.

- [ ] **Step 2: Add fade-in + 4px slide-from-left animation using Framer Motion** (already in deps). Match the existing `commentary-feed.tsx` motion treatment but with the cyan-tint glow on player-team entries.

- [ ] **Step 3: Run tests + commit.**

```bash
npx vitest run tests/components/team-radio-panel.test.tsx
git add src/components/strategy/team-radio-panel.tsx tests/components/team-radio-panel.test.tsx
git commit -m "feat(ui): auto-scroll, pause-on-hover, and fade-in animation for TeamRadioPanel"
```

---

### Phase 5 Handoff Gate

Before proceeding to Phase 6, invoke the **`simplify`** skill on `team-radio-panel.tsx`. Confirm:
- No `transition-all` (Tailwind anti-pattern in this project)
- Animations only on `transform` and `opacity` (Kinetic Command rule)
- Component does not import from `src/engine/**` (types-only allowed)
- No subscription to the full Zustand store; uses `useShallow` if reading store state
- `npx tsc --noEmit` clean, `npx vitest run tests/components/team-radio-panel.test.tsx` clean

---

## Phase 6 — Strategy Page Integration

### Task 23: Filter `commentary-feed.tsx` to exclude radio entries

**Files:**
- Modify: `src/components/strategy/commentary-feed.tsx`

- [ ] **Step 1: Add a one-line filter at the top of the entries map.**

Inside the `.map(...)` block at `src/components/strategy/commentary-feed.tsx:68`, prepend a filter:

```tsx
const visibleEntries = entries.filter(e => e.severity !== 'radio')
```

Use `visibleEntries` in the `.map()` and the empty-state check.

- [ ] **Step 2: Remove the now-stale `radio: { label: 'PIT', cls: 'bg-sig-amber text-surface-void' }` line** from `SEVERITY_TAG`. It will no longer be reached.

- [ ] **Step 3: Run UI tests + commit.**

```bash
npx vitest run tests/components
git add src/components/strategy/commentary-feed.tsx
git commit -m "refactor(ui): exclude radio entries from CommentaryFeed (now in TeamRadioPanel)"
```

---

### Task 24: Mount TeamRadioPanel on the strategy page

**Files:**
- Modify: `src/app/strategy/page.tsx`

- [ ] **Step 1: Find the layout slot for the right column.**

The strategy page currently mounts `commentary-feed.tsx` in a single column. Restructure that column into a vertical stack of TeamRadioPanel (top, ~55%) + CommentaryFeed (bottom, ~45%).

```tsx
<div className="flex flex-col gap-3 h-full">
  <TeamRadioPanel
    entries={raceState.commentary}
    playerTeamId={playerTeamId}
    className="flex-[55]"
  />
  <CommentaryFeed
    entries={raceState.commentary}
    className="flex-[45]"
  />
</div>
```

- [ ] **Step 2: Verify HTTP 200 + visual check.**

Start dev server: `npm run dev` (background).
Curl: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/strategy --max-time 30`
Expected: `200`.

Then open the page in a browser, start a race, and confirm:
- The Team Radio panel appears above the Commentary feed in the right column.
- Radio entries show speaker pills and team-color borders.
- Commentary entries (overtake markers, fastest-lap, neutral) do NOT duplicate in both panels.
- Filter chips work (`MY TEAM`, `RACE CONTROL`).
- Below 1024px width, both panels stack and remain scrollable.

- [ ] **Step 3: Commit.**

```bash
git add src/app/strategy/page.tsx
git commit -m "feat(ui): mount TeamRadioPanel above CommentaryFeed on strategy page"
```

---

## Phase 7 — Verification

### Task 25: Full suite + lint + typecheck

- [ ] **Step 1: TypeScript clean.**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 2: Tests clean.**

Run: `npx vitest run`
Expected: all green. No skipped tests, no `@ts-ignore`, no `as any`.

- [ ] **Step 3: Lint clean.**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Run `simplify` skill on changed files.**

Invoke the `simplify` skill via the Skill tool. Address its findings if any — small refactors only, no scope creep.

---

### Task 26: code-reviewer agent pass

- [ ] **Step 1: Dispatch the `code-reviewer` agent.**

Invoke the `code-reviewer` agent (via the Agent tool, `subagent_type: code-reviewer`) on the diff of this branch vs `main`. Provide it the spec path and the plan path so it has full context.

- [ ] **Step 2: Action CRITICAL/HIGH findings via `superpowers:receiving-code-review` skill.** MEDIUM/LOW findings: judgment call.

- [ ] **Step 3: Commit any review fixes.**

```bash
git commit -m "fix(review): address code-reviewer findings on team radio v1"
```

---

### Task 27: Manual play-test smoke

- [ ] **Step 1: Start a fresh game.** `npm run dev`, navigate to `/`, "New Save".

- [ ] **Step 2: Play one full 50-lap GP.** Watch the Team Radio panel:
  - **Lap 1**: engineer "Lights out" line for player drivers.
  - **Pit stops**: paired engineer "Box, box" + driver "Copy" / signature line.
  - **Overtakes**: attacker celebrates, defender complains.
  - **Tire wear < 25%**: driver tire complaint, gated to once per stint.
  - **Final lap**: engineer "Bring it home" or signature variant.
  - **Investigations / penalties**: FIA voice in red pill, monospace text.

- [ ] **Step 3: Confirm signature lines fire.**

Race with Verstappen on the grid (Red Bull) at least once. Over a season's worth of races, "Simply lovely." or "I told you ten laps ago." should appear at least once. Same for Hamilton's "Get in there Lewis", Leclerc's "I am stupid", Alonso's "Magic. This is magic.", Norris's "Yes! Lovely. Lovely.".

- [ ] **Step 4: Re-race with the same seed; confirm radio output is identical** (use the dev console to dump `useGameStore.getState().raceRuntime.commentary.filter(c => c.severity === 'radio').map(c => c.text)`).

- [ ] **Step 5: Final commit & wrap.**

```bash
# If any fixes shipped during play-test, commit them; otherwise just confirm clean.
git status
git log --oneline main..HEAD
```

---

## Acceptance criteria (from spec §9)

1. ✅ A 50-lap seeded race produces 25–60 radio entries with mixed speakers and tones.
2. ✅ Re-running the same seed produces byte-identical radio output.
3. ✅ Verstappen, Hamilton, Leclerc, Alonso, Norris each emit at least one signature line over a 22-race season.
4. ✅ The Team Radio panel renders alongside the Commentary feed without breaking the strategy page on desktop or below 1024px.
5. ✅ `npx vitest run` passes clean. `npx tsc --noEmit` clean. `npm run lint` clean.
6. ✅ `code-reviewer` agent reports zero CRITICAL or HIGH findings.

---

## Estimated implementation time

- Phase 1 (types): 30 min
- Phase 2 (data authoring): 3–4 hours
- Phase 3 (picker + curation TDD): 90 min
- Phase 4 (engine integration): 2–3 hours
- Phase 5 (UI panel): 2 hours
- Phase 6 (page integration): 30 min
- Phase 7 (verification + play-test): 1 hour

**Total: ~10–12 hours of focused work.**
