# Drivers Page Redesign — Design Spec

**Status:** Draft · awaiting review
**Owner:** sim-engine + ui-interface
**Created:** 2026-05-06
**Visual reference:** `new-designs/drivers/Drivers Page.html`, `new-designs/drivers/drivers.css`, `new-designs/drivers/drivers-data.js`
**Related:** `docs/architecture/persistence-contract.md`, `docs/architecture/adr-001-system-architecture.md`, `CLAUDE.md` frontend rules

---

## 1. Summary

Replace the current `/drivers` page with a richer, broadcast-styled "Driver Command" dossier that matches the supplied mockup pixel-for-pixel. The redesign exposes career stats, world titles, championship pulse, an attribute radar with grid-peer comparison, full mood + rivalry telemetry, an enriched contract panel, an expanded penalty record, and a scouting table with player-driven actions.

The work splits into two implementation phases:

- **IP-09a — Engine + schema** (sim-engine agent): add four data surfaces (`careerWins`/`careerPodiums`/`careerStarts`, `worldTitles`, `pulse`, `scoutSignal`/`scoutingReports`), a portrait URL field, the supporting pure helpers (`derivePulse`, `applyRaceCareerDeltas`, `applySeasonEndCareerDeltas`, `computeScoutSignal`), the orchestrator wiring, the schema migration, and the real-world seed values for the 2026 grid.
- **IP-09b — UI rebuild** (ui-interface agent): rewrite `/drivers` with reference-accurate layout, scoped "broadcast" sub-theme (only on this route), and progressive disclosure that matches the mockup.

The rest of the app is unaffected. No race-day behavior changes. No worker-protocol changes.

---

## 2. Goals & Non-Goals

### Goals

1. The `/drivers` page renders identical layout, typography, spacing, and color hierarchy to `new-designs/drivers/Drivers Page.html` when run against real player-team data.
2. Career stats and world-title counts are accurate for the real 2026 grid on session 1, round 1 (pre-seeded from public records).
3. Per-driver `pulse` (one headline + one detail string) is regenerated each round and on game initialization, deterministically from observable state.
4. The scout panel surfaces player-driven actions (`File Report`, `Approach`) that affect persisted state.
5. New persisted fields are covered by a schema migration so saves from the previous version load without data loss.
6. Engine purity invariant is preserved: every new helper is a pure function under `src/engine/**`.
7. The broadcast sub-theme is scoped to `/drivers` and does not bleed into other routes.

### Non-Goals

- Driver portrait image pipeline (we add `Driver.portraitUrl: string | null` and render a stripe placeholder; image authoring is deferred).
- A new contract negotiation flow (the "Open Negotiation" button calls existing/stub action — surface only, no new gameplay).
- Rivalry editing or event-driven rivalry creation (display-only, fed from existing `Driver.rivalries[]`).
- A scout-network economy (no scouting budget, no weekly report cadence — `scoutingReports` is incremented by an explicit player action only).
- Mobile/responsive layout (desktop-first per existing convention; the page remains usable but not redesigned for narrow viewports).
- Migrating other pages (Paddock, Factory, Strategy, Finance) to broadcast sub-theme.
- Race-day suppression logic on `/drivers` (page is not visited during race phase by design).

---

## 3. IP-09a — Engine + Schema

### 3.1 Type changes (`src/types/driver.ts`)

```ts
export interface DriverPulse {
  headline: string  // short status, ≤ 32 chars target
  detail: string    // factual one-liner assembled from current-season state
}

export type ScoutSignal = 'hot' | 'tracking' | 'available'

export interface Driver {
  // ...existing fields preserved...
  careerWins: number          // running total, all seasons
  careerPodiums: number
  careerStarts: number
  worldTitles: number
  pulse: DriverPulse
  portraitUrl: string | null
  scoutSignal: ScoutSignal    // semantically meaningful when teamId === null OR isF2
  scoutingReports: number     // count of player-filed reports; persists across seasons
}
```

All fields are JSON-serializable (string/number/null only). No new class instances, Map, Set, or Date.

### 3.2 New engine modules

**`src/engine/drivers/career-stats.ts`** — pure functions:

```ts
applyRaceCareerDeltas(driver, finishingPosition): Driver
  // Returns new driver object with careerStarts++, careerWins++ if finishingPosition === 1,
  // careerPodiums++ if finishingPosition <= 3. DNF (>= 21) increments only careerStarts.

applySeasonEndCareerDeltas(driver, finalDriversChampionshipStanding): Driver
  // Returns new driver object with worldTitles++ if finalDriversChampionshipStanding === 1.
```

Idempotency: the orchestrator already guards against double-counting via `seasonStats.lastProcessedRound`. Career deltas are applied alongside `seasonStats` deltas in the same guarded path so they cannot double-count either.

**`src/engine/drivers/pulse.ts`** — pure function:

```ts
derivePulse(driver: Driver, context: PulseContext): DriverPulse

interface PulseContext {
  championshipPositionByDriverId: Record<string, number>
  championshipGapByDriverId: Record<string, number>  // gap-to-leader in points (negative = behind)
  totalDriversInChampionship: number
  currentRound: number
  currentSeason: number
}
```

**Branching logic (deterministic, ordered — first match wins):**

| # | Condition | Headline | Detail template |
|---|---|---|---|
| 1 | `isReserve` | `"Reserve · race-ready"` | `"Simulator pace tracking · awaiting call-up window"` |
| 2 | `teamId === null && isF2` | `"F2 prospect — on the radar"` | `"{N} scouting reports filed · {age} years old"` |
| 3 | `teamId === null && !isF2` | `"Free agent · seeking seat"` | `"{careerStarts} career starts · {careerWins}W / {careerPodiums}P"` |
| 4 | championship leader | `"Leading the championship"` | `"{wins}W in {round} · +{gap} on P2 · {dnfs} DNF{s}"` |
| 5 | championship P2-P3 with `gap >= -25` | `"On championship pace"` | `"{wins}W in {round} · trailing leader by {abs(gap)} pts · {dnfs} DNF{s}"` |
| 6 | recent form 3+ podiums in last 4 races | `"On a hot streak"` | `"{podiumsRecent} podiums in last 4 · best P{bestFinish}"` |
| 7 | DNF in last 2 races | `"Reliability under fire"` | `"{dnfs} DNF{s} this season · last race {lastResult}"` |
| 8 | total active penalty points >= 9 | `"Stewards circling"` | `"{points} active penalty points · {warningsThisSeason} warnings"` |
| 9 | rookie (experience < 50 && age <= 23) | `"Rookie campaign — finding rhythm"` | `"P{bestFinish} best · {penalties} penalties · qualifying ahead of race-day"` |
| 10 | mood.frustration >= 70 | `"Pressure building"` | `"P{championshipPosition} · last race {lastResult} · mood deteriorating"` |
| 11 | mood.confidence >= 80 && mood.motivation >= 80 | `"Locked in"` | `"P{championshipPosition} · {points} pts · {wins}W in {round}"` |
| 12 | championship position in P11+ | `"Midfield grind"` | `"P{championshipPosition} · {points} pts · best P{bestFinish}"` |
| 13 | fallback | `"Chasing form"` | `"P{championshipPosition} · {points} pts · {round} rounds in"` |

`{N}` placeholders substitute from driver/context fields; `s` pluralizes `{dnfs}`/`{points}`. Detail strings cap at 96 characters; if a substituted string would exceed, we truncate the trailing fragment after the last `·` separator.

The function is pure, deterministic, and never calls `Math.random()` or the PRNG — pulse selection is entirely state-driven.

**`src/engine/drivers/scout-signal.ts`** — pure function:

```ts
computeScoutSignal(driver: Driver): ScoutSignal
```

**Logic (ordered):**

1. If `scoutingReports >= 8` → `"hot"`
2. If `attributes.pace >= 85 && attributes.developmentPotential >= 85` → `"hot"`
3. If `scoutingReports >= 4` → `"tracking"`
4. If `isF2 && attributes.developmentPotential >= 75` → `"tracking"`
5. Otherwise → `"available"`

This keeps signal semantically meaningful for free agents/F2 only; for contracted drivers we compute it but don't display it.

### 3.3 Orchestrator wiring (no signature changes)

**`src/engine/core/orchestrator.ts`:**

- `processPostRace(world, raceResults, prng)`: after the existing `seasonStats` update for each finished driver, in the same `lastProcessedRound`-guarded block, call `applyRaceCareerDeltas(driver, position)`. After all per-driver updates, iterate every driver in `world.drivers` and call `derivePulse(driver, context)` and `computeScoutSignal(driver)` to update their `pulse` and `scoutSignal` fields.
- `processSeasonEnd(world, prng)`: after computing the final standings (which the existing implementation does for prize money), call `applySeasonEndCareerDeltas(driver, finalStanding)` for each driver. Then clear season-only state as today and recompute `pulse`/`scoutSignal` so the new season opens with fresh strings.

**`src/engine/core/state-manager.ts`:**

- `initializeGame(seedOptions)`: after the existing game construction, run one synthetic pass of `derivePulse` and `computeScoutSignal` across `world.drivers` so a fresh game opens with populated fields. Career counters come from the seed file (see §3.6) — no synthetic accumulation.

The orchestrator's existing engine execution order (Regulation → Engineering → Financial → Driver → AI Teams → Narrative → Delegation) is **not changed**; pulse + scout-signal recomputation runs as a final step inside `processPostRace`, after all driver-mutating engines have run.

### 3.4 Schema migration (`src/engine/core/save-system.ts`)

- Bump `SCHEMA_VERSION` by 1.
- Add a `MIGRATIONS` entry from previous version → new version. For each driver in `state.world.drivers`:
  - `careerWins`, `careerPodiums`, `careerStarts`, `worldTitles` default to `0` (existing saves do not retroactively get real-world numbers — only fresh games seeded via `src/data/drivers.ts` carry them).
  - `pulse` defaults to `{ headline: '', detail: '' }`.
  - `portraitUrl` defaults to `null`.
  - `scoutSignal` defaults to `'available'`.
  - `scoutingReports` defaults to `0`.
- After defaulting, the migration runs `derivePulse` and `computeScoutSignal` over every driver so loaded saves render correctly without waiting for the next post-race tick.
- The migration test (§3.7 `migration.test.ts`) asserts the post-default `derivePulse`/`computeScoutSignal` step is deterministic: it loads a v(N-1) fixture with a known driver in a known state (e.g., championship leader with 4 wins in 8 rounds), runs `migrateToCurrent`, and asserts the resulting `pulse.headline` equals the exact string from branch #4 of the pulse template table. This locks down both that the migration calls the helpers and that the helpers produce stable output.
- Update `docs/architecture/persistence-contract.md` §1 to list the new persisted fields under `Driver`.

### 3.5 New store action (`src/stores/game-store.ts`)

- `fileScoutingReport(driverId)` — thin dispatch: validates the target is a free agent or F2 driver, calls a new pure helper `applyScoutingReport(driver)` that returns a new driver object with `scoutingReports + 1` and the recomputed `scoutSignal`, and replaces the driver in `world.drivers`. Triggers the existing autosave-on-`world`-change path. Zero business logic in the store action itself.

### 3.6 Seed values (`src/data/drivers.ts`)

Pre-seed the 22 active drivers + 11 reserves with end-of-2025-season real-world career stats and world titles. Reference values for the high-impact entries:

| Driver | worldTitles | careerWins | careerPodiums | careerStarts |
|---|---|---|---|---|
| Verstappen | 4 | 64 | 116 | 218 |
| Hamilton | 7 | 105 | 202 | 356 |
| Alonso | 2 | 32 | 106 | 406 |
| Russell | 0 | 4 | 18 | 137 |
| Leclerc | 0 | 8 | 44 | 158 |
| Norris | 0 | 5 | 25 | 137 |
| Piastri | 0 | 2 | 10 | 56 |
| Sainz | 0 | 4 | 27 | 217 |
| Albon | 0 | 0 | 2 | 119 |
| Hülkenberg | 0 | 0 | 1 | 230 |
| Pérez | 0 | 6 | 39 | 281 |
| Bottas | 0 | 10 | 67 | 246 |
| Ocon | 0 | 1 | 4 | 167 |
| Gasly | 0 | 1 | 5 | 167 |
| Stroll | 0 | 0 | 3 | 184 |
| Lawson | 0 | 0 | 0 | 16 |
| Bearman | 0 | 0 | 0 | 12 |
| Bortoleto | 0 | 0 | 0 | 23 |
| Antonelli | 0 | 0 | 0 | 23 |
| Hadjar | 0 | 0 | 0 | 23 |
| Lindblad | 0 | 0 | 0 | 0 |
| Colapinto | 0 | 0 | 0 | 32 |

Numbers are curated from public records as of 2025 season end. They are static — once a save is created, accumulation continues from these values.

`pulse`, `scoutSignal`, `scoutingReports` are seeded in `data/drivers.ts` with **type-satisfying placeholders only** (`pulse: { headline: '', detail: '' }`, `scoutSignal: 'available'`, `scoutingReports: 0`) so the seed file type-checks against the non-optional `Driver` type. `state-manager.initializeGame` overwrites these placeholders with computed values via `derivePulse` and `computeScoutSignal` before the first frame renders, so the empty placeholders are never observable to the player.

### 3.7 IP-09a tests (`tests/engine/drivers/`)

- **`career-stats.test.ts`** — single-race delta (P1, P3, P10, DNF), multi-race accumulation, season-end title award, double-call guard via `lastProcessedRound`.
- **`pulse.test.ts`** — fixture per branch (1–13), determinism (same input → byte-equal output), truncation behavior at 96-char cap, plural correctness.
- **`scout-signal.test.ts`** — each branch hit, edge cases (exactly 8 reports, exactly 4 reports), F2 + dev-pot threshold.
- **`migration.test.ts`** — load v(N-1) fixture, run `migrateToCurrent`, assert all new fields exist with correct defaults, assert pulse/signal populated post-migration.
- **`tests/data/driver-seed.test.ts`** — assert seed file produces `careerWins/careerPodiums/careerStarts/worldTitles` for all 22 active drivers.

### 3.8 IP-09a verification gates

- `npx tsc --noEmit` — clean
- `npx vitest run tests/engine/drivers tests/engine/core tests/data` — clean
- `python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine` — no new illegal imports
- `superpowers:verification-before-completion` invoked before handoff

---

## 4. IP-09b — UI Rebuild

### 4.1 Sub-theme scoping

The broadcast sub-theme applies **only** to the `/drivers` route. Implementation:

- New file `src/styles/drivers-broadcast.css` imported by `src/app/drivers/layout.tsx` (route-scoped, not global).
- All selectors are nested under `.drivers-broadcast` so the file's tokens cannot leak.
- `JetBrains Mono` is loaded via `next/font/google` in `src/app/drivers/layout.tsx` — only fetched when the user visits `/drivers`.
- Page root carries `className="drivers-broadcast"` to activate the sub-theme.
- The Kinetic Command top bar from `PageShell` continues to wrap the page; broadcast styling lives below the top bar.

**Sub-theme tokens (defined in `drivers-broadcast.css` under `.drivers-broadcast`):**

```css
.drivers-broadcast {
  --font-display: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --bg-void: oklch(0.13 0.005 250);
  --bg-base: oklch(0.16 0.006 250);
  --bg-paper: oklch(0.18 0.007 250);
  --bg-raised: oklch(0.22 0.008 250);
  --bg-hi: oklch(0.26 0.01 250);

  --ink-hi: oklch(0.96 0.01 250);
  --ink-body: oklch(0.82 0.01 250);
  --ink-mute: oklch(0.62 0.01 250);
  --ink-dim: oklch(0.45 0.01 250);

  --line-hair: oklch(0.28 0.005 250 / 0.7);
  --line-sub: oklch(0.34 0.006 250);
  --line-strong: oklch(0.42 0.008 250);

  --sig-cyan: oklch(0.78 0.16 220);
  --sig-amber: oklch(0.78 0.18 80);
  --sig-green: oklch(0.78 0.18 148);
  --sig-red: oklch(0.65 0.22 28);
  --sig-red-dk: oklch(0.42 0.18 28);

  /* Per-team color set inline on the page root via React style prop:
     style={{ ['--team']: team.color, ['--team-dark']: team.colorDark }} */
}
```

The Kinetic Command lime/cyan tokens (`--accent-lime`, `--accent-cyan`) are not redefined — they remain available for any chrome that reaches in (e.g., the page-shell top bar).

### 4.2 File map

| File | Status | Purpose |
|---|---|---|
| `src/app/drivers/layout.tsx` | new | Loads JetBrains Mono via `next/font`, imports `drivers-broadcast.css`, wraps children in `.drivers-broadcast` |
| `src/app/drivers/page.tsx` | rewrite | Composition root: tabs state, world data wiring via `useDriversPageData` hook |
| `src/styles/drivers-broadcast.css` | new | Sub-theme tokens + all `.drv-*`, `.attr-*`, `.mood-*`, `.contract-*`, `.penalty-*`, `.scout-*` selectors copied from reference CSS |
| `src/hooks/use-drivers-page-data.ts` | new | `useShallow` selector composing roster, peer averages, championship gaps, rivalry index, free agents |
| `src/components/drivers/page-header.tsx` | new | Eyebrow + title + meta strip (next event, constructor pos, roster) |
| `src/components/drivers/driver-tabs.tsx` | new | Team-color-bar tab bar (CAR-01, CAR-02, RESERVE, SCOUT) |
| `src/components/drivers/driver-hero.tsx` | new | Two-column hero: helmet column + ID column + form strip |
| `src/components/drivers/driver-portrait.tsx` | new | SVG stripe placeholder with corner crops; renders `<img>` if `portraitUrl` provided |
| `src/components/drivers/attr-radar.tsx` | new | SVG radar, attrs vs peer overlay |
| `src/components/drivers/attributes-card.tsx` | rewrite | Radar + horizontal bars + peer-delta chip |
| `src/components/drivers/mood-card.tsx` | rewrite | 3-cell mood strip + rivalries list |
| `src/components/drivers/form-bars.tsx` | new | Last-N-rounds form bar chart (color-coded: podium/points/midfield/back) |
| `src/components/drivers/contract-card.tsx` | new (replaces `contract-panel.tsx`) | Salary hero + expiry pill + release clause + bonuses + action buttons |
| `src/components/drivers/penalty-card.tsx` | rewrite of `penalty-record-section.tsx` | Hero number + segments + entries + warnings + grid drop + ban banner |
| `src/components/drivers/scout-panel.tsx` | rewrite | Table grid with signal pills, asking salary, File Report + Approach buttons |
| `src/types/driver.ts` | extended (in IP-09a) | New fields documented in §3.1 |

**Files removed:** `src/components/drivers/driver-profile.tsx`, `src/components/drivers/mood-tracker.tsx`, `src/components/drivers/contract-panel.tsx`, `src/components/drivers/penalty-record-section.tsx` are deleted after their replacements land. (The migration-related test fixtures stay.)

### 4.3 Component contracts

**`<DriverHero>`** — props: `{ driver: Driver, team: Team, championshipPosition: number | null, championshipGap: number | null }`. The page-level wiring resolves the indexed values from the hook (`championshipPositionByDriverId[driver.id]` and `championshipGapByDriverId[driver.id]`) before passing them in. The leaf component never derives championship state itself. Renders helmet column with portrait, race number watermark, code, team tag, world-title stars (if `worldTitles > 0`), career-stats trio (if `careerStarts > 0`); ID column with first/last name, NAT/AGE/#/CONTRACT meta, large OVR badge in team color; championship row (or reserve row); 8-column stats grid; form-bars strip. OVR is computed by a shared helper `src/lib/utils/driver-ovr.ts` exporting `computeDriverOvr(attributes)` so the same value is used in tabs + hero.

**`<AttributesCard>`** — props: `{ driver: Driver, peer: DriverAttributes, teamColor: string }`. Two-column body: radar (with peer overlay) + horizontal bars with peer-marker dashed line and delta chip.

**`<MoodCard>`** — props: `{ driver: Driver, rivalryIndex: Record<string, RivalryDisplay> }`. 3-cell mood strip color-coded by `moodTone(key, value)` helper; rivalries list resolves `targetDriverId` via the index to pull `code`, `name`, `teamName`. Empty state: dashed-border "no active rivalries logged".

**`<ContractCard>`** — props: `{ driver: Driver, currentSeason: number, onNegotiate?: () => void, onRelease?: () => void }`. Free-agent fallback ("FREE AGENT — NO ACTIVE CONTRACT") for `contract === null`. Salary hero with `formatM(salary)`; expiry pill turns amber when `termEndSeason <= 1`; bonuses list; action buttons (primary "Open Negotiation" + secondary "Release Talks"). Action buttons are wired to provided callbacks; if not provided, they call existing store actions or are noop stubs (decided per existing store action availability — see §4.6).

**`<PenaltyCard>`** — props: `{ driver: Driver, currentSeason: number, currentRound: number, offenceLabels: Record<OffenceType, string> }`. Renders one of three states based on `total === 0 && warningsThisSeason === 0 && banUntilRound === null && nextRaceGridDrop === 0`:
- **Clean state** — green check, "CLEAN RECORD" message.
- **Active state** — ban banner (if `banUntilRound !== null`), big-number hero with band class (`clean`/`approaching`/`warning`/`critical`), 4-segment progress (3/6/9/12 thresholds), entries list (sorted newest first), warnings track (5-segment), grid drop banner if `nextRaceGridDrop > 0`.

The expiry-round formula `((issuedRound + 22 - 1) % 22) + 1` and expiry-season formula `issuedSeason + Math.floor((issuedRound + 22 - 1) / 22)` are factored into a helper `src/lib/utils/penalty-expiry.ts` so they can be unit-tested independently.

**`<ScoutPanel>`** — props: `{ scouts: Driver[], onApproach?: (id: string) => void, onFileReport: (id: string) => void }`. Sorts by composite `(pace + developmentPotential)` desc. Header strip shows total count, F2 count, veteran count, and the recommended top scout. Table grid with header row + scout rows: `CODE`, `DRIVER`, `PAC`, `RCR`, `POT`, `SALARY`, `STATUS`. Signal pill class `signal hot|tracking|available` color-coded. `File Report` button calls `fileScoutingReport(driverId)` store action and the row's `scouted` count animates upward (CSS `transition: opacity` only — no `transition-all`).

### 4.4 Page composition (`src/app/drivers/page.tsx`)

```tsx
'use client'

export default function DriversPage() {
  const data = useDriversPageData()  // returns null until world is hydrated
  const [activeTab, setActiveTab] = useState<TabId>('CAR-01')

  if (!data) return null

  const teamStyle = {
    ['--team' as string]: data.playerTeam.color,
    ['--team-dark' as string]: data.playerTeam.colorDark,
  }

  return (
    <PageShell>
      <div className="drv-wrap" style={teamStyle}>
        <PageHeader season={data.season} round={data.currentRound}
          teamName={data.playerTeam.name} nextRound={data.nextRound}
          constructorPos={data.constructorPosition} rosterCount={data.rosterCount} />
        <DriverTabs roster={data.roster} scoutCount={data.freeAgents.length}
          active={activeTab} onChange={setActiveTab} />
        {activeTab === 'SCOUT'
          ? <ScoutPanel scouts={data.freeAgents} onFileReport={data.fileReport} onApproach={data.approach} />
          : <DriverDossier driver={data.roster[activeTab]} ... />}
      </div>
    </PageShell>
  )
}
```

### 4.5 Selector hook (`src/hooks/use-drivers-page-data.ts`)

```ts
export function useDriversPageData() {
  return useGameStore(useShallow(state => {
    if (!state.world) return null
    const world = state.world
    const playerTeam = world.teams.find(t => t.id === world.gameState.playerTeamId)!
    const roster = composeRoster(world.drivers, playerTeam.id)
    const peerAttributes = computePeerAttributes(world.drivers)
    const standings = computeChampionshipSummary(world.drivers)
    const rivalryIndex = buildRivalryIndex(world.drivers, world.teams)
    const freeAgents = world.drivers
      .filter(d => !d.teamId)
      .sort((a, b) => scoutScore(b) - scoutScore(a))
    return {
      playerTeam,
      roster,
      peerAttributes,
      championshipPositionByDriverId: standings.positionById,
      championshipGapByDriverId: standings.gapById,
      rivalryIndex,
      freeAgents,
      season: world.gameState.season,
      currentRound: world.gameState.currentRound,
      nextRound: world.gameState.nextRound,
      constructorPosition: standings.constructorPositionById[playerTeam.id],
      rosterCount: { active: 2, reserve: 1 },
      fileReport: state.fileScoutingReport,
      approach: state.approachDriver,  // existing or stub
    }
  }))
}
```

All composition helpers (`composeRoster`, `computePeerAttributes`, `computeChampionshipSummary`, `buildRivalryIndex`, `scoutScore`) live in `src/lib/utils/drivers-page.ts` and are unit-tested independently. They contain **no game logic** — they are pure presentation derivations. They must not import from `src/engine/**` (types-only imports are permitted, consistent with the `ui-interface` agent rules in AGENTS.md).

### 4.6 Store actions

- `fileScoutingReport(driverId)` — added in IP-09a (§3.5).
- `approachDriver(driverId)` — **verified absent in `src/stores/game-store.ts` as of 2026-05-06.** Add a thin stub action that emits a toast `"Approach tabled · negotiation flow coming soon"` and returns. The stub does not modify `world` so it does not trigger autosave.
- `openContractNegotiation(driverId)` — **verified absent in `src/stores/game-store.ts` as of 2026-05-06.** Same stub treatment as `approachDriver`.

Stub actions are explicitly documented in `docs/architecture/current-state-baseline.md` so they don't get rediscovered as bugs.

### 4.7 IP-09b tests (`tests/components/drivers/`, `tests/hooks/`, `tests/lib/`)

- **`driver-hero.test.tsx`** — renders OVR; shows champion stars only when `worldTitles > 0`; shows career row only when `careerStarts > 0`; reserve variant skips championship row and shows "RESERVE STATUS"; form bars render correctly for podium / points / midfield / back / DNF cases.
- **`attributes-card.test.tsx`** — peer delta chip computes `+5` / `-3` correctly; radar value path matches `(attr/100)*R`; peer overlay path renders.
- **`mood-card.test.tsx`** — three mood cells with tone classes; empty rivalries shows "no active rivalries logged"; populated rivalries resolve `targetDriverId` correctly.
- **`contract-card.test.tsx`** — null contract shows free-agent fallback; expiring (`termEndSeason <= 1`) shows amber "EOS" pill; bonuses list renders; release clause renders "None" when null.
- **`penalty-card.test.tsx`** — clean state; warning-band states (3/6/9/12 thresholds); ban banner; grid-drop banner; entries sort newest first; expiry round computed correctly.
- **`scout-panel.test.tsx`** — sorted by composite; signal pill colors; File Report increments displayed count; Approach calls action.
- **`use-drivers-page-data.test.ts`** — fixture world produces correct roster, peer averages, championship summary, rivalry index, free-agent sort.
- **`drivers-page.test.tsx`** — smoke test: renders without errors with a fixture world; tab switching updates content; SCOUT tab renders panel.

### 4.8 IP-09b verification gates

- `npx tsc --noEmit` — clean
- `npx vitest run tests/components/drivers tests/hooks tests/lib` — clean
- `npm run lint` — clean
- `npm run dev` background, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/drivers --max-time 30` returns `200`
- **Visual review pass 1:** capture screenshot at 1440×900, compare side-by-side with `new-designs/drivers/Drivers Page.html` rendered locally. Diff list spacing/font/color/alignment mismatches.
- **Visual review pass 2:** apply fixes from pass 1, re-screenshot, re-diff. Stop when differences are minimal.
- `code-reviewer` agent invoked on the full IP-09 (a + b combined) at the end.
- `superpowers:receiving-code-review` invoked to action any CRITICAL/HIGH findings.

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Pre-seeded career stats become out-of-date as real F1 progresses | The seed values are documented inline in `data/drivers.ts` with a `// as of EOS 2025` comment. Future seasons (2027 grid, etc.) re-seed when the grid data is refreshed. |
| Pulse template branches feel repetitive across drivers in same condition | Branches are intentionally narrow; if multiple drivers hit the same branch (e.g., two championship leaders is impossible by design), the strings will match. This is acceptable — pulse is a status indicator, not a personalization feature. |
| Schema migration zeroes career stats for existing saves | Documented in migration: existing saves do not retroactively get real-world numbers. New games seeded from `data/drivers.ts` carry them. The migration is one-way; rolling back to a previous schema version is not supported (consistent with existing migration policy). |
| Broadcast sub-theme tokens drift from Kinetic Command tokens over time | The sub-theme is namespaced under `.drivers-broadcast`. A future ADR will be required to either promote it app-wide or sunset it. We add a comment in `drivers-broadcast.css` linking to this spec so the scoping is discoverable. |
| `JetBrains Mono` font loading adds latency on first `/drivers` visit | Loaded via `next/font/google` which inlines + self-hosts the font; subsequent navigations within the app are cached. First-paint delta is acceptable for a non-race-critical page. |
| Component count grows; pages get hard to reason about | Each component has a single responsibility (one card = one component). Hooks compose data; components render. The `frontend-design` skill is invoked before each new component so visual decisions are consistent. |
| Stub actions for `approachDriver` / `openContractNegotiation` confuse the player | Toast text is explicit: `"Approach tabled · negotiation flow coming soon"`. Tracked in `current-state-baseline.md` as known-temporary. |

---

## 6. Open Questions

1. **Real-world seed values for non-headline drivers** — values for drivers like Stroll, Lawson, Bortoleto are estimates from public records. **Resolution path:** the implementation plan (next step after this spec) opens with a 30-minute audit task that cross-checks every entry against statsf1.com/wikipedia and locks the table before any code is written. If a value is uncertain to within ±5 the audit rounds to the nearest 5 and notes the fuzz inline in `data/drivers.ts`.
2. **Pulse template wording polish** — the 13 templates above are the contract; the exact strings can be tuned during IP-09a implementation without re-spec'ing as long as the branching predicates and field substitutions are unchanged.
3. **Should `worldTitles` count be capped at 5 stars in the UI?** Mockup shows `Math.min(d.worldTitles, 5)` for star rendering. We keep this cap in `<DriverHero>` (purely presentational; the underlying number is uncapped).

---

## 7. Acceptance Criteria

A reviewer can confirm IP-09 is complete by checking:

1. `/drivers` page rendered against a fresh game with the player team set to any of the 11 teams shows the new layout with the team's color driving accents.
2. Verstappen's hero card shows `★★★★ 4× WORLD CHAMPION` and the career-stats trio shows `64 / 116 / 218`.
3. A rookie (Antonelli/Bortoleto) hero card shows neither stars nor career row, only first/last name, OVR, championship/season pulse, stats grid, and form bars.
4. The attributes card shows the player driver's bars filled with team color, the peer marker as a dashed amber line, and a delta chip per attribute.
5. The mood card with no rivalries renders the dashed empty state; with one or more rivalries, each row resolves to the target driver's code, name, team, intensity bar, and intensity number.
6. The contract card on a driver with `termEndSeason === 1` shows the amber "EOS" pill; on a driver with no contract, shows the free-agent fallback.
7. The penalty card on a clean driver shows the green check; on a driver with 9+ active penalty points, shows the warning band, the segment progress, the entries list (newest first), the warnings track, and any grid-drop banner.
8. The scout tab renders a sorted table; clicking `File Report` increments the displayed `#N` count and may upgrade the signal pill color (verifiable by reaching the 4-report and 8-report thresholds).
9. The `/drivers` route returns HTTP 200 in dev and renders without console errors.
10. Saving a game on the previous schema version, upgrading, and loading produces a working `/drivers` page with all new fields populated and correct types.
11. Engine purity: `python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine` reports no illegal imports.
12. `npx vitest run` produces all-green output across `tests/engine/drivers`, `tests/components/drivers`, `tests/hooks`, `tests/lib`, plus the migration test under `tests/engine/core`.
13. `npx tsc --noEmit` and `npm run lint` are clean.
14. Visual diff against `new-designs/drivers/Drivers Page.html` is minimal across two screenshot review passes.

---

## 8. Out-of-scope follow-ups (tracked, not implemented)

- Driver portrait image pipeline (CDN, art-direction, fallback hierarchy).
- Real contract-negotiation flow (multi-step modal, salary band negotiation, performance bonus authoring).
- Real `approachDriver` flow (free-agent negotiation, competing-team bidding war).
- Scout-network economy: weekly scouting budget, AI scout reports, region focus, scout staff hiring.
- Rivalry editing / event-driven creation: post-race incident → new rivalry, intensity decay over rounds.
- Mobile/responsive layout for `/drivers`.
- Adopting the broadcast sub-theme on Paddock / Factory / Strategy / Finance.
- Driver portrait crop/zoom controls for player-uploaded images.
