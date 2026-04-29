# Race Team Radio — v1 Design Spec

**Date:** 2026-04-29
**Status:** Approved (pre-implementation)
**Pipeline:** A — New Gameplay Feature
**Owners:** sim-engine (data + engine), ui-interface (panel), verify (tests)
**Schema impact:** None. Commentary lives in session-scoped `raceRuntime`; `Driver` and `FullGameState` shapes are untouched.

---

## 1. Problem

The race page emits exactly two strings of "commentary" today:

- `[race-simulator.ts:229](../../src/engine/race/race-simulator.ts#L229)` — `"NOR pits for C3 tires"`
- `[race-simulator.ts:301](../../src/engine/race/race-simulator.ts#L301)` — `"PIA overtakes NOR!"`

The UI's `severity: 'radio'` enum value (`[src/types/race.ts:147](../../src/types/race.ts#L147)`) and the "PIT" amber badge in `commentary-feed.tsx` are wired but **no engine path emits radio**. There is no notion of speakers, no driver personality, no FIA voice, no curation, no broadcast-style transmission feel. The strategy page reads as a lap log, not a pit wall.

This spec adds a first-class **Team Radio** layer: an authored library of real-F1-flavoured transmissions, two speakers (engineer ↔ driver) plus FIA, gated by driver mood and personality archetype, surfaced through a dedicated panel on the strategy page.

## 2. Goals (v1)

1. **Radio feels like radio.** Engineer↔driver pairs, terse phrasing, FIA-tone for stewards, drivers sound *different* from each other.
2. **Curated broadcast.** Player team always heard; rival teams heard only on broadcast-worthy moments.
3. **Full personality.** All 22 drivers have an archetype + signature lines. Verstappen sounds like Verstappen.
4. **Standard event coverage.** ~14 radio categories: pit, overtake, penalty, investigation, lights-out, final lap, fastest lap, tire complaint, weather, push/manage commands, frustration, safety-car (wired-but-dormant).
5. **Dedicated UI panel** on the strategy page next to (above) the existing Commentary feed.
6. **Determinism.** Same seed → identical radio output, end-to-end.
7. **No schema migration.** Ship as session-scoped runtime data only.

## 3. Non-goals (v1)

- TTS or pre-recorded audio (v2).
- Persistence beyond the running session — no post-race replay tab.
- Safety-car simulation logic — items 13/14 in §6 are wired but the simulator does not yet emit safety-car incidents.
- Per-team filter chips on the panel (filter by team-color is v2).
- Mid-race driver swap of archetypes / mood-driven archetype mutation.
- Audio mute toggle behaviour beyond a placeholder slot in the panel header.

## 4. Architecture

### 4.1 Files

**New (sim-engine owned):**
- `src/data/driver-radio-profiles.ts` — `driverId → { archetypes, signatureLines?, catchphraseChance? }` registry, all 22 drivers.
- `src/data/race-radio.ts` — generic + archetype-tagged template library (~320 lines).
- `src/engine/race/radio-picker.ts` — `pickRadioMessage()` and `isBroadcastWorthy()` pure functions.

**Touched:**
- `src/types/race.ts` — extend `CommentaryEntry` with optional fields (additive). *Owned by sim-engine* — type definition.
- `src/engine/race/race-simulator.ts` — replace 2 existing emits, add up to 6 new emit points, plus 2 wired-but-dormant for safety car. *Owned by sim-engine.*
- `src/components/strategy/commentary-feed.tsx` — filter out `severity === 'radio'` entries (so they don't render in two panels). *Owned by ui-interface* — no store action change needed.
- `src/app/strategy/page.tsx` — add Team Radio panel above the Commentary feed. *Owned by ui-interface* — layout-only, no new store wiring.

**Note:** `game-state` is not in the ownership chain. No new store actions, no new worker-protocol messages, no new persisted fields. Radio entries flow through the existing `commentary` array on `WorkerOutMessage` and the existing `runtime.commentary` reducer path.

**New (ui-interface owned):**
- `src/components/strategy/team-radio-panel.tsx` — `'use client'` panel.

### 4.2 Type extension (additive, no migration)

```ts
export interface CommentaryEntry {
  lap: number
  text: string
  severity: 'critical' | 'highlight' | 'radio' | 'info' | 'neutral'
  // NEW — all optional, additive, backward compatible
  speaker?: 'engineer' | 'driver' | 'fia'
  driverId?: string
  teamId?: string
  category?: RadioCategory
  tone?: 'calm' | 'urgent' | 'angry' | 'flat' | 'celebrate'
  isPlayerTeam?: boolean
}
```

Why optional: existing non-radio commentary entries (overtakes pre-radio-rewrite, fastest-lap markers, neutral lap-by-lap) remain valid. JSON-serialisable. No `SCHEMA_VERSION` bump because `runtime.commentary` lives in session-scoped `raceRuntime`, never in `world`.

## 5. Data layer

### 5.1 Archetype taxonomy

```ts
export type RadioArchetype =
  | 'calm-pro'      // Norris, Piastri, Russell, Sainz — measured acknowledgements
  | 'hot-headed'    // Verstappen, Alonso (under stress), Magnussen-style — terse, sharp
  | 'spiritual'     // Hamilton — reflective, "get in there"
  | 'emotional'     // Leclerc, Gasly — self-blame, dramatic highs and lows
  | 'rookie'        // Antonelli, Hadjar, Bortoleto, Lindblad — eager, deferential
  | 'veteran'       // Bottas, Hulkenberg, Perez, Alonso (calm) — laconic, dry
```

A driver carries up to **two** archetypes (primary, optional secondary) so blends are natural: Alonso = `['hot-headed', 'veteran']`.

### 5.2 Profile registry shape

```ts
export interface DriverRadioProfile {
  driverId: string
  archetypes: [RadioArchetype, RadioArchetype?]
  signatureLines?: Partial<Record<RadioCategory, string[]>>
  catchphraseChance?: number  // default 0.25
}
export const DRIVER_RADIO_PROFILES: readonly DriverRadioProfile[] = [...] as const
```

Example (Verstappen):
```ts
{
  driverId: 'verstappen',
  archetypes: ['hot-headed', 'veteran'],
  signatureLines: {
    overtake_done: ['Simply lovely.', 'Yes! Yes! Get in!'],
    driver_frustration: ['I told you ten laps ago.', 'What a stupid call. Stupid.'],
  },
  catchphraseChance: 0.35,
}
```

### 5.3 Template library shape

```ts
export type RadioCategory =
  | 'box_box' | 'box_opposite' | 'pit_confirm' | 'stay_out'
  | 'overtake_done' | 'overtake_failed'
  | 'tire_complaint' | 'gap_call' | 'push_now' | 'manage_tires'
  | 'investigation' | 'penalty_5s' | 'penalty_drive_through'
  | 'safety_car_deploy' | 'safety_car_in'
  | 'rain_incoming' | 'fastest_lap' | 'final_lap' | 'lights_out'
  | 'driver_frustration'

export interface RadioTemplate {
  category: RadioCategory
  speaker: 'engineer' | 'driver' | 'fia'
  text: string                            // tokens: {driver}, {opponent}, {gap}, {compound}, {lap}, {laps_remaining}, {position}, {turn}
  archetypes?: RadioArchetype[]           // empty = generic (eligible to all)
  tone?: 'calm' | 'urgent' | 'angry' | 'flat' | 'celebrate'
  minFrustration?: number                 // gate (default 0)
  maxFrustration?: number                 // gate (default 1)
  weight?: number                         // pick weight (default 1)
}
export const RADIO_TEMPLATES: readonly RadioTemplate[] = [...] as const
```

**Authoring volume target for v1:** ~60 generic + ~150 archetype-tagged (30 × 5) + ~110 driver signature (5 × 22) ≈ **~320 lines of authored radio**.

## 6. Engine logic

### 6.1 Picker contract

```ts
export interface RadioContext {
  category: RadioCategory
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

export function pickRadioMessage(ctx: RadioContext, rng: PRNG): CommentaryEntry
```

### 6.2 Selection algorithm (deterministic)

1. Look up `DriverRadioProfile` for `ctx.driver.id`. Missing profile → fallback to generic-only pool. (Test guard prevents this in production.)
2. **Signature roll**: if `profile.signatureLines[category]` exists and `rng.chance(profile.catchphraseChance ?? 0.25)` → pick uniformly from signature pool, return.
3. **Archetype-eligible pool**: filter `RADIO_TEMPLATES` where:
   - `template.category === ctx.category`
   - `template.speaker` matches the calling site's intended speaker
   - `template.archetypes` is empty OR intersects `profile.archetypes`
   - `ctx.driver.mood.frustration ∈ [minFrustration, maxFrustration]`
4. **Weighted pick** from the eligible pool using `rng.range(0, totalWeight)`.
5. **Token resolution** — replace `{driver}`, `{opponent}`, `{gap}`, etc. from `ctx`. Missing-token behaviour gated on `process.env.NODE_ENV !== 'production'`: throw in dev (Vitest runs as non-production, so tests catch it), fall back to `"..."` in production. The gate is read once at module load into a `const DEBUG_MODE`, keeping the picker pure and deterministic across environments.
6. Return a fully-formed `CommentaryEntry` with `severity: 'radio'`, populated `speaker / driverId / teamId / category / tone / isPlayerTeam`.

**Determinism:** at most two `rng` calls per pick (signature gate + weighted pick, or just one signature draw). Same seed + same `ctx` → identical output.

### 6.3 Curation filter

```ts
export function isBroadcastWorthy(
  category: RadioCategory,
  ctx: RadioContext,
  raceCtx: { championshipRivalIds: string[]; podiumPositions: string[] },
): boolean
```

Rules:
- Player team → always pass.
- Any team → pass if `category ∈ { penalty_5s, penalty_drive_through, investigation, safety_car_deploy, safety_car_in, fastest_lap, lights_out, final_lap, rain_incoming }`.
- Non-player team → pass for `{ overtake_done, overtake_failed, tire_complaint, driver_frustration }` if any of:
  - driver currently on the podium
  - driver is a championship rival of the player
  - opponent is the player driver (overtaking us / overtaken by us)
- Otherwise → drop.

The simulator calls `pickRadioMessage` only when `isBroadcastWorthy === true`. This keeps the panel curated and avoids wasting PRNG draws.

### 6.4 Engine integration: 14 emit points

| # | Trigger | Location | Speakers emitted | Notes |
|---|---|---|---|---|
| 1 | Pit stop executed | replace `[race-simulator.ts:229](../../src/engine/race/race-simulator.ts#L229)` | engineer `box_box` → driver `pit_confirm` | Two entries same lap |
| 2 | Pit-in on opposite strategy detected | new, post-pit block | engineer `box_opposite` | Player team only |
| 3 | Overtake success | replace `[race-simulator.ts:301](../../src/engine/race/race-simulator.ts#L301)` | attacker `overtake_done` + defender `overtake_failed` | Both gated by `isBroadcastWorthy` |
| 4 | Investigation opened | after `[race-simulator.ts:343](../../src/engine/race/race-simulator.ts#L343)` `pendingInvestigations.push` | FIA `investigation` | Always broadcast-worthy |
| 5 | Penalty issued | penalty resolution block | FIA `penalty_5s` / `penalty_drive_through` + driver `driver_frustration` | Driver line gated by mood |
| 6 | Lights out | top of `simulateNextLap` when `currentLap === 1` | engineer `lights_out` for player team | One-shot per race |
| 7 | Final lap | top of `simulateNextLap` when `currentLap === totalLaps` | engineer `final_lap` for player team + championship leaders | One-shot per car |
| 8 | Fastest lap detected | after `lapResults` loop | engineer `fastest_lap` for the driver | Only when fastest-time strictly improves |
| 9 | Tire wear < 25 | after `degradeTire` | driver `tire_complaint` (mood-gated) | Once per stint per driver |
| 10 | Rain incoming | after `weatherEngine.tick()` | engineer `rain_incoming` | Once per weather transition |
| 11 | Push/overtake command issued by player | `applyCommandEnvelopeToSim` | engineer `push_now` | Player team only. **No new command bus message** — radio is a side effect of an existing command being applied. |
| 12 | Conserve/defend command issued by player | `applyCommandEnvelopeToSim` | engineer `manage_tires` | Player team only. Same as #11 — side effect of existing command. |
| 13 | Safety car deployed | new (wired-but-dormant) | FIA `safety_car_deploy` + engineer `manage_tires` for all cars | **Dormant in v1** — simulator does not currently emit SC incidents |
| 14 | Safety car ending | new (wired-but-dormant) | FIA `safety_car_in` + engineer urgent push | **Dormant in v1** — same reason |

**State additions** on `SimRaceState` — the worker-internal race state defined in `src/engine/race/race-simulator.ts`, **not** the store's `raceRuntime` slice. These flags live entirely inside the Web Worker, are session-scoped, never reach the store, and are never persisted:
```ts
radioFlags: {
  tireComplainedThisStint: Record<string, boolean>
  weatherTransitionAnnounced: boolean
  fastestLapAnnouncedTime: number
  finalLapAnnouncedFor: Record<string, boolean>
  lightsOutAnnounced: boolean
}
```

Volume estimate: a 50-lap race in midfield should produce 35–60 radio entries.

## 7. UI: Team Radio panel

### 7.1 Component

`src/components/strategy/team-radio-panel.tsx` (`'use client'`).

Reads from store via `useShallow`: `runtime.commentary` filtered to `severity === 'radio'`. No engine imports beyond types. No new store fields.

### 7.2 Visual treatment (Kinetic Command)

- **Header**: `TEAM RADIO` title left, filter chips (`ALL / MY TEAM / RACE CONTROL`) right, mute-future-TTS placeholder slot.
- **Speaker pill** — left of text, 9px monospace uppercase. Engineer = `--accent-lime` at 60% alpha. Driver = team color (3-letter ID). FIA = `--sig-red` solid.
- **Team-color border** — 2px solid left border per entry. Player-team entries get `--accent-cyan` 20% alpha glow.
- **Tone dot** — small dot right of speaker pill: amber (urgent), red (angry), green (celebrate), none (calm/flat).
- **Opacity** — player-team entries 100%, non-player 75%.
- **Auto-scroll** to bottom on new entry; pause on hover.
- **Animation** — fade-in + 4px slide-from-left, 180ms, on mount only. No `transition-all`. No animation while sim paused.
- **Empty state** — `"Standing by..."` in monospace dim ink.

### 7.3 Filter chips

`ALL / MY TEAM / RACE CONTROL`, single-select, default `ALL`. Per-team filter is v2.

### 7.4 Strategy page layout

Today the right column hosts `commentary-feed.tsx`. v1 splits it vertically:

- **Top (~55%)** — Team Radio panel.
- **Bottom (~45%)** — Commentary feed (filtered to exclude `severity === 'radio'` so it stops double-rendering radio entries).

Below 1024px: stack vertically (existing responsive pattern). Both panels independently scrollable.

The stale "PIT" badge mapped to `severity: 'radio'` in `commentary-feed.tsx` becomes irrelevant once radio is routed exclusively to the new panel — that mapping line can be removed. **Implementer must verify** during planning that no other engine path emits `severity: 'radio'` after the rewrite, so the legacy badge isn't silently used by something else (sanity grep: `severity:\s*['"]radio` should match only the new picker).

## 8. Testing strategy

### 8.1 New test files

**`tests/data/driver-radio-profiles.test.ts`** (verify):
- Every driver in `src/data/drivers.ts` (all 22) has a `DriverRadioProfile`.
- Every profile's `archetypes[0]` is a valid `RadioArchetype`.
- Every signature line is keyed by a valid `RadioCategory`.

**`tests/data/race-radio.test.ts`** (verify):
- For every `(category, speaker)` combination the engine emits, ≥1 template exists.
- For every `RadioArchetype`, ≥5 templates are eligible.
- Every template's tokens are in the allowed token set.

**`tests/engine/race/radio-picker.test.ts`** (verify):
- **Determinism** — same seed + same `RadioContext` → byte-identical output.
- **Signature gating** — `catchphraseChance: 1.0` always picks signature; `0.0` never does.
- **Frustration gating** — `minFrustration: 0.6` template never fires at `mood.frustration === 0.3`.
- **Archetype filtering** — `hot-headed`-only template never fires for `calm-pro`.
- **Token resolution** — undefined token throws in dev.
- **Curation** — `isBroadcastWorthy` returns true for player team, true for FIA categories, drops non-player `tire_complaint` for midfield non-rival.

**`tests/engine/race/race-simulator.test.ts`** extension:
- After a 50-lap seeded race, `commentary.filter(c => c.severity === 'radio').length >= 25`.
- A pit stop produces exactly two paired entries (engineer + driver) on the same lap.
- An overtake of the player produces both `overtake_done` (attacker) and `overtake_failed` (defender).
- Re-running the same race twice produces identical radio output.

**`tests/components/team-radio-panel.test.tsx`** (verify, ui-interface produces fixtures):
- Empty state when no radio entries.
- Speaker pill + team border + tone dot render correctly.
- `MY TEAM` chip filters non-player entries.
- `RACE CONTROL` chip shows only `speaker === 'fia'`.
- Auto-scroll to bottom on new entry; paused on hover.

### 8.2 Pipeline routing (per AGENTS.md Pipeline A)

1. **sim-engine** — TDD per `superpowers:test-driven-development`: picker tests first, then registry / templates / picker, then wire emit points. Run `npx vitest run tests/engine tests/data`.
2. **ui-interface** — invoke `frontend-design` skill for the panel, build component, confirm route returns HTTP 200 via `npm run dev` + `curl`. Run `simplify`.
3. **verify** — full suite (`npx vitest run`), `npx tsc --noEmit`, `npm run lint`. Invoke `code-reviewer` agent. Action any CRITICAL/HIGH findings via `superpowers:receiving-code-review`.

### 8.3 Observability

No new logging. The panel is the observability surface. Zustand inspector exposes `runtime.commentary` for debugging template gaps.

## 9. Acceptance criteria for v1 ship

1. A 50-lap seeded race produces 25–60 radio entries with mixed speakers and tones.
2. Re-running the same seed produces byte-identical radio output.
3. Verstappen, Hamilton, Leclerc, Alonso, Norris each emit at least one signature line over a simulated 22-race season.
4. The Team Radio panel renders alongside the Commentary feed without breaking the strategy page on desktop or below 1024px.
5. `npx vitest run` passes clean. `npx tsc --noEmit` clean. `npm run lint` clean.
6. `code-reviewer` agent reports zero CRITICAL or HIGH findings.

## 10. Open risks and mitigations

| Risk | Mitigation |
|---|---|
| Driver-profile drift if a driver is added/removed without a profile entry | Invariant test `tests/data/driver-radio-profiles.test.ts` — fails CI |
| Empty-pool fallback if a category has no eligible template under tight gating | Coverage test asserts ≥5 eligible templates per archetype; picker logs a soft warning in dev when fallback fires |
| Token typos in templates | Picker throws on missing token in dev (caught by token-resolution test) |
| Performance — picker called many times per lap on large grids | Picker is O(N) over template list per call; with ~320 templates and ~5 picks/lap, this is sub-millisecond. Profile if it ever becomes an issue. |
| Radio panel scroll jank during `simSpeed: 'max'` | Auto-scroll uses `el.scrollTop = el.scrollHeight` (existing pattern in `commentary-feed.tsx`); virtualisation deferred unless profiled need emerges. |
| Future schema migration if v2 introduces persisted radio history | Out of scope for v1; v2 will add a migration entry per `docs/architecture/persistence-contract.md` policy. |

## 11. Future work (v2+, explicitly out of scope here)

- TTS via Web Speech API or pre-recorded clips for top 30 categories.
- Post-race radio replay tab on the results page.
- Team-by-team filter chips.
- Mid-race archetype shifts driven by championship pressure / driver development.
- Safety-car simulation system (separate engine workstream — items 13/14 wait on it).
- Radio "highlight reel" exportable as a shareable artifact.
