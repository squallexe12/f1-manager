# Mission Control: F1 Kinetic Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based F1 management simulation game where players act as Team Principal, making decisions across engineering, drivers, finance, and race operations through a multi-season career.

**Architecture:** Client-side Next.js 15 app with all game logic running in-browser. Game state persisted in IndexedDB. Race simulation runs in a Web Worker to keep UI responsive. Zustand for client state management. No backend server needed for MVP.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), Tailwind CSS 4, Framer Motion, Recharts, Zustand, IndexedDB (idb library), Web Workers, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-04-mission-control-design.md`

---

## File Map

### Foundation Layer
| File | Responsibility |
|------|---------------|
| `src/types/game.ts` | Core game types: GameState, Phase, Season, Round |
| `src/types/team.ts` | Team, Car, CarPerformance, Staff, DepartmentHead |
| `src/types/driver.ts` | Driver, DriverAttributes, Mood, Contract, Rivalry |
| `src/types/race.ts` | Race, Circuit, Lap, TireCompound, Strategy, Weather |
| `src/types/finance.ts` | Budget, Sponsor, SponsorKPI, PrestigeRating |
| `src/types/narrative.ts` | NarrativeEvent, EventThread, StoryArc, Severity |
| `src/engine/core/prng.ts` | Seeded pseudo-random number generator |
| `src/engine/core/state-manager.ts` | Game state initialization, phase transitions |
| `src/engine/core/save-system.ts` | IndexedDB persistence, save/load, schema migration |

### Static Game Data
| File | Responsibility |
|------|---------------|
| `src/data/teams.ts` | 11 constructor definitions with base stats |
| `src/data/drivers.ts` | 22+ driver definitions with attributes |
| `src/data/circuits.ts` | 22 circuit definitions with characteristics |
| `src/data/scenarios.ts` | 4 starting scenario definitions |
| `src/data/rnd-tree.ts` | R&D tech tree: 3 branches, ~12 upgrades with dependencies |
| `src/data/sponsors.ts` | Sponsor pool with tiers and KPI definitions |
| `src/data/events/templates.ts` | Narrative event templates for all 6 threads |

### Simulation Engines
| File | Responsibility |
|------|---------------|
| `src/engine/engineering/rnd-engine.ts` | R&D progress calculation, unlock checks |
| `src/engine/engineering/component-lifecycle.ts` | PU element allocation, failure probability |
| `src/engine/engineering/car-performance.ts` | Calculate 6-axis car performance from upgrades |
| `src/engine/race/tire-model.ts` | Tire degradation curves per compound/circuit |
| `src/engine/race/race-simulator.ts` | Lap-by-lap race simulation core |
| `src/engine/race/pit-strategy.ts` | Undercut/optimum/overcut calculation |
| `src/engine/race/weather.ts` | Weather state machine (dry→damp→wet) |
| `src/engine/race/overtake.ts` | Overtake probability from car delta + racecraft |
| `src/engine/drivers/driver-model.ts` | Attribute effects on race performance |
| `src/engine/drivers/mood-system.ts` | Mood transitions from race results + events |
| `src/engine/drivers/aging.ts` | Season-over-season attribute changes |
| `src/engine/drivers/contract-engine.ts` | Contract evaluation, negotiation logic |
| `src/engine/finance/budget-engine.ts` | Spend tracking, cap enforcement, penalties |
| `src/engine/finance/sponsor-engine.ts` | KPI evaluation, sponsor satisfaction |
| `src/engine/finance/prestige.ts` | Prestige rating calculation |
| `src/engine/narrative/event-generator.ts` | Condition→event matching, expiration |
| `src/engine/narrative/story-arc-tracker.ts` | Multi-race arc state machine |
| `src/engine/delegation/department-ai.ts` | Auto-decisions for 4 department heads |
| `src/engine/ai/ai-team-engine.ts` | AI opponent decision-making |
| `src/workers/race-sim-worker.ts` | Web Worker wrapper for race simulator |

### Stores
| File | Responsibility |
|------|---------------|
| `src/stores/game-store.ts` | Core game state, phase transitions, save/load triggers |
| `src/stores/ui-store.ts` | Active page, selected driver, modal state |
| `src/stores/settings-store.ts` | User preferences (sim speed, high contrast, reduced motion) |

### UI Components
| File | Responsibility |
|------|---------------|
| `src/components/ui/button.tsx` | Styled button with variants (primary/secondary/danger) |
| `src/components/ui/card.tsx` | Glassmorphic card container |
| `src/components/ui/badge.tsx` | Status badge with color variants |
| `src/components/ui/progress-bar.tsx` | Horizontal progress bar with accent colors |
| `src/components/ui/donut-chart.tsx` | Circular progress (wind tunnel, CFD) |
| `src/components/ui/tooltip.tsx` | Information tooltip |
| `src/components/charts/radar-chart.tsx` | 6-axis car/driver performance radar |
| `src/components/charts/degradation-curve.tsx` | Tire degradation SVG chart |
| `src/components/charts/gap-chart.tsx` | Race gap visualization |
| `src/components/layout/nav-bar.tsx` | 7-screen bottom navigation |
| `src/components/layout/top-bar.tsx` | Team name, season/round, race countdown |
| `src/components/layout/page-shell.tsx` | Page wrapper with top bar + nav |
| `src/components/paddock/health-widget.tsx` | Single metric widget (position, budget, etc.) |
| `src/components/paddock/driver-summary-card.tsx` | Driver name, WDC, morale on dashboard |
| `src/components/paddock/paddock-feed.tsx` | Color-coded scrollable event feed |
| `src/components/paddock/feed-item.tsx` | Single feed item with actions |
| `src/components/paddock/department-panel.tsx` | Department head status overview |
| `src/components/factory/tech-tree.tsx` | 3-branch R&D tree visualization |
| `src/components/factory/tech-node.tsx` | Single R&D node (complete/progress/locked) |
| `src/components/factory/component-status.tsx` | PU allocation bars |
| `src/components/factory/aero-allocation.tsx` | Wind tunnel + CFD donut charts |
| `src/components/drivers/driver-profile.tsx` | Full driver card with radar + stats |
| `src/components/drivers/mood-tracker.tsx` | Mood indicator with history |
| `src/components/drivers/contract-panel.tsx` | Contract details and negotiation UI |
| `src/components/drivers/scout-panel.tsx` | Available drivers list for scouting |
| `src/components/strategy/timing-tower.tsx` | Live timing with gaps + sectors |
| `src/components/strategy/tire-strategy.tsx` | Degradation curve + pit window + strategy options |
| `src/components/strategy/commentary-feed.tsx` | Color-coded narrative race feed |
| `src/components/strategy/battle-forecast.tsx` | Overtake probability bars |
| `src/components/strategy/driver-commands.tsx` | Push/Standard/Conserve/Pit buttons |
| `src/components/strategy/race-status-bar.tsx` | Weather, track temp, SC, PU stress |
| `src/components/strategy/sim-speed-control.tsx` | 1x/2x/5x/MAX/Pause buttons |
| `src/components/finance/budget-tracker.tsx` | Spend vs cap with category breakdown |
| `src/components/finance/sponsor-card.tsx` | Sponsor with KPI progress |
| `src/components/finance/prestige-meter.tsx` | A+ to F rating display |

### Pages
| File | Responsibility |
|------|---------------|
| `src/app/layout.tsx` | Root layout: fonts, global styles, providers |
| `src/app/page.tsx` | Landing: new game / continue / load |
| `src/app/new-game/page.tsx` | Team selection + scenario picker |
| `src/app/paddock/page.tsx` | Dashboard: widgets, drivers, feed, departments |
| `src/app/factory/page.tsx` | Engineering: radar, components, tech tree, aero |
| `src/app/drivers/page.tsx` | Driver office: roster, mood, contracts, scouting |
| `src/app/strategy/page.tsx` | Strategy room: practice/quali/race phases |
| `src/app/finance/page.tsx` | Financial HQ: budget, sponsors, prestige |
| `src/app/calendar/page.tsx` | Season calendar with race cards |
| `src/app/regulations/page.tsx` | Rules summary + technical directives (read-only MVP) |

### Styles & Config
| File | Responsibility |
|------|---------------|
| `src/styles/tokens.css` | CSS custom properties for Kinetic Command design system |
| `tailwind.config.ts` | Tailwind theme extension with design tokens |
| `vitest.config.ts` | Test configuration |
| `tsconfig.json` | TypeScript strict config |

---

## Task 1: Project Scaffolding & Design System

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`, `next.config.ts`, `postcss.config.js`
- Create: `src/styles/tokens.css`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `public/fonts/` (font files)

- [ ] **Step 1: Initialize Next.js project**

```bash
cd "c:/Users/kapsi/OneDrive/Masaüstü/f1-simulation"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --yes
```

- [ ] **Step 2: Install dependencies**

```bash
npm install zustand framer-motion recharts idb
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `tests/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create design tokens**

Create `src/styles/tokens.css`:
```css
@layer base {
  :root {
    --bg-primary: #0A0A0A;
    --bg-secondary: #111111;
    --bg-surface: rgba(255, 255, 255, 0.03);
    --border-default: rgba(255, 255, 255, 0.06);
    --border-hover: rgba(255, 255, 255, 0.12);
    --accent-lime: #CCFF00;
    --accent-cyan: #00E5FF;
    --accent-red: #FF3B30;
    --accent-amber: #FFC800;
    --accent-purple: #B450FF;
    --text-primary: #FFFFFF;
    --text-secondary: #AAAAAA;
    --text-muted: #888888;
    --text-dim: #555555;
    --font-heading: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }
}
```

- [ ] **Step 5: Extend Tailwind config with design tokens**

Update `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          surface: 'var(--bg-surface)',
        },
        border: {
          default: 'var(--border-default)',
          hover: 'var(--border-hover)',
        },
        accent: {
          lime: 'var(--accent-lime)',
          cyan: 'var(--accent-cyan)',
          red: 'var(--accent-red)',
          amber: 'var(--accent-amber)',
          purple: 'var(--accent-purple)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 6: Create root layout with fonts and dark theme**

Update `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import '../styles/tokens.css'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MISSION CONTROL | F1 Kinetic Command',
  description: 'F1 Management Simulation — Command Your Constructor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg-primary text-text-primary font-body antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Create placeholder landing page**

Update `src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-accent-lime text-xs tracking-[4px] mb-4 font-mono">MISSION CONTROL</p>
        <h1 className="text-4xl font-heading font-bold mb-2">F1 Kinetic Command</h1>
        <p className="text-text-muted">Loading systems...</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Update globals.css for dark theme baseline**

Update `src/app/globals.css`:
```css
@import 'tailwindcss';

* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

body {
  min-height: 100vh;
}
```

- [ ] **Step 9: Verify app starts**

```bash
npm run dev
```
Expected: App runs on localhost:3000, dark background, "MISSION CONTROL" heading visible.

- [ ] **Step 10: Verify tests run**

```bash
npx vitest run
```
Expected: Test runner initializes (0 tests found is OK at this stage).

- [ ] **Step 11: Commit**

```bash
git init
echo "node_modules\n.next\n.env.local\n.superpowers" > .gitignore
git add -A
git commit -m "feat: project scaffolding with Next.js 15, Tailwind, design tokens"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/game.ts`, `src/types/team.ts`, `src/types/driver.ts`, `src/types/race.ts`, `src/types/finance.ts`, `src/types/narrative.ts`

- [ ] **Step 1: Create core game types**

Create `src/types/game.ts`:
```typescript
export type Phase =
  | 'management'
  | 'practice'
  | 'sprint-qualifying'
  | 'sprint'
  | 'qualifying'
  | 'race'
  | 'post-race'
  | 'season-end'

export type ScenarioType = 'golden-era' | 'rebuild' | 'newcomer' | 'crisis'

export interface GameState {
  season: number
  currentRound: number
  phase: Phase
  playerTeamId: string
  scenario: ScenarioType
  seed: number
  totalRaces: number
}

export interface SaveSlot {
  id: string
  name: string
  gameState: GameState
  timestamp: number
  schemaVersion: number
}
```

- [ ] **Step 2: Create team types**

Create `src/types/team.ts`:
```typescript
export interface CarPerformance {
  downforce: number      // 0-100
  straightSpeed: number  // 0-100
  reliability: number    // 0-100
  tireManagement: number // 0-100
  braking: number        // 0-100
  cornering: number      // 0-100
}

export interface DepartmentHead {
  name: string
  role: 'technical-director' | 'race-engineer' | 'commercial-director' | 'team-manager'
  skill: number // 1-100
  currentFocus: string
  flaggedIssue: string | null
}

export interface RndUpgrade {
  id: string
  branch: 'chassis' | 'power-unit' | 'active-aero'
  name: string
  description: string
  progress: number    // 0-100
  status: 'locked' | 'available' | 'in-progress' | 'queued' | 'complete'
  cost: number
  developmentRaces: number // races to complete
  performanceDelta: Partial<CarPerformance>
  prerequisiteIds: string[]
}

export interface ComponentAllocation {
  element: 'ice' | 'turbo' | 'ers-battery' | 'gearbox'
  used: number
  limit: number
  failureProbability: number
}

export interface AiPersonality {
  aggressiveness: number  // 0-1
  financialDiscipline: number // 0-1
  driverFocus: number // 0-1
}

export interface Team {
  id: string
  name: string
  shortName: string
  color: string
  powerUnitSupplier: string
  driverIds: [string, string]
  reserveDriverId: string | null
  staff: DepartmentHead[]
  car: CarPerformance
  rndUpgrades: RndUpgrade[]
  components: ComponentAllocation[]
  windTunnelHoursUsed: number
  windTunnelHoursLimit: number
  cfdRunsUsed: number
  cfdRunsLimit: number
  morale: number
  aiPersonality: AiPersonality | null // null for player team
  constructorPoints: number
  constructorPosition: number
}
```

- [ ] **Step 3: Create driver types**

Create `src/types/driver.ts`:
```typescript
export interface DriverAttributes {
  pace: number          // 0-100
  racecraft: number     // 0-100
  experience: number    // 0-100
  mentality: number     // 0-100
  marketability: number // 0-100
  developmentPotential: number // 0-100
}

export interface Mood {
  motivation: number   // 0-100
  frustration: number  // 0-100
  confidence: number   // 0-100
}

export interface Contract {
  salary: number
  termEndSeason: number
  performanceBonuses: { condition: string; value: number }[]
  releaseClause: number | null
}

export interface Rivalry {
  targetDriverId: string
  intensity: number // 0-100
  cause: string
}

export interface SeasonStats {
  points: number
  wins: number
  podiums: number
  dnfs: number
  penalties: number
  bestFinish: number
  averageFinish: number
}

export interface Driver {
  id: string
  firstName: string
  lastName: string
  shortName: string // 3-letter abbreviation
  nationality: string
  age: number
  teamId: string | null
  attributes: DriverAttributes
  mood: Mood
  contract: Contract | null
  seasonStats: SeasonStats
  rivalries: Rivalry[]
  peakAge: number
  declineRate: number
  isReserve: boolean
  isF2: boolean
}
```

- [ ] **Step 4: Create race types**

Create `src/types/race.ts`:
```typescript
export type TireCompound = 'C1' | 'C2' | 'C3' | 'C4' | 'C5'
export type TireLabel = 'hard' | 'medium' | 'soft'
export type WeatherState = 'dry' | 'damp' | 'wet'
export type DriverCommand = 'push' | 'standard' | 'conserve' | 'overtake' | 'defend' | 'pit'

export interface Circuit {
  id: string
  name: string
  country: string
  laps: number
  downforceLevel: 'low' | 'medium' | 'high'
  tireWear: 'low' | 'medium' | 'high'
  overtakingDifficulty: 'low' | 'medium' | 'high'
  weatherVariability: 'low' | 'medium' | 'high'
  sectorCount: number
  compounds: [TireCompound, TireCompound, TireCompound] // selected by Pirelli
}

export interface Race {
  id: string
  name: string
  circuit: Circuit
  round: number
  isSprint: boolean
}

export interface TireState {
  compound: TireCompound
  label: TireLabel
  wear: number // 0-100 (100 = new)
  lapsFitted: number
}

export interface LapResult {
  lap: number
  driverId: string
  lapTime: number
  sector1: number
  sector2: number
  sector3: number
  position: number
  gapToLeader: number
  gapToAhead: number
  tire: TireState
  pitted: boolean
}

export interface RaceStrategy {
  driverId: string
  plannedStops: { lap: number; compound: TireCompound }[]
  currentCommand: DriverCommand
}

export interface StrategyOption {
  type: 'undercut' | 'optimum' | 'overcut'
  pitLap: number
  newCompound: TireCompound
  projectedOutcome: string
  probability: number // chance of gaining position
  risk: string
}

export interface BattleForecast {
  attackerId: string
  defenderId: string
  overtakeProbability: number
  estimatedLaps: number
  description: string
}

export interface WeatherForecast {
  current: WeatherState
  rainProbability: number
  changeInLaps: number | null
}

export interface RaceState {
  currentLap: number
  totalLaps: number
  weather: WeatherForecast
  safetyCar: 'green' | 'vsc' | 'sc'
  trackTemp: number
  results: LapResult[][]  // [lap][driver]
  incidents: RaceIncident[]
  commentary: CommentaryEntry[]
}

export interface RaceIncident {
  lap: number
  type: 'crash' | 'mechanical' | 'penalty' | 'safety-car' | 'weather-change'
  driverIds: string[]
  description: string
}

export interface CommentaryEntry {
  lap: number
  text: string
  severity: 'critical' | 'highlight' | 'radio' | 'info' | 'neutral'
}

export type SimSpeed = 1 | 2 | 5 | 'max'

export type WorkerInMessage =
  | { type: 'start'; raceState: RaceState; strategies: RaceStrategy[]; seed: number }
  | { type: 'setSpeed'; speed: SimSpeed }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'command'; driverId: string; command: DriverCommand }
  | { type: 'strategyChange'; driverId: string; strategy: RaceStrategy }

export type WorkerOutMessage =
  | { type: 'lapUpdate'; lap: number; results: LapResult[]; tireStates: Record<string, TireState>; weather: WeatherForecast; safetyCar: string }
  | { type: 'commentary'; entries: CommentaryEntry[] }
  | { type: 'incident'; incident: RaceIncident }
  | { type: 'raceEnd'; finalResults: LapResult[]; fastestLap: { driverId: string; time: number } }
```

- [ ] **Step 5: Create finance types**

Create `src/types/finance.ts`:
```typescript
export type PrestigeRating = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
export type SponsorTier = 'title' | 'major' | 'minor'

export interface SponsorKPI {
  description: string
  target: number
  current: number
  met: boolean
}

export interface Sponsor {
  id: string
  name: string
  tier: SponsorTier
  annualValue: number
  bonusValue: number
  kpis: SponsorKPI[]
  satisfaction: number // 0-100
  contractEndSeason: number
  minimumPrestige: PrestigeRating
}

export interface BudgetCategory {
  name: string
  allocated: number
  spent: number
}

export interface Budget {
  cap: number // $215M
  totalSpent: number
  categories: BudgetCategory[]
  projectedEndOfSeason: number
  penaltyRisk: boolean
}

export interface FinanceState {
  budget: Budget
  sponsors: Sponsor[]
  prestige: PrestigeRating
  prestigeScore: number // 0-100 maps to letter grade
  prizeMoneyEstimate: number
  marketingBudget: number
}
```

- [ ] **Step 6: Create narrative types**

Create `src/types/narrative.ts`:
```typescript
export type EventThread =
  | 'driver-rivalry'
  | 'media-pressure'
  | 'poaching-politics'
  | 'sponsor-drama'
  | 'paddock-scandal'
  | 'multi-race-arc'

export type EventSeverity = 'breaking' | 'decision' | 'technical' | 'rumor' | 'news'

export interface EventOption {
  id: string
  text: string
  consequences: EventConsequence[]
}

export interface EventConsequence {
  type: 'morale' | 'mood' | 'budget' | 'prestige' | 'performance' | 'relationship' | 'staff'
  targetId?: string
  delta: number
  description: string
}

export interface NarrativeEvent {
  id: string
  thread: EventThread
  severity: EventSeverity
  headline: string
  body: string
  options: EventOption[] | null // null = informational only
  defaultOutcome: EventConsequence[] | null
  arcId: string | null
  triggeredAtRound: number
  expiresAtRound: number | null
  resolved: boolean
}

export type ArcStage = 'building' | 'escalating' | 'climax' | 'resolution'

export interface StoryArc {
  id: string
  thread: EventThread
  title: string
  description: string
  stage: ArcStage
  startedAtRound: number
  involvedDriverIds: string[]
  involvedTeamIds: string[]
  eventIds: string[]
}
```

- [ ] **Step 7: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for all game systems"
```

---

## Task 3: Seeded PRNG & Core Engine Utilities

**Files:**
- Create: `src/engine/core/prng.ts`
- Test: `tests/engine/core/prng.test.ts`

- [ ] **Step 1: Write failing test for PRNG**

Create `tests/engine/core/prng.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { createPRNG } from '@/engine/core/prng'

describe('createPRNG', () => {
  it('produces deterministic results from same seed', () => {
    const rng1 = createPRNG(12345)
    const rng2 = createPRNG(12345)
    const results1 = Array.from({ length: 10 }, () => rng1.next())
    const results2 = Array.from({ length: 10 }, () => rng2.next())
    expect(results1).toEqual(results2)
  })

  it('produces different results from different seeds', () => {
    const rng1 = createPRNG(12345)
    const rng2 = createPRNG(54321)
    expect(rng1.next()).not.toEqual(rng2.next())
  })

  it('returns values between 0 and 1', () => {
    const rng = createPRNG(42)
    for (let i = 0; i < 100; i++) {
      const val = rng.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it('range() returns values in specified range', () => {
    const rng = createPRNG(42)
    for (let i = 0; i < 100; i++) {
      const val = rng.range(10, 20)
      expect(val).toBeGreaterThanOrEqual(10)
      expect(val).toBeLessThanOrEqual(20)
    }
  })

  it('chance() returns boolean based on probability', () => {
    const rng = createPRNG(42)
    expect(rng.chance(1.0)).toBe(true)
    expect(rng.chance(0.0)).toBe(false)
  })

  it('pick() selects from array', () => {
    const rng = createPRNG(42)
    const items = ['a', 'b', 'c']
    const picked = rng.pick(items)
    expect(items).toContain(picked)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/core/prng.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PRNG**

Create `src/engine/core/prng.ts`:
```typescript
// Mulberry32 — fast, deterministic 32-bit PRNG
export interface PRNG {
  next(): number
  range(min: number, max: number): number
  chance(probability: number): boolean
  pick<T>(array: T[]): T
  shuffle<T>(array: T[]): T[]
}

export function createPRNG(seed: number): PRNG {
  let state = seed | 0

  function next(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min)
    },
    chance(probability: number): boolean {
      return next() < probability
    },
    pick<T>(array: T[]): T {
      return array[Math.floor(next() * array.length)]
    },
    shuffle<T>(array: T[]): T[] {
      const result = [...array]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/core/prng.test.ts
```
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/core/prng.ts tests/engine/core/prng.test.ts
git commit -m "feat: add deterministic seeded PRNG (Mulberry32)"
```

---

## Task 4: Static Game Data

**Files:**
- Create: `src/data/teams.ts`, `src/data/drivers.ts`, `src/data/circuits.ts`, `src/data/scenarios.ts`, `src/data/rnd-tree.ts`, `src/data/sponsors.ts`
- Test: `tests/data/data-integrity.test.ts`

- [ ] **Step 1: Write data integrity tests**

Create `tests/data/data-integrity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { TEAMS } from '@/data/teams'
import { DRIVERS } from '@/data/drivers'
import { CIRCUITS } from '@/data/circuits'
import { SCENARIOS } from '@/data/scenarios'
import { RND_TREE } from '@/data/rnd-tree'
import { SPONSORS } from '@/data/sponsors'

describe('data integrity', () => {
  it('has 11 teams', () => {
    expect(TEAMS).toHaveLength(11)
  })

  it('has at least 22 drivers', () => {
    expect(DRIVERS.length).toBeGreaterThanOrEqual(22)
  })

  it('every team has 2 drivers that exist', () => {
    const driverIds = new Set(DRIVERS.map(d => d.id))
    for (const team of TEAMS) {
      expect(driverIds.has(team.driverIds[0])).toBe(true)
      expect(driverIds.has(team.driverIds[1])).toBe(true)
    }
  })

  it('has 22 circuits', () => {
    expect(CIRCUITS).toHaveLength(22)
  })

  it('every circuit has 3 tire compounds', () => {
    for (const circuit of CIRCUITS) {
      expect(circuit.compounds).toHaveLength(3)
    }
  })

  it('has 4 scenarios', () => {
    expect(SCENARIOS).toHaveLength(4)
  })

  it('R&D tree has 3 branches with upgrades', () => {
    const branches = new Set(RND_TREE.map(u => u.branch))
    expect(branches.size).toBe(3)
    expect(branches.has('chassis')).toBe(true)
    expect(branches.has('power-unit')).toBe(true)
    expect(branches.has('active-aero')).toBe(true)
  })

  it('R&D prerequisites reference valid upgrade IDs', () => {
    const ids = new Set(RND_TREE.map(u => u.id))
    for (const upgrade of RND_TREE) {
      for (const prereq of upgrade.prerequisiteIds) {
        expect(ids.has(prereq)).toBe(true)
      }
    }
  })

  it('has sponsors across all tiers', () => {
    const tiers = new Set(SPONSORS.map(s => s.tier))
    expect(tiers.has('title')).toBe(true)
    expect(tiers.has('major')).toBe(true)
    expect(tiers.has('minor')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/data/data-integrity.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Create teams data**

Create `src/data/teams.ts` with all 11 real 2026 F1 teams. Follow this pattern for each team:

```typescript
import type { Team } from '@/types/team'

export const TEAMS: Omit<Team, 'rndUpgrades' | 'constructorPoints' | 'constructorPosition'>[] = [
  {
    id: 'mclaren',
    name: 'McLaren Racing',
    shortName: 'MCL',
    color: '#FF8000',
    powerUnitSupplier: 'mercedes',
    driverIds: ['norris', 'piastri'],
    reserveDriverId: null,
    staff: [
      { name: 'Peter Prodromou', role: 'technical-director', skill: 88, currentFocus: 'Floor development', flaggedIssue: null },
      { name: 'Tom Stallard', role: 'race-engineer', skill: 85, currentFocus: 'Race strategy optimization', flaggedIssue: null },
      { name: 'Louise McEwen', role: 'commercial-director', skill: 80, currentFocus: 'Sponsor renewals', flaggedIssue: null },
      { name: 'Andrea Mayfield', role: 'team-manager', skill: 82, currentFocus: 'Staff retention', flaggedIssue: null },
    ],
    car: { downforce: 85, straightSpeed: 83, reliability: 80, tireManagement: 82, braking: 84, cornering: 86 },
    components: [
      { element: 'ice', used: 0, limit: 4, failureProbability: 0.02 },
      { element: 'turbo', used: 0, limit: 4, failureProbability: 0.03 },
      { element: 'ers-battery', used: 0, limit: 3, failureProbability: 0.01 },
      { element: 'gearbox', used: 0, limit: 4, failureProbability: 0.02 },
    ],
    windTunnelHoursUsed: 0, windTunnelHoursLimit: 300,
    cfdRunsUsed: 0, cfdRunsLimit: 2500,
    morale: 85,
    aiPersonality: null, // player can pick this team
  },
  // ... 10 more teams following same structure
  // Competitive tier guide:
  //   Top: McLaren (85avg), Red Bull (86avg), Ferrari (84avg)
  //   Upper-mid: Mercedes (82avg), Aston Martin (78avg)
  //   Mid: Williams (74avg), Racing Bulls (73avg), Alpine (72avg)
  //   Lower: Haas (70avg), Audi (68avg), Cadillac (65avg)
]
```

Include all 11 teams. Staff names can be fictional. AI personality should be set for all teams (player team's gets ignored). Car performance should reflect the real 2026 competitive order. Staff skill ranges: top teams 80-90, midfield 70-80, backmarkers 60-70.

- [ ] **Step 4: Create drivers data**

Create `src/data/drivers.ts` with all 22 race drivers plus 6-8 reserve/F2 drivers. Follow this pattern:

```typescript
import type { Driver } from '@/types/driver'

// Attribute scale guide:
//   95-99: Generational talent (Verstappen pace, Hamilton experience)
//   85-94: Elite (Norris, Leclerc)
//   75-84: Very good (Piastri, Russell, Sainz)
//   65-74: Solid (Albon, Gasly, Hulkenberg)
//   55-64: Developing/declining (rookies, veterans past peak)
//   45-54: F2-level / raw talent

export const DRIVERS: Driver[] = [
  {
    id: 'verstappen',
    firstName: 'Max', lastName: 'Verstappen', shortName: 'VER',
    nationality: 'Dutch', age: 28, teamId: 'red-bull',
    attributes: { pace: 97, racecraft: 96, experience: 92, mentality: 90, marketability: 95, developmentPotential: 20 },
    mood: { motivation: 85, frustration: 15, confidence: 95 },
    contract: { salary: 55_000_000, termEndSeason: 3, performanceBonuses: [{ condition: 'WDC', value: 10_000_000 }], releaseClause: 200_000_000 },
    seasonStats: { points: 0, wins: 0, podiums: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0 },
    rivalries: [],
    peakAge: 28, declineRate: 0.5,
    isReserve: false, isF2: false,
  },
  {
    id: 'norris',
    firstName: 'Lando', lastName: 'Norris', shortName: 'NOR',
    nationality: 'British', age: 26, teamId: 'mclaren',
    attributes: { pace: 92, racecraft: 88, experience: 82, mentality: 80, marketability: 90, developmentPotential: 45 },
    mood: { motivation: 90, frustration: 10, confidence: 88 },
    contract: { salary: 30_000_000, termEndSeason: 3, performanceBonuses: [{ condition: 'Win', value: 500_000 }], releaseClause: null },
    seasonStats: { points: 0, wins: 0, podiums: 0, dnfs: 0, penalties: 0, bestFinish: 99, averageFinish: 0 },
    rivalries: [],
    peakAge: 29, declineRate: 0.4,
    isReserve: false, isF2: false,
  },
  // ... 20 more race drivers + 6-8 F2/reserve drivers following same pattern
  // Key attribute benchmarks:
  //   Hamilton: pace 88, racecraft 95, experience 99, mentality 92 (age 41, past peak)
  //   Leclerc: pace 93, racecraft 90, experience 85, mentality 78
  //   Rookies (Hadjar, Lindblad, Antonelli, Bearman, Bortoleto): pace 70-78, experience 55-62, developmentPotential 75-90
  //   Veterans (Alonso age 44, Bottas, Perez): experience 90+, declining pace, low developmentPotential
]
```

- [ ] **Step 5: Create circuits data**

Create `src/data/circuits.ts` with all 22 circuits from the 2026 calendar. Include characteristics (downforce level, tire wear, overtaking difficulty, weather variability) and Pirelli compound selections.

- [ ] **Step 6: Create scenarios data**

Create `src/data/scenarios.ts` with 4 starting scenarios: Golden Era, Rebuild, Newcomer, Crisis. Each defines modifiers to starting budget, car performance, morale, prestige, and which teams they're available for.

- [ ] **Step 7: Create R&D tech tree data**

Create `src/data/rnd-tree.ts` with ~12 upgrades across 3 branches. Each upgrade has cost, development time, performance delta, and prerequisite chain. Chassis: Front Wing v2 → Floor Upgrade → Rear Wing Active → Sidepod Redesign. Power Unit: ERS Efficiency → Battery Capacity → Turbo Reliability → ICE Power Mode. Active Aero: Straight Mode v2 → Overtake Mode Eff → Wing Sync → Adaptive Response.

- [ ] **Step 8: Create sponsors data**

Create `src/data/sponsors.ts` with 15-20 fictional sponsors across 3 tiers. Each has value, KPI templates, minimum prestige requirement, and contract terms.

- [ ] **Step 9: Run data integrity tests**

```bash
npx vitest run tests/data/data-integrity.test.ts
```
Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/data/ tests/data/
git commit -m "feat: add static game data — 11 teams, 22+ drivers, 22 circuits, scenarios, R&D tree, sponsors"
```

---

## Task 5: Game State Manager & Save System

**Files:**
- Create: `src/engine/core/state-manager.ts`, `src/engine/core/save-system.ts`
- Test: `tests/engine/core/state-manager.test.ts`, `tests/engine/core/save-system.test.ts`

- [ ] **Step 1: Write state manager tests**

Create `tests/engine/core/state-manager.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { initializeGame, advancePhase } from '@/engine/core/state-manager'

describe('initializeGame', () => {
  it('creates valid initial state for a team and scenario', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    expect(state.gameState.playerTeamId).toBe('mclaren')
    expect(state.gameState.scenario).toBe('golden-era')
    expect(state.gameState.season).toBe(1)
    expect(state.gameState.currentRound).toBe(1)
    expect(state.gameState.phase).toBe('management')
    expect(state.teams).toHaveLength(11)
    expect(state.drivers.length).toBeGreaterThanOrEqual(22)
  })

  it('applies scenario modifiers to player team', () => {
    const golden = initializeGame('mclaren', 'golden-era', 42)
    const rebuild = initializeGame('mclaren', 'rebuild', 42)
    const goldenTeam = golden.teams.find(t => t.id === 'mclaren')!
    const rebuildTeam = rebuild.teams.find(t => t.id === 'mclaren')!
    expect(goldenTeam.morale).toBeGreaterThan(rebuildTeam.morale)
  })
})

describe('advancePhase', () => {
  it('transitions from management to practice', () => {
    const state = initializeGame('mclaren', 'golden-era', 42)
    const next = advancePhase(state)
    expect(next.gameState.phase).toBe('practice')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/core/state-manager.test.ts
```

- [ ] **Step 3: Implement state manager**

Create `src/engine/core/state-manager.ts`: Initialize full game world from team + scenario selection. Apply scenario modifiers. Implement phase transition state machine:

- **Standard weekend:** management → practice → qualifying → race → post-race → management
- **Sprint weekend:** management → practice → sprint-qualifying → sprint → qualifying → race → post-race → management

The phase transition function checks `currentRace.isSprint` to determine which flow to use. Sprint-qualifying uses Medium tires for SQ1/SQ2 and Soft for SQ3. Sprint race is 100km (roughly 1/3 of race laps), no mandatory pit stop, top 8 score points (8-7-6-5-4-3-2-1).

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/engine/core/state-manager.test.ts
```

- [ ] **Step 5: Install fake-indexeddb and write save system tests**

```bash
npm install -D fake-indexeddb
```

Create `tests/engine/core/save-system.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto' // Polyfills IndexedDB in test environment
import { SaveSystem } from '@/engine/core/save-system'

describe('SaveSystem', () => {
  let save: SaveSystem

  beforeEach(() => {
    save = new SaveSystem()
  })

  it('saves and loads game state', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const loaded = await save.loadFromSlot('slot-1')
    expect(loaded.gameState.season).toBe(1)
  })

  it('lists available save slots', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const slots = await save.listSlots()
    expect(slots).toHaveLength(1)
    expect(slots[0].name).toBe('My Save')
  })

  it('exports save as JSON string', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    const json = await save.exportSave('slot-1')
    expect(typeof json).toBe('string')
    const parsed = JSON.parse(json)
    expect(parsed.gameState.season).toBe(1)
  })

  it('imports save from JSON string', async () => {
    const json = JSON.stringify({ gameState: { season: 2, schemaVersion: 1 }, teams: [], drivers: [] })
    await save.importSave('slot-2', 'Imported', json)
    const loaded = await save.loadFromSlot('slot-2')
    expect(loaded.gameState.season).toBe(2)
  })

  it('deletes a save slot', async () => {
    const mockState = { gameState: { season: 1, schemaVersion: 1 }, teams: [], drivers: [] }
    await save.saveToSlot('slot-1', 'My Save', mockState as any)
    await save.deleteSlot('slot-1')
    const slots = await save.listSlots()
    expect(slots).toHaveLength(0)
  })
})
```

- [ ] **Step 6: Implement save system**

Create `src/engine/core/save-system.ts`: IndexedDB wrapper using `idb` library. 3 manual slots + 1 auto-save. Schema versioning with migration pipeline. Export/import as JSON.

- [ ] **Step 7: Run all tests**

```bash
npx vitest run tests/engine/core/
```

- [ ] **Step 8: Commit**

```bash
git add src/engine/core/ tests/engine/core/
git commit -m "feat: add game state manager and IndexedDB save system"
```

---

## Task 6: Tire Degradation & Race Simulation Engine

**Files:**
- Create: `src/engine/race/tire-model.ts`, `src/engine/race/race-simulator.ts`, `src/engine/race/pit-strategy.ts`, `src/engine/race/weather.ts`, `src/engine/race/overtake.ts`
- Test: `tests/engine/race/tire-model.test.ts`, `tests/engine/race/race-simulator.test.ts`

- [ ] **Step 1: Write tire model tests**

Create `tests/engine/race/tire-model.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateDegradation, getTirePerformance } from '@/engine/race/tire-model'

describe('tire model', () => {
  it('soft tires degrade faster than hard', () => {
    const softDeg = calculateDegradation('C5', 10, { tireWear: 'high' })
    const hardDeg = calculateDegradation('C1', 10, { tireWear: 'high' })
    expect(softDeg).toBeGreaterThan(hardDeg)
  })

  it('high tire wear circuits increase degradation', () => {
    const highWear = calculateDegradation('C3', 10, { tireWear: 'high' })
    const lowWear = calculateDegradation('C3', 10, { tireWear: 'low' })
    expect(highWear).toBeGreaterThan(lowWear)
  })

  it('tire performance decreases as wear increases', () => {
    const fresh = getTirePerformance({ compound: 'C3', label: 'medium', wear: 100, lapsFitted: 0 })
    const worn = getTirePerformance({ compound: 'C3', label: 'medium', wear: 30, lapsFitted: 20 })
    expect(fresh).toBeGreaterThan(worn)
  })

  it('tire cliff: performance drops sharply below 15% wear', () => {
    const beforeCliff = getTirePerformance({ compound: 'C3', label: 'medium', wear: 20, lapsFitted: 25 })
    const afterCliff = getTirePerformance({ compound: 'C3', label: 'medium', wear: 10, lapsFitted: 30 })
    const delta = beforeCliff - afterCliff
    expect(delta).toBeGreaterThan(0.5) // cliff should be dramatic
  })
})
```

- [ ] **Step 2: Run tire model tests to verify they fail**

```bash
npx vitest run tests/engine/race/tire-model.test.ts
```

- [ ] **Step 3: Implement tire degradation model**

Create `src/engine/race/tire-model.ts`: Compound-specific degradation rates. Circuit tire wear multiplier. Performance curve with cliff below 15%. Track temperature modifier.

- [ ] **Step 4: Run tire model tests**

```bash
npx vitest run tests/engine/race/tire-model.test.ts
```

- [ ] **Step 5: Write weather system tests**

Create `tests/engine/race/weather.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { WeatherEngine } from '@/engine/race/weather'
import { createPRNG } from '@/engine/core/prng'

describe('weather engine', () => {
  it('starts in the specified initial state', () => {
    const engine = new WeatherEngine('dry', 'medium', createPRNG(42))
    expect(engine.current).toBe('dry')
  })

  it('high variability circuits change weather more often', () => {
    let changes = 0
    for (let seed = 0; seed < 100; seed++) {
      const engine = new WeatherEngine('dry', 'high', createPRNG(seed))
      for (let lap = 0; lap < 50; lap++) engine.tick()
      if (engine.current !== 'dry') changes++
    }
    expect(changes).toBeGreaterThan(20) // should change often
  })

  it('low variability circuits rarely change weather', () => {
    let changes = 0
    for (let seed = 0; seed < 100; seed++) {
      const engine = new WeatherEngine('dry', 'low', createPRNG(seed))
      for (let lap = 0; lap < 50; lap++) engine.tick()
      if (engine.current !== 'dry') changes++
    }
    expect(changes).toBeLessThan(15)
  })

  it('rain probability updates each tick', () => {
    const engine = new WeatherEngine('dry', 'high', createPRNG(42))
    const initial = engine.rainProbability
    engine.tick()
    // Probability should change (not always, but over many ticks)
    expect(typeof engine.rainProbability).toBe('number')
  })
})
```

- [ ] **Step 6: Implement weather system**

Create `src/engine/race/weather.ts`: State machine (dry→damp→wet→damp→dry). Transition probability per lap based on circuit weatherVariability. Rain probability trending.

- [ ] **Step 7: Run weather tests**

```bash
npx vitest run tests/engine/race/weather.test.ts
```

- [ ] **Step 8: Write overtake model tests**

Create `tests/engine/race/overtake.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateOvertakeProbability } from '@/engine/race/overtake'

describe('overtake model', () => {
  it('higher car performance delta increases overtake probability', () => {
    const highDelta = calculateOvertakeProbability({ performanceDelta: 0.8, racecraft: 80, circuitDifficulty: 'medium', tireDelta: 0 })
    const lowDelta = calculateOvertakeProbability({ performanceDelta: 0.2, racecraft: 80, circuitDifficulty: 'medium', tireDelta: 0 })
    expect(highDelta.probability).toBeGreaterThan(lowDelta.probability)
  })

  it('high overtaking difficulty circuits reduce probability', () => {
    const easy = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, circuitDifficulty: 'low', tireDelta: 0 })
    const hard = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, circuitDifficulty: 'high', tireDelta: 0 })
    expect(easy.probability).toBeGreaterThan(hard.probability)
  })

  it('returns probability between 0 and 1', () => {
    const result = calculateOvertakeProbability({ performanceDelta: 0.5, racecraft: 80, circuitDifficulty: 'medium', tireDelta: 10 })
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 9: Implement overtake model**

Create `src/engine/race/overtake.ts`: Probability calculated from car performance delta + driver racecraft + circuit overtaking difficulty + tire state difference. Returns probability + estimated laps.

- [ ] **Step 10: Write pit strategy tests**

Create `tests/engine/race/pit-strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateStrategyOptions } from '@/engine/race/pit-strategy'

describe('pit strategy calculator', () => {
  it('returns 3 strategy options (undercut, optimum, overcut)', () => {
    const options = calculateStrategyOptions({ currentLap: 25, totalLaps: 55, tireWear: 55, compound: 'C3', circuitTireWear: 'medium' })
    expect(options).toHaveLength(3)
    expect(options.map(o => o.type)).toEqual(['undercut', 'optimum', 'overcut'])
  })

  it('undercut pit lap is earlier than optimum', () => {
    const options = calculateStrategyOptions({ currentLap: 25, totalLaps: 55, tireWear: 55, compound: 'C3', circuitTireWear: 'medium' })
    expect(options[0].pitLap).toBeLessThan(options[1].pitLap)
  })

  it('overcut pit lap is later than optimum', () => {
    const options = calculateStrategyOptions({ currentLap: 25, totalLaps: 55, tireWear: 55, compound: 'C3', circuitTireWear: 'medium' })
    expect(options[2].pitLap).toBeGreaterThan(options[1].pitLap)
  })
})
```

- [ ] **Step 11: Implement pit strategy calculator**

Create `src/engine/race/pit-strategy.ts`: Given tire state + remaining laps + circuit, calculate undercut/optimum/overcut options. Each returns projected outcome and probability.

- [ ] **Step 8: Write race simulator tests**

Create `tests/engine/race/race-simulator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { simulateLap, simulateRace } from '@/engine/race/race-simulator'
import { createPRNG } from '@/engine/core/prng'

describe('race simulator', () => {
  it('simulateLap produces results for all drivers', () => {
    // Create minimal race state with 4 drivers
    const rng = createPRNG(42)
    const result = simulateLap(mockRaceState(), rng)
    expect(result.lapResults).toHaveLength(4)
  })

  it('race simulation is deterministic with same seed', () => {
    const result1 = simulateRace(mockRaceSetup(), 42)
    const result2 = simulateRace(mockRaceSetup(), 42)
    expect(result1.finalPositions).toEqual(result2.finalPositions)
  })

  it('driver commands affect lap times', () => {
    const rng = createPRNG(42)
    const state = mockRaceState()
    state.strategies[0].currentCommand = 'push'
    const pushResult = simulateLap(state, rng)

    const rng2 = createPRNG(42)
    const state2 = mockRaceState()
    state2.strategies[0].currentCommand = 'conserve'
    const conserveResult = simulateLap(state2, rng2)

    // Push should produce faster lap time (lower number)
    expect(pushResult.lapResults[0].lapTime).toBeLessThan(conserveResult.lapResults[0].lapTime)
  })
})

function mockRaceState(): RaceState & { strategies: RaceStrategy[] } {
  const drivers = [
    { id: 'd1', car: { downforce: 80, straightSpeed: 80, reliability: 80, tireManagement: 80, braking: 80, cornering: 80 }, attributes: { pace: 85, racecraft: 80, experience: 75, mentality: 80, marketability: 70, developmentPotential: 60 } },
    { id: 'd2', car: { downforce: 78, straightSpeed: 78, reliability: 78, tireManagement: 78, braking: 78, cornering: 78 }, attributes: { pace: 80, racecraft: 78, experience: 70, mentality: 75, marketability: 65, developmentPotential: 70 } },
    { id: 'd3', car: { downforce: 75, straightSpeed: 82, reliability: 75, tireManagement: 75, braking: 75, cornering: 75 }, attributes: { pace: 78, racecraft: 82, experience: 80, mentality: 78, marketability: 60, developmentPotential: 40 } },
    { id: 'd4', car: { downforce: 72, straightSpeed: 72, reliability: 85, tireManagement: 72, braking: 72, cornering: 72 }, attributes: { pace: 72, racecraft: 70, experience: 60, mentality: 70, marketability: 55, developmentPotential: 85 } },
  ]
  return {
    currentLap: 10,
    totalLaps: 55,
    weather: { current: 'dry', rainProbability: 0.1, changeInLaps: null },
    safetyCar: 'green',
    trackTemp: 38,
    results: [],
    incidents: [],
    commentary: [],
    drivers,
    circuit: { tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low' },
    strategies: drivers.map(d => ({
      driverId: d.id,
      plannedStops: [{ lap: 25, compound: 'C3' as const }],
      currentCommand: 'standard' as const,
    })),
    tireStates: Object.fromEntries(drivers.map(d => [d.id, { compound: 'C3' as const, label: 'medium' as const, wear: 72, lapsFitted: 10 }])),
  } as any
}

function mockRaceSetup() {
  return {
    drivers: mockRaceState().drivers,
    circuit: { id: 'monza', name: 'Monza', laps: 55, tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'low', compounds: ['C2', 'C3', 'C4'] },
    strategies: mockRaceState().strategies,
    weather: 'dry',
  } as any
}
```

- [ ] **Step 9: Implement race simulator core**

Create `src/engine/race/race-simulator.ts`: Lap-by-lap simulation. For each lap: calculate lap times (base from car + driver + tire + weather), apply driver commands, check overtakes, apply tire degradation, check for incidents (mechanical failure, safety car), generate commentary. Uses PRNG for all randomness.

- [ ] **Step 10: Run all race engine tests**

```bash
npx vitest run tests/engine/race/
```

- [ ] **Step 11: Commit**

```bash
git add src/engine/race/ tests/engine/race/
git commit -m "feat: add race simulation engine — tire model, weather, overtakes, pit strategy"
```

---

## Task 7: Driver Model, Mood & R&D Engines

**Files:**
- Create: `src/engine/drivers/driver-model.ts`, `src/engine/drivers/mood-system.ts`, `src/engine/drivers/aging.ts`, `src/engine/drivers/contract-engine.ts`
- Create: `src/engine/engineering/rnd-engine.ts`, `src/engine/engineering/component-lifecycle.ts`, `src/engine/engineering/car-performance.ts`
- Test: `tests/engine/drivers/mood-system.test.ts`, `tests/engine/engineering/rnd-engine.test.ts`

- [ ] **Step 1: Write mood system tests**

Test that: race wins increase confidence and motivation; DNFs increase frustration; team orders increase frustration for affected driver; low car competitiveness slowly drains motivation; mood values clamp between 0-100.

- [ ] **Step 2: Implement mood system**

Create `src/engine/drivers/mood-system.ts`: Takes driver mood + list of events since last update → returns new mood. Events: race result, team order, contract status, teammate comparison, narrative events.

- [ ] **Step 3: Run mood system tests**

```bash
npx vitest run tests/engine/drivers/mood-system.test.ts
```

- [ ] **Step 4: Implement driver model**

Create `src/engine/drivers/driver-model.ts`: Calculate driver's effective race performance from attributes + mood. High motivation = bonus to pace. High frustration = penalty to consistency. Low confidence = penalty in wheel-to-wheel.

- [ ] **Step 5: Implement aging system**

Create `src/engine/drivers/aging.ts`: Between seasons, update driver attributes. Before peak: attributes slowly improve. After peak: gradual decline. Development potential affects improvement rate for young drivers.

- [ ] **Step 6: Implement contract engine**

Create `src/engine/drivers/contract-engine.ts`: Evaluate contract offers. Driver acceptance based on: salary vs market value, team competitiveness, mood, rivalry with proposed teammate. Generate counter-offers.

- [ ] **Step 7: Write R&D engine tests**

Test that: in-progress upgrades advance by correct amount per race. Completed upgrades unlock dependents. Paused upgrades preserve progress. Car performance updates when upgrades complete.

- [ ] **Step 8: Implement R&D engine**

Create `src/engine/engineering/rnd-engine.ts`: Advance R&D progress per management phase. Check unlock conditions. Handle player override (pause/resume with progress preservation).

- [ ] **Step 9: Implement car performance calculator**

Create `src/engine/engineering/car-performance.ts`: Base car stats + sum of completed upgrade deltas = current 6-axis performance profile. Calculate overall rating (weighted average).

- [ ] **Step 10: Implement component lifecycle**

Create `src/engine/engineering/component-lifecycle.ts`: Track PU element usage. Calculate failure probability based on usage + reliability upgrades. Determine grid penalty when exceeding allocation.

- [ ] **Step 11: Run all engine tests**

```bash
npx vitest run tests/engine/
```

- [ ] **Step 12: Commit**

```bash
git add src/engine/drivers/ src/engine/engineering/ tests/engine/
git commit -m "feat: add driver model, mood system, R&D engine, car performance"
```

---

## Task 8: Financial, Narrative & Delegation Engines

**Files:**
- Create: `src/engine/finance/budget-engine.ts`, `src/engine/finance/sponsor-engine.ts`, `src/engine/finance/prestige.ts`
- Create: `src/engine/narrative/event-generator.ts`, `src/engine/narrative/story-arc-tracker.ts`
- Create: `src/engine/delegation/department-ai.ts`
- Create: `src/engine/ai/ai-team-engine.ts`
- Test: `tests/engine/finance/budget-engine.test.ts`, `tests/engine/narrative/event-generator.test.ts`

- [ ] **Step 1: Write budget engine tests**

Test that: spending updates budget correctly. Over-cap triggers penalty flag. Category breakdown sums to total. Season-end prize money calculation works.

- [ ] **Step 2: Implement budget engine**

Create `src/engine/finance/budget-engine.ts`: Track spending across categories (R&D, salaries, operations, marketing). Enforce $215M cap. Calculate penalty tiers for overspend.

- [ ] **Step 3: Implement sponsor engine**

Create `src/engine/finance/sponsor-engine.ts`: Evaluate KPI progress after each race. Update satisfaction. Trigger departure risk when satisfaction drops below threshold. Filter available sponsors by prestige tier.

- [ ] **Step 4: Implement prestige calculator**

Create `src/engine/finance/prestige.ts`: Weighted formula from constructor standing + recent results + driver marketability + media events - scandals. Map 0-100 score to A+ through F rating.

- [ ] **Step 5: Write narrative event generator tests**

Test that: events are generated when conditions match. Events respect expiration. Default outcomes apply to expired events. Events don't repeat within cooldown period.

- [ ] **Step 6: Implement event generator**

Create `src/engine/narrative/event-generator.ts`: Rule engine evaluates game state against event templates. Each template has conditions (e.g., "driver frustration > 70 AND lost position to teammate last race"). Generates events with options and consequences. Handles expiration with default outcomes.

- [ ] **Step 7: Create event templates**

Create `src/data/events/templates.ts`: 2-3 templates per narrative thread (12-18 total for MVP). Each with conditions, headline, body, options, consequences, and default outcome.

- [ ] **Step 8: Implement story arc tracker**

Create `src/engine/narrative/story-arc-tracker.ts`: State machine that tracks multi-race arcs. Arcs progress through stages (building → escalating → climax → resolution). Generates arc-specific events at stage transitions.

- [ ] **Step 9: Implement delegation AI**

Create `src/engine/delegation/department-ai.ts`: For each department head, given their skill level and current game state, make auto-decisions. Technical Director: pick next R&D upgrade. Race Engineer: suggest strategy. Commercial Director: handle minor sponsor renewals. Team Manager: manage staff issues. Quality of decisions scales with skill rating.

- [ ] **Step 10: Implement AI team engine**

Create `src/engine/ai/ai-team-engine.ts`: Simplified decision-making for 10 non-player teams. Per management phase: advance R&D (priority based on personality), adjust strategy, evaluate driver market. Uses simplified versions of the same engines.

- [ ] **Step 11: Run all engine tests**

```bash
npx vitest run tests/engine/
```

- [ ] **Step 12: Commit**

```bash
git add src/engine/finance/ src/engine/narrative/ src/engine/delegation/ src/engine/ai/ src/data/events/ tests/engine/
git commit -m "feat: add financial, narrative, delegation, and AI team engines"
```

---

## Task 9: Zustand Stores & Web Worker

**Files:**
- Create: `src/stores/game-store.ts`, `src/stores/ui-store.ts`, `src/stores/settings-store.ts`
- Create: `src/workers/race-sim-worker.ts`

- [ ] **Step 1: Create game store**

Create `src/stores/game-store.ts`: Zustand store wrapping the full game world state. Actions: `initGame()`, `advancePhase()`, `allocateRnD()`, `setDriverCommand()`, `resolveEvent()`, `saveGame()`, `loadGame()`. Subscribes to auto-save triggers.

- [ ] **Step 2: Create UI store**

Create `src/stores/ui-store.ts`: Track active page, selected driver/car, open modals, notification queue.

- [ ] **Step 3: Create settings store**

Create `src/stores/settings-store.ts`: Sim speed default, high contrast mode toggle, reduced motion toggle. Persisted to localStorage.

- [ ] **Step 4: Create Web Worker**

Create `src/workers/race-sim-worker.ts`: Listen for WorkerInMessage types. On `start`: initialize race sim. On `setSpeed`/`pause`/`resume`: control simulation tick rate. On `command`/`strategyChange`: update in-sim state. Post WorkerOutMessage per lap tick.

- [ ] **Step 5: Commit**

```bash
git add src/stores/ src/workers/
git commit -m "feat: add Zustand stores and race simulation Web Worker"
```

---

## Task 10: UI Component Library

**Files:**
- Create: All files in `src/components/ui/` and `src/components/charts/`

- [ ] **Step 1: Create base UI components**

Create `src/components/ui/button.tsx`: Variants (primary lime, secondary, danger red, ghost). Hover/focus-visible/active states. Size variants.

Create `src/components/ui/card.tsx`: Glassmorphic card with `--bg-surface` background, `--border-default` border, 8px radius. Optional accent border color.

Create `src/components/ui/badge.tsx`: Small uppercase text on tinted background. Color variants matching severity (lime, cyan, red, amber, purple).

Create `src/components/ui/progress-bar.tsx`: 4px height, rounded, accent-colored fill. Props: value (0-100), color, label.

Create `src/components/ui/donut-chart.tsx`: SVG circular progress. Props: percentage, color, size, label, sublabel.

Create `src/components/ui/tooltip.tsx`: Dark tooltip on hover. Uses Framer Motion for enter/exit.

- [ ] **Step 2: Create chart components**

Create `src/components/charts/radar-chart.tsx`: 6-axis radar using Recharts. Accepts CarPerformance or DriverAttributes. Lime fill with accent stroke. Responsive.

Create `src/components/charts/degradation-curve.tsx`: Custom SVG chart. Shows tire performance over laps with gradient fill. Marks current position and pit window. Compound color coding (red=soft, amber=medium, white=hard).

Create `src/components/charts/gap-chart.tsx`: Horizontal bar chart showing gaps between drivers. Player team highlighted in lime.

- [ ] **Step 3: Create layout components**

Create `src/components/layout/nav-bar.tsx`: 7 items (Paddock, Factory, Drivers, Strategy, Finance, Calendar, Regs). Active state with lime accent. Fixed bottom on desktop.

Create `src/components/layout/top-bar.tsx`: Team name (left), season/round (left sub), race countdown (right). Monospace font for countdown.

Create `src/components/layout/page-shell.tsx`: Wraps content with TopBar + NavBar + padding.

- [ ] **Step 4: Verify components render**

Create a temporary `/test-ui` page that renders all components for visual verification:
```bash
npm run dev
```
Open `localhost:3000/test-ui` and visually confirm all components render correctly with the Kinetic Command design system.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ src/components/charts/ src/components/layout/
git commit -m "feat: add UI component library — cards, badges, charts, layout"
```

---

## Task 11: New Game Flow

**Files:**
- Create: `src/app/page.tsx` (update), `src/app/new-game/page.tsx`
- Create: `src/components/new-game/team-selector.tsx`, `src/components/new-game/scenario-selector.tsx`

- [ ] **Step 1: Create team selector component**

Grid of 11 team cards. Each shows: team name, color swatch, drivers, power unit supplier. Click to select. Selected card gets lime border glow.

- [ ] **Step 2: Create scenario selector component**

4 scenario cards shown after team is selected. Each shows: scenario name, description, difficulty indicator, starting condition modifiers. Not all scenarios available for all teams.

- [ ] **Step 3: Create new game page**

Create `src/app/new-game/page.tsx`: Two-step flow: pick team → pick scenario → "Launch Season" button. On launch: call `gameStore.initGame()`, redirect to `/paddock`.

- [ ] **Step 4: Update landing page**

Update `src/app/page.tsx`: Show "New Game" button, "Continue" button (if auto-save exists), "Load Game" button. Mission Control branding.

- [ ] **Step 5: Test the flow manually**

```bash
npm run dev
```
Verify: Landing → New Game → Select team → Select scenario → Paddock loads with correct team data.

- [ ] **Step 6: Commit**

```bash
git add src/app/ src/components/new-game/
git commit -m "feat: add new game flow — team and scenario selection"
```

---

## Task 12: The Paddock (Dashboard)

**Files:**
- Create: `src/app/paddock/page.tsx`
- Create: `src/components/paddock/health-widget.tsx`, `src/components/paddock/driver-summary-card.tsx`, `src/components/paddock/paddock-feed.tsx`, `src/components/paddock/feed-item.tsx`, `src/components/paddock/department-panel.tsx`

- [ ] **Step 1: Create health widget**

Single metric display with: large value, label, trend indicator (up/down/stable), optional warning text. Color variants.

- [ ] **Step 2: Create driver summary cards**

Compact card: driver name, car number, WDC position + points, last race result, morale indicator with brief reason.

- [ ] **Step 3: Create paddock feed components**

`paddock-feed.tsx`: Scrollable container that renders feed items.
`feed-item.tsx`: Left border color-coded by severity. Shows: severity badge, timestamp, headline, body, optional action buttons. Actions dispatch to gameStore.resolveEvent().

- [ ] **Step 4: Create department panel**

4 rows: department head name + role, current focus text, flagged issue (if any, in red/amber).

- [ ] **Step 5: Assemble paddock page**

Create `src/app/paddock/page.tsx`: TopBar with race countdown. 5 health widgets row. Two-column layout: drivers + departments (left), paddock feed (right). "Advance to Race Weekend" button.

- [ ] **Step 6: Verify visually**

```bash
npm run dev
```
Navigate to `/paddock`. Verify all widgets populate from game store. Verify feed items render with correct color coding. Verify "Advance" button transitions phase.

- [ ] **Step 7: Commit**

```bash
git add src/app/paddock/ src/components/paddock/
git commit -m "feat: add Paddock dashboard — health widgets, driver cards, paddock feed"
```

---

## Task 13: The Factory (Engineering)

**Files:**
- Create: `src/app/factory/page.tsx`
- Create: `src/components/factory/tech-tree.tsx`, `src/components/factory/tech-node.tsx`, `src/components/factory/component-status.tsx`, `src/components/factory/aero-allocation.tsx`

- [ ] **Step 1: Create tech node component**

Single R&D upgrade card. States: complete (lime border, checkmark), in-progress (cyan glow, progress bar, ETA), queued (subtle border), locked (dimmed, shows prerequisite). Click to interact (start/pause/prioritize).

- [ ] **Step 2: Create tech tree component**

3-column layout for Chassis / Power Unit / Active Aero branches. Each column renders its nodes vertically with visual dependency lines between them. Branch header with color accent.

- [ ] **Step 3: Create component status**

PU element bars (ICE, Turbo, ERS, Gearbox). Each shows used/limit with progress bar. Color: lime (safe) → amber (warning) → red (penalty risk). Penalty risk callout box.

- [ ] **Step 4: Create aero allocation**

Two donut charts side by side: Wind Tunnel (hours used/limit) and CFD (runs used/limit). Each shows usage stats and TD recommendation.

- [ ] **Step 5: Assemble factory page**

Create `src/app/factory/page.tsx`: Top section: car performance radar + component status (2-column). Middle: R&D tech tree (full width). Bottom: aero allocation (2-column).

- [ ] **Step 6: Verify and commit**

```bash
npm run dev
git add src/app/factory/ src/components/factory/
git commit -m "feat: add Factory screen — R&D tech tree, component status, aero allocation"
```

---

## Task 14: Driver Office

**Files:**
- Create: `src/app/drivers/page.tsx`
- Create: `src/components/drivers/driver-profile.tsx`, `src/components/drivers/mood-tracker.tsx`, `src/components/drivers/contract-panel.tsx`, `src/components/drivers/scout-panel.tsx`

- [ ] **Step 1: Create driver profile**

Full driver card: name, nationality, age. 6-axis attribute radar chart. Season stats summary (points, wins, podiums, DNFs). Overall rating calculation displayed.

- [ ] **Step 2: Create mood tracker**

3 mood bars (motivation, frustration, confidence) with color coding. Brief reason text below each. Historical sparkline showing last 5 races trend.

- [ ] **Step 3: Create contract panel**

Contract details display: salary, term end, bonuses, release clause. Negotiation mode: sliders for salary, term, bonus when making offers. Accept/reject feedback based on contract engine evaluation.

- [ ] **Step 4: Create scout panel**

List of available F2/reserve drivers with attributes, age, potential rating, cost to sign. Sortable by attribute. "Sign" button initiates contract offer.

- [ ] **Step 5: Create driver comparison tool**

Create `src/components/drivers/driver-comparison.tsx`: Side-by-side overlay of two driver radar charts. Select two drivers from dropdowns. Shows attribute differences highlighted (green = advantage, red = disadvantage). Useful for evaluating scouting targets vs. current roster.

- [ ] **Step 6: Assemble drivers page**

Create `src/app/drivers/page.tsx`: Tab view: Car 01 | Car 02 | Reserve | Scout | Compare. Each driver tab shows profile + mood + contract. Scout tab shows scout panel. Compare tab shows driver comparison tool.

- [ ] **Step 6: Verify and commit**

```bash
npm run dev
git add src/app/drivers/ src/components/drivers/
git commit -m "feat: add Driver Office — profiles, mood tracking, contracts, scouting"
```

---

## Task 15: Strategy Room (Race Weekend)

**Files:**
- Create: `src/app/strategy/page.tsx`
- Create: `src/components/strategy/timing-tower.tsx`, `src/components/strategy/tire-strategy.tsx`, `src/components/strategy/commentary-feed.tsx`, `src/components/strategy/battle-forecast.tsx`, `src/components/strategy/driver-commands.tsx`, `src/components/strategy/race-status-bar.tsx`, `src/components/strategy/sim-speed-control.tsx`
- Create: `src/components/strategy/practice-view.tsx`, `src/components/strategy/qualifying-view.tsx`, `src/components/strategy/race-view.tsx`

- [ ] **Step 1: Create timing tower**

Left column component: all 20 drivers sorted by position. Each row: position, driver 3-letter code (player team highlighted lime), gap to leader (or to car ahead). Sector times with color coding (purple=PB, green=fastest overall, white=no improvement). Monospace font for times.

- [ ] **Step 2: Create tire strategy panel**

SVG degradation curve with gradient fill. Current position marker. Pit window rectangle overlay. Below: 3 strategy option cards (Undercut/Optimum/Overcut) with pit lap, projected outcome, probability percentage, risk text. Click to set strategy.

- [ ] **Step 3: Create commentary feed**

Scrollable feed. Each entry: lap number colored by severity, text content. Left border color: critical=red, highlight=lime, radio=purple, info=cyan, neutral=gray. Auto-scrolls to newest. Framer Motion slide-in for new entries (respects reduced-motion).

- [ ] **Step 4: Create battle forecast**

Stacked overtake probability bars. Each: attacker → defender, probability percentage, progress bar with gradient, estimated laps text.

- [ ] **Step 5: Create driver commands**

Two panels (Car 01, Car 02). Each: row of toggle buttons (Push/Standard/Conserve/Overtake+/Defend). PIT NOW as separate danger button. Active command highlighted. Dispatches to Web Worker via game store.

- [ ] **Step 6: Create race status bar**

Horizontal bar: 4 widgets (Weather + rain probability, Track temp + degradation note, Safety car status + probability, PU stress per car).

- [ ] **Step 7: Create sim speed control**

Row of toggle buttons: 1x, 2x, 5x, MAX, Pause. Active speed highlighted lime. Dispatches to Web Worker.

- [ ] **Step 8: Create practice view**

Practice session: choose program per driver from cards (Race Pace Sim, Qualifying Sim, Tire Deg Test, Aero Balance Test). Run button. Results update setup confidence data.

- [ ] **Step 9: Create qualifying view**

Qualifying flow: set tire strategy per session. Watch results in timing tower. Grid positions finalized.

- [ ] **Step 10: Create race view**

Assemble the full race layout: 3 columns. Left: timing tower. Center: tire strategy + strategy options + driver commands. Right: commentary feed + battle forecast + sim speed. Top: race status bar. Connects to Web Worker for live updates.

- [ ] **Step 11: Assemble strategy page with sprint support**

Create `src/app/strategy/page.tsx`: Renders the correct view based on current game phase:
- `practice` → practice-view (FP1 only for sprint weekends, FP1-FP3 for standard)
- `sprint-qualifying` → qualifying-view (with sprint-specific tire rules: Medium for SQ1/SQ2, Soft for SQ3)
- `sprint` → race-view (configured for ~1/3 race distance, no mandatory stop, top-8 points)
- `qualifying` → qualifying-view (standard Q1/Q2/Q3)
- `race` → race-view (full distance)

Phase indicator at top shows current session and sprint weekend badge if applicable.

- [ ] **Step 12: Test full race simulation flow**

```bash
npm run dev
```
Start a game, advance to race weekend, complete practice → qualifying → race. Verify: telemetry updates, commentary flows, driver commands work, pit stops execute, race completes with results.

- [ ] **Step 13: Commit**

```bash
git add src/app/strategy/ src/components/strategy/
git commit -m "feat: add Strategy Room — practice, qualifying, live race simulation with telemetry"
```

---

## Task 16: Financial HQ, Calendar & Regulations

**Files:**
- Create: `src/app/finance/page.tsx`, `src/app/calendar/page.tsx`, `src/app/regulations/page.tsx`
- Create: `src/components/finance/budget-tracker.tsx`, `src/components/finance/sponsor-card.tsx`, `src/components/finance/prestige-meter.tsx`

- [ ] **Step 1: Create budget tracker**

Spend vs $215M cap bar. Category breakdown (R&D, Salaries, Operations, Marketing) as stacked colored segments. Projected end-of-season overlay. Penalty risk warning when approaching cap.

- [ ] **Step 2: Create sponsor card**

Sponsor name, tier badge, annual value, KPI checklist with progress bars, satisfaction meter, contract end date. Warning state when at risk.

- [ ] **Step 3: Create prestige meter**

Letter grade (A+ to F) display with score bar. Contributing factors breakdown: results, media, marketability, scandals.

- [ ] **Step 4: Assemble finance page**

Budget tracker (full width top). Two columns: sponsors list (left), prestige meter + marketing options (right).

- [ ] **Step 5: Create calendar page**

22-race grid/timeline. Each race card: round number, circuit name, country flag, date, characteristics badges (downforce, tire wear), sprint indicator. Completed races show result. Next race highlighted. Click to see circuit detail panel.

- [ ] **Step 6: Create regulation engine (MVP: pre-scripted)**

Create `src/engine/regulations/regulation-engine.ts`: Stores pre-scripted regulation changes keyed by season. At season-end, applies the next season's changes (e.g., budget cap adjustments, aero testing limit changes, component allocation changes). Exports `getRegulationsForSeason()` and `getTechnicalDirectives()` for the UI. No voting or lobbying logic in MVP — just reads from static data.

Create `src/data/regulations.ts`: Pre-scripted regulation timeline. Season 2: budget cap increase to $220M. Season 3: new tire compound rules. Season 4: major aero regulation change. 2-3 technical directives per season that affect car performance.

- [ ] **Step 7: Create regulations page (MVP: read-only)**

Current rules summary. Timeline of upcoming pre-scripted regulation changes. Technical Directives feed (informational items from paddock feed filtered to technical type).

- [ ] **Step 7: Verify all pages and commit**

```bash
npm run dev
git add src/app/finance/ src/app/calendar/ src/app/regulations/ src/components/finance/
git commit -m "feat: add Financial HQ, Calendar, and Regulations screens"
```

---

## Task 17: Game Loop Integration & Season Flow

**Files:**
- Modify: `src/stores/game-store.ts`
- Modify: Various engine files for integration
- Create: `src/components/paddock/advance-button.tsx`
- Create: `src/components/post-race/results-summary.tsx`, `src/components/season-end/standings-summary.tsx`

- [ ] **Step 1: Implement management phase advance**

When player clicks "Advance to Race Weekend": run all engine updates (R&D progress, AI team decisions, narrative event generation, delegation auto-decisions), transition to practice phase.

- [ ] **Step 2: Implement post-race processing**

After race completes: update standings, process financial impacts (sponsor KPIs, spending), update driver moods, run narrative event generator, check for expired events, display results summary.

- [ ] **Step 3: Create results summary component**

Post-race modal: race results for both drivers, points gained, championship impact, key events summary, morale changes, any narrative consequences.

- [ ] **Step 4: Implement season-end processing**

After final race: calculate prize money, process driver aging, handle contract expirations, apply regulation changes for next season, generate off-season narrative events, prompt for save.

- [ ] **Step 5: Create standings summary component**

Season-end screen: final constructor + driver standings, budget summary, R&D progress summary, highlight reel (best/worst moments), "Continue to Season [N+1]" button.

- [ ] **Step 6: Test full season loop**

Play through at least 3 race weekends manually. Verify all systems update correctly: R&D progresses, moods shift, events generate, budget updates, standings change.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: integrate full game loop — management phase, race processing, season flow"
```

---

## Task 18: Polish, Accessibility & Final Testing

**Files:**
- Modify: Various components for animation and accessibility

- [ ] **Step 1: Add Framer Motion animations**

Dashboard widget number transitions. Commentary feed slide-in. Page transitions. Tech tree node state changes. Timing tower position changes. All using `transform` and `opacity` only. Respect `prefers-reduced-motion`.

- [ ] **Step 2: Add accessibility attributes**

`aria-label` on all data visualizations (radar charts, degradation curves). `aria-live="polite"` on commentary feed. `aria-live="assertive"` on critical alerts. Color-blind safe: add icons/text alongside all color-coded elements. Keyboard navigation through all interactive elements.

- [ ] **Step 3: Add high contrast mode**

Settings toggle. Brighter accent colors, pure black backgrounds, thicker borders, no glassmorphism. Store preference in settings store.

- [ ] **Step 4: Responsive layout pass**

Ensure all pages work on desktop (1280px+). Stack columns on smaller screens. Strategy Room: stack to 2-column then single column. Navigation: adapt to screen size.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```
Ensure all engine tests pass.

- [ ] **Step 6: Manual playthrough**

Complete a full 5-race stretch: new game → 5 race weekends with varied decisions. Verify: no crashes, state persists through save/load, narrative events trigger, R&D completes, contracts work, standings update.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: add animations, accessibility, responsive layout, final polish"
```

---

## Execution Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Project scaffolding & design system | None |
| 2 | Type definitions | Task 1 |
| 3 | PRNG & core utilities | Task 1 |
| 4 | Static game data | Task 2 |
| 5 | State manager & save system | Tasks 2, 3 |
| 6 | Race simulation engine | Tasks 2, 3 |
| 7 | Driver model & R&D engines | Tasks 2, 3 |
| 8 | Financial, narrative & AI engines | Tasks 2, 3, 4 |
| 9 | Zustand stores & Web Worker | Tasks 5, 6, 7, 8 |
| 10 | UI component library | Task 1 |
| 11 | New game flow | Tasks 5, 10 |
| 12 | Paddock dashboard | Tasks 9, 10, 11 |
| 13 | Factory screen | Tasks 9, 10 |
| 14 | Driver Office screen | Tasks 9, 10 |
| 15 | Strategy Room screen | Tasks 9, 10 |
| 16 | Finance, Calendar, Regulations | Tasks 9, 10 |
| 17 | Game loop integration | Tasks 11-16 |
| 18 | Polish & accessibility | Task 17 |

**Parallelizable:** Tasks 6, 7, 8 can run in parallel (independent engines). Tasks 12-16 can partially overlap (independent screens). Task 10 can run in parallel with Tasks 3-8.
