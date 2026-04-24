# Factory Page

**Route:** [/factory](src/app/factory/page.tsx)
**Theme:** Broadcast (telemetry pit-wall aesthetic, `data-theme="broadcast"`)
**Last updated:** 2026-04-24 (Phase A UI + Phase B Waves 1–4 engine wiring)

The Factory page is the player's R&D command centre. It surfaces the car's technical health (performance axes, power-unit allocation, aero-test allowances) and the long-term development pipeline (R&D tech tree + delivery queue). It is a pure client-rendered surface — all state is read from the Zustand `gameStore` via `useGameSlice`; there are no server components.

---

## 1. Page layout

The page is composed of six sections, stacked vertically inside a `.factory-shell` container (1760px max). All section names below correspond to both the visual block in `Factory Page.html` (the reference design) and the component file that renders it.

```
┌─────────────────────────────────────────────────────────────────┐
│ FactoryHeader         ◉ FACTORY · WOKING · R07 | Budget strip   │  header
├──────────────┬──────────────────────┬───────────────────────────┤
│ CarPerformance│  PowerUnit           │  Aero                     │  hero
│ Card         │  Card                 │  Card                     │
├──────────────┴──────────────────────┴───────────────────────────┤
│ RdPipelineHeader       R&D Pipeline | Next Delivery             │
├─────────────────────────────────────────────────────────────────┤
│ RdQueue                # UPGRADE · BRANCH · ETA · PROGRESS      │
├─────────────────────────────────────────────────────────────────┤
│ TechTree               CHASSIS | POWER UNIT | ACTIVE AERO       │
└─────────────────────────────────────────────────────────────────┘
```

### Section → component map

| Section | Component | Purpose |
|---|---|---|
| Header | [factory-header.tsx](src/components/factory/factory-header.tsx) | Team HQ city, round, budget cap / spent / remaining |
| Car Performance | [car-performance-card.tsx](src/components/factory/car-performance-card.tsx) | OVR, 6-race trend, peer rank, radar + per-axis vs-peer delta |
| Power Unit | [power-unit-card.tsx](src/components/factory/power-unit-card.tsx) | Fleet health, next-change projection, per-element dot grid |
| Aero | [aero-card.tsx](src/components/factory/aero-card.tsx) | WT / CFD usage, 14-day booking histograms, ATR coefficient |
| R&D Pipeline header | [rd-pipeline-header.tsx](src/components/factory/rd-pipeline-header.tsx) | Count summary + Next Delivery callout |
| R&D Queue | [rd-queue.tsx](src/components/factory/rd-queue.tsx) | Ordered list of in-progress + queued upgrades |
| Tech Tree | [tech-tree.tsx](src/components/factory/tech-tree.tsx) + [branch-header.tsx](src/components/factory/branch-header.tsx) + [tech-node.tsx](src/components/factory/tech-node.tsx) | 3-column branch layout (Chassis / Power Unit / Active Aero) |
| Stylesheet | [src/styles/factory.css](src/styles/factory.css) | Broadcast-theme-scoped styles, inherits `--sig-*` tokens from [themes/broadcast.css](src/styles/themes/broadcast.css) |

---

## 2. Data flow

Each card pulls from either persisted `world` state or a pure helper in [src/engine/engineering/factory-insights.ts](src/engine/engineering/factory-insights.ts). The page itself is a thin composition layer — no game logic runs in `page.tsx`.

### Header strip
| Field | Source |
|---|---|
| Team name | `team.name` |
| Location | `team.headquarters` (schema v5) |
| Round | `gameState.currentRound` |
| Budget cap | `finance[teamId].budget.cap` |
| Spent | `finance[teamId].budget.totalSpent` |

### Car Performance card
| Field | Source | Type |
|---|---|---|
| OVR | `calculateOverallRating(team.car)` | Derived |
| 6-race trend sparkline | `team.ovrHistory` (schema v6) | Persisted |
| Peer rank | `peerRank(teams, playerTeamId)` → `team.constructorPosition` | Derived |
| Peer-averaged radar axes | `peerAveragedAxes(teams, playerTeamId)` | Derived |
| Δ vs leader | `deltaVsLeaderSeconds(teams, playerTeamId)` | Derived |
| Reliability MTBF | `reliabilityMtbf(team.car, team.components)` | Derived |
| Last Upgrade round | `team.lastUpgradeRound` (schema v6) | Persisted |

### Power Unit card
| Field | Source | Type |
|---|---|---|
| Per-element rows | `team.components` (5-element set, schema v7) | Persisted |
| Fleet Health (NOMINAL / AT RISK / CRITICAL) | `fleetHealth(components)` | Derived |
| Total components remaining | Inline sum of `limit - used` | Derived |
| Next change (round + element) | `projectNextChange(components, currentRound, totalRaces)` | Derived |
| Projected grid loss | `projectedGridLoss(components)` → sum of `getGridPenalty` | Derived |
| Penalties Taken | **Deferred** — always `0` for now (see §5) | Placeholder |

### Aero card
| Field | Source | Type |
|---|---|---|
| Wind Tunnel used / limit | `team.windTunnelHoursUsed` / `...Limit` | Persisted |
| CFD used / limit | `team.cfdRunsUsed` / `team.cfdRunsLimit` | Persisted |
| 14-day WT histogram | `deterministicAeroHistory(teamId, round, wtRatio)` | Derived |
| 14-day CFD histogram | `deterministicAeroHistory(teamId, round + 100, cfdRatio)` | Derived (offset so WT and CFD bars don't mirror) |
| ATR coefficient | `atrCoefficientForPosition(team.constructorPosition)` | Derived — F1 2026 sliding scale, 1st place 0.70× → 11th place 1.00× |
| Correlation Δ | `correlationDelta(teamId, round)` | Derived — deterministic hash, ±5% |
| Next Delivery | `nextDeliveryRound(rndUpgrades, currentRound).round` | Derived |
| Window resets (D-countdown) | `windowResetsIn(currentRound)` | Derived |

### R&D Pipeline header & queue
| Field | Source |
|---|---|
| Count summary (`15 UPGRADES · 3 BRANCHES · 1 ACTIVE · 3 QUEUED`) | Tallies over `team.rndUpgrades` |
| Next Delivery label | `playerTeam.rndUpgrades[nextDelivery.upgradeId].name` |
| Queue rows (ordered by in-progress → queued → ETA) | `team.rndUpgrades` filtered by status |
| Per-row ETA round | `currentRound + ceil((100 - progress) / 100 * developmentRaces)` |

### Tech Tree
| Field | Source |
|---|---|
| Per-branch `{completed, total, active}` counts | Tallies over `team.rndUpgrades` by `branch` |
| Per-node status (`locked` / `available` / `in-progress` / `queued` / `complete`) | `upgrade.status` — mutated by engine/UI actions |
| TD Pick highlight | `recommendations` filtered by `role === 'technical-director' && action.startsWith('start-rnd:')` (IP-08) |
| Start / Pause buttons | Dispatch `gameStore.allocateRnD(id)` / `pauseRnD(id)` |

---

## 3. R&D lifecycle

The R&D system is the Factory page's central gameplay loop. It runs once per management phase, just before the race weekend begins.

```
 ┌─────────────┐    1× per management entry    ┌─────────────────┐
 │  TechTree   │  ─────────────────────────►   │ processRnDCycle │
 │ (available) │   user clicks Start →         │  advanceRnD +   │
 │             │   action dispatches           │  unlockDependents│
 └──────┬──────┘                                └─────────┬───────┘
        │                                                 │
        │ allocateRnD(id)                                 │ status === 'in-progress'
        ▼                                                 │ progress += 100 / developmentRaces
 ┌─────────────┐                                          ▼
 │   Queue     │  ◄───────────  ┌─────────────────────────────────┐
 │ (in-progress│                │  Per cycle, any upgrade that    │
 │  + queued)  │                │  crosses 100% transitions to    │
 └─────────────┘                │  'complete' AND                 │
                                │  orchestrator stamps            │
                                │  team.lastUpgradeRound          │
                                └─────────────────┬───────────────┘
                                                  │
                                                  ▼
                                ┌─────────────────────────────────┐
                                │  unlockDependents():             │
                                │  any locked upgrade whose        │
                                │  prerequisiteIds are all         │
                                │  complete flips to 'available'   │
                                └──────────────────────────────────┘
```

### Key hook points
- **Start/Pause:** [src/stores/game-store.ts](src/stores/game-store.ts) → `allocateRnD` / `pauseRnD` → pure helpers `startUpgrade` / `pauseUpgrade` in [src/engine/engineering/rnd-engine.ts](src/engine/engineering/rnd-engine.ts)
- **Advance:** [src/engine/core/orchestrator.ts](src/engine/core/orchestrator.ts) → `processManagementEntry` → `processRnDCycle`
- **Completion detection:** The orchestrator compares each `updatedUpgrades[i].status === 'complete'` against the prior state; if any transition is new, `team.lastUpgradeRound` is set to `gameState.currentRound`. Same diff is applied to AI teams after `processAllAITeams` returns.
- **Performance application:** Completed upgrades contribute to [calculateCarPerformance](src/engine/engineering/car-performance.ts). OVR is recomputed on every call — not cached.
- **Season reset:** [src/engine/core/season-end-processor.ts](src/engine/core/season-end-processor.ts) resets every in-progress / queued upgrade back to `available` and zeroes `windTunnelHoursUsed`, `cfdRunsUsed`, `ovrHistory`, `lastUpgradeRound`.

---

## 4. Persisted vs derived — at a glance

The Factory page introduced four new persisted fields across Phase B. Everything else is computed on-render.

### Persisted (part of `world`, flows through autosave)
- `team.headquarters: string` — schema v5
- `team.ovrHistory: number[]` (capped at `OVR_HISTORY_WINDOW` = 12) — schema v6
- `team.lastUpgradeRound: number` — schema v6
- `team.components[*]` — now a 5-element set via schema v7 (adds `mgu-k`)

### Derived each render (no persistence)
- Peer-averaged axes, peer rank, Δ vs leader
- Fleet Health, projected next change, projected grid loss
- Reliability MTBF (from `car.reliability` + component wear ratio)
- Aero daily histograms (deterministic hash of team id + round + usage ratio)
- ATR coefficient, correlation Δ, window-reset countdown, next-delivery round

---

## 5. Schema migrations

All four waves preserve IP-04 Option A (race runtime stays outside `world`) and the autosave trigger rule (`world !== prevWorld`). Migration contracts are in [docs/architecture/persistence-contract.md](docs/architecture/persistence-contract.md) §5.

| Version | Wave | Adds | Notes |
|---|---|---|---|
| v4 → v5 | Wave 2 | `team.headquarters` | Back-fills from canonical team-id map; falls back to `shortName` |
| v5 → v6 | Wave 3 | `team.ovrHistory: []`, `team.lastUpgradeRound: 0` | Empty defaults; repopulates via post-race + orchestrator hooks |
| v6 → v7 | Wave 4 | `team.components` 4 → 5 elements (adds `mgu-k`) | Drops any legacy `mgu-h` row (MGU-H is removed per 2026 regs, CLAUDE.md §7) |

Each migration is pure and idempotent — existing values pass through verbatim.

### Deferred: `team.penaltiesTaken`

The PU card prop `penaltiesTaken` is hard-coded to `0`. The field was not added to `Team` because the component-swap lifecycle (race-weekend event that triggers a grid penalty) does not yet exist in the race flow. `useComponent`, `calculateTotalPenalty`, and `checkMechanicalFailure` in [component-lifecycle.ts](src/engine/engineering/component-lifecycle.ts) are defined but never called from the orchestrator, race worker, or phase handlers. Adding a persisted field without its upstream event would give a forever-zero value — worse than a visible placeholder. When the race-weekend component lifecycle is built, wire the penalty increment through `post-race-processor.ts` or a dedicated pre-race hook, add `team.penaltiesTaken: number` with a new schema bump, and remove this note.

---

## 6. Styling

All factory-specific styles are scoped to `.factory-shell` and descendant classes in [src/styles/factory.css](src/styles/factory.css). The file inherits broadcast-theme CSS variables (`--sig-red`, `--sig-cyan`, `--sig-purple`, `--sig-green`, `--sig-amber`, `--ink-*`, `--bg-*`) from [src/styles/themes/broadcast.css](src/styles/themes/broadcast.css) and relies on `[data-theme="broadcast"]` being set on the `PageShell` wrapper.

**Key patterns used**
- Glassmorphic panels via `.fac-panel` (background layered with radial gradient)
- Radar with peer overlay (dashed amber path, solid red player path)
- Dot-grid component allocation (fill tier by used/limit ratio: green → amber → red with pulse)
- 14-day aero histogram using `grid-template-columns: repeat(14, 1fr)` and per-day scale via `--fill` CSS var
- Tech-node left-rail colour mirrors branch accent (green / cyan / purple)
- TD Pick highlight uses `box-shadow: 0 0 0 1px var(--sig-cyan)` (no transitions — spec says animate `transform` / `opacity` only)

---

## 7. Testing

| Layer | File | Scope |
|---|---|---|
| Pure helpers | [tests/engine/engineering/factory-insights.test.ts](tests/engine/engineering/factory-insights.test.ts) | All 10 helpers with edge cases (29 tests) |
| Post-race OVR append | [tests/engine/core/post-race-paddock.test.ts](tests/engine/core/post-race-paddock.test.ts) | First-append, idempotency, window cap |
| Orchestrator R&D stamping | [tests/engine/core/orchestrator.test.ts](tests/engine/core/orchestrator.test.ts) | Player completion, no-op case, AI-team completion |
| Schema migrations | [tests/engine/core/save-system.test.ts](tests/engine/core/save-system.test.ts) | v4→v5 (3 cases), v5→v6 (2 cases), v6→v7 (3 cases incl. legacy mgu-h drop) |
| Initial state shape | [tests/engine/core/state-manager.test.ts](tests/engine/core/state-manager.test.ts) | Every team ships with 5-element PU in canonical order |

Run: `npx vitest run tests/engine/engineering tests/engine/core`

---

## 8. Key file reference

```
src/
├── app/factory/page.tsx                         — composition + slice read
├── components/factory/
│   ├── factory-header.tsx                       — header strip
│   ├── car-performance-card.tsx                 — radar + trend + foot
│   ├── power-unit-card.tsx                      — PU dot grid + health
│   ├── aero-card.tsx                            — WT / CFD histograms
│   ├── rd-pipeline-header.tsx                   — R&D title + next delivery
│   ├── rd-queue.tsx                             — ordered queue table
│   ├── branch-header.tsx                        — per-branch big label
│   ├── tech-tree.tsx                            — 3-column orchestration
│   └── tech-node.tsx                            — single upgrade card
├── engine/engineering/
│   ├── factory-insights.ts                      — 10 pure helpers (Wave 1 + 3)
│   ├── car-performance.ts                       — rating + delta application
│   ├── component-lifecycle.ts                   — grid penalty math (unwired — see §5)
│   └── rnd-engine.ts                            — tree transitions
├── engine/drivers/form-history.ts               — OVR_HISTORY_WINDOW + pushOvrSample
├── engine/core/
│   ├── orchestrator.ts                          — R&D cycle + lastUpgradeRound stamp
│   ├── post-race-processor.ts                   — ovrHistory append
│   └── save-system.ts                           — SCHEMA_VERSION 7 + migrations
└── styles/factory.css                           — broadcast-scoped styles
```
