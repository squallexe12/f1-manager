# Mission Control: F1 Kinetic Command — Design Specification

**Date:** 2026-04-04
**Status:** Approved (Brainstorming Complete)
**Type:** Web-Based F1 Management Simulation Game

---

## 1. Product Summary

Mission Control is a web-based F1 team management simulation where the player acts as Team Principal, making strategic decisions across engineering, drivers, finance, and race operations. The game combines deep technical simulation with a living world narrative — driver rivalries, paddock scandals, media pressure, and multi-race story arcs that evolve across a multi-season career.

**Core Pillars:**
- "Signal over Noise" — deep data presented through progressive disclosure
- "Kinetic Command" — every screen feels like a high-tech telemetry command center
- "Living World" — the paddock is a drama-rich ecosystem where human stories drive engagement

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Game flow | Hybrid phases: Management Phase → Race Phase | Strategic depth for planning, dramatic tension for race execution |
| Race simulation | Telemetry dashboard + narrative commentary | Pit wall data feel + emotional storytelling = maximum immersion |
| Starting experience | Pick real 2026 team + difficulty scenario | Instant authenticity + replayability without custom team complexity |
| Management depth | Adaptive with delegation | Department heads handle routine; player intervenes on critical decisions or deep-dives by choice |
| Narrative system | Full living world (all 6 threads) | Driver rivalries, media pressure, poaching/politics, sponsor drama, paddock scandals, multi-race story arcs |
| Visual identity | Neon Telemetry | Deep black, lime #CCFF00, cyan #00E5FF, glassmorphic panels |
| Progression | Multi-season career | Decisions carry over; drivers age; R&D compounds; narrative arcs span seasons |
| Social model | Pure single-player | All energy focused on simulation quality and narrative depth |

---

## 3. Game Architecture

### 3.1 Core Game Loop

```
Management Phase (between races)
  → Player makes decisions at their own pace
  → Department heads auto-manage delegated areas
  → Narrative events surface critical decisions
  → R&D progresses, contracts evolve, paddock drama unfolds

Race Weekend Phase
  → Practice: choose programs (race pace, quali sim, tire test)
  → Qualifying: watch results, adjust strategy
  → Race: live telemetry + commentary, intervene with pit calls and driver commands
  → Post-race: results, standings, morale updates, story consequences

Season End
  → Final standings, prize money
  → Contract market, driver transfers
  → Regulation voting for next season
  → R&D carry-over with depreciation

New Season → Loop
```

### 3.2 Six Simulation Engines

Each engine is an independent system that feeds into the game loop:

**1. Engineering Engine**
- R&D tech tree with 3 branches: Chassis, Power Unit, Active Aero
- Each branch has 4-6 upgrades with dependencies (lock/unlock chain)
- Upgrades have: development time (in races), cost, performance delta, reliability impact
- Wind tunnel hours and CFD runs are FIA-regulated resources (allocation decisions)
- Component lifecycle: PU elements have season allocation limits, grid penalties for exceeding
- Car performance expressed as 6-axis profile: Downforce, Straight Speed, Reliability, Tire Management, Braking, Cornering

**2. Race Simulation Engine**
- Lap-by-lap simulation with deterministic-seeded randomness
- Tire degradation model: compound-specific curves affected by track, temperature, driving style, car setup
- Pit strategy: undercut/optimum/overcut with probability-based outcomes
- Weather system: dry → damp → wet transitions, mid-race changes
- Safety Car / VSC triggered by incident probability
- Overtake probability calculated from car delta, driver racecraft, track characteristics
- Driver commands during race: Push, Standard, Conserve, Overtake+, Defend, PIT NOW
- Simulation speed: 1x, 2x, 5x, MAX, Pause

**3. Driver Model Engine**
- 6 core attributes: Pace, Racecraft, Experience, Mentality, Marketability, Development Potential
- Dynamic mood system: motivation, frustration, confidence (affected by results, team treatment, car competitiveness, teammate rivalry)
- Aging curve: peak years vary by driver, gradual decline after peak
- Development: young drivers improve faster, veterans plateau
- Contract system: salary, term (1-3 years), performance bonuses, release clauses
- Scouting pipeline: F2/F3 talent with scout network investment

**4. Financial Engine**
- Budget cap: $215M team operations (2026 rules)
- Real-time spend tracking against FIA hard cap
- Penalty system for overspending: points deduction, wind tunnel reduction
- Revenue streams: prize money (standings-based), sponsorships, marketing
- Sponsor tiers: Title ($$$), Major ($$), Minor ($) — each with KPIs
- Prestige rating (A+ to F): determines sponsor availability, affected by results + media + marketability + scandals

**5. Narrative Engine**
- Event generator: creates contextual events based on game state
- 6 narrative threads (all active):

  **a) Driver Rivalries & Ego Clashes**
  - Teammate tension builds from: unequal results, team orders, contract status, media comparisons
  - Escalation chain: minor friction → public comments → on-track incidents → contract demands / departure threats
  - Resolution options: team meetings, revised hierarchy, contract adjustments, letting a driver go

  **b) Media Pressure & Press Conferences**
  - Triggered after: crashes, controversies, wins, milestone events
  - Multiple-choice responses with consequences to: public perception, driver morale, sponsor confidence
  - Tone options: honest (risky but authentic), diplomatic (safe but bland), deflecting (short-term safe, long-term erosion)

  **c) Poaching, Politics & Backroom Deals**
  - AI teams actively target player's drivers and key engineers
  - Poaching Alerts with response options: counter-offer, invoke contract clause, let go
  - Player can also poach from rivals
  - FIA regulation lobbying: teams propose rule changes, offer favors for votes

  **d) Sponsor Demands & Financial Crises**
  - Sponsors as characters with personalities and demands
  - Pressure events: demand driver changes, controversial branding, impossible KPIs
  - Budget crises force trade-off decisions: cut R&D vs. release driver vs. accept unfavorable sponsor

  **e) Paddock Scandals & Leaked Secrets**
  - Technical data leaks, disgruntled staff, off-track driver behavior
  - Impact: team morale, public image, potential FIA investigations
  - Response options: cover up, get ahead of story, use as leverage

  **f) Multi-Race Story Arcs**
  - Events chain across 3-8 races to form narrative arcs
  - Examples: rookie confidence build, team decline/turnaround, championship rivalry escalation
  - Arc tracker shows active storylines and their trajectory

- Events are color-coded by urgency: Breaking (red), Decision Required (amber), Technical (cyan), Rumor (purple), News (gray)
- Some events have inline action buttons for quick resolution; complex events open dedicated screens

**6. Regulation Engine**
- FIA rule proposals between seasons
- Team voting system (each team gets one vote)
- Technical directives mid-season that can affect car performance
- Lobbying: spend political capital to influence regulation outcomes
- Multi-season regulation cycles (e.g., new aero rules every 4-5 years)

### 3.3 Delegation System

Four department heads handle routine decisions:

| Role | Manages | Auto-Decisions |
|------|---------|----------------|
| Technical Director | R&D priorities, aero testing allocation | Which upgrades to develop next, resource distribution |
| Race Engineer | Strategy suggestions, car setup | Practice programs, baseline strategy, setup recommendations |
| Commercial Director | Sponsor negotiations, marketing | Minor sponsor renewals, marketing campaign targeting |
| Team Manager | Staff morale, pit crew training | Staff scheduling, conflict mediation, training programs |

- Each department head has a skill rating (1-100) affecting quality of auto-decisions
- Player can override any auto-decision at any time
- Department heads flag critical decisions that need player input
- Hiring better staff = better auto-decisions = player can focus on what excites them most

**Override behavior:** When a player overrides an in-progress auto-decision (e.g., switches R&D focus from Upgrade A to Upgrade B mid-development), progress on the original task is preserved at its current percentage. If the player later re-selects it, development resumes from where it left off. Only one upgrade per branch can be actively in development at a time. This prevents progress loss while maintaining strategic trade-offs around timing.

### 3.4 AI Team Behavior

The 10 non-player AI teams run simplified versions of the same six engines:

**AI Decision Model:**
- Each AI team has a personality profile: `aggressiveness` (R&D risk tolerance), `financialDiscipline` (budget management), `driverFocus` (tendency to invest in drivers vs. car)
- Per management phase, each AI team makes decisions through a weighted priority system based on their personality + current standings
- AI R&D: selects upgrades from the same tech tree but uses a simplified priority algorithm (not the full player UI). Top teams favor performance upgrades, struggling teams favor reliability
- AI race strategy: pre-calculated before race simulation based on car performance + circuit characteristics. AI does not dynamically adjust mid-race (simplification for MVP)
- AI driver market: AI teams evaluate driver contracts at season end, may trigger poaching events targeting the player or other AI teams
- AI financial: each team has a pre-set budget allocation that shifts slightly based on standings (teams falling behind invest more in R&D, frontrunners invest in stability)

**Competitive Balance:**
- AI team development rates are tuned per starting scenario to produce realistic championship battles
- A "rubber banding" coefficient prevents any team from running away with the championship too early (subtle, never feels artificial)
- AI teams react to regulation changes with varying effectiveness based on their technical director rating

### 3.5 Starting Scenarios

When starting a new game, the player picks a real 2026 team, then selects a narrative scenario:

| Scenario | Description | Starting Conditions |
|----------|-------------|---------------------|
| The Golden Era | Inherit a championship-winning team | Top car, high budget, high expectations, pressure to maintain |
| The Rebuild | Budget cuts, aging drivers, outdated car | Low performance, limited resources, room to grow |
| The Newcomer | Fresh entry, everything to prove | Mid-tier car, unknown reputation, flexible future |
| The Crisis | Mid-season takeover after scandal | Damaged morale, sponsor flight risk, immediate fires to fight |

Scenario availability varies by team (e.g., "Golden Era" only for top-3 teams, "Newcomer" only for Cadillac/Audi).

---

## 4. Screen Architecture

### 4.1 Navigation

7 primary screens accessible from a persistent bottom navigation bar:

1. **The Paddock** (Dashboard / Home)
2. **The Factory** (Engineering & R&D)
3. **Driver Office** (Driver Management)
4. **Strategy Room** (Race Weekend)
5. **Financial HQ** (Budget & Sponsors)
6. **Calendar** (Season Schedule)
7. **Regulations** (Rules & Voting)

### 4.2 Screen Details

#### Screen 1: The Paddock (Home Dashboard)

**Purpose:** Command center — everything at a glance, critical decisions surfaced.

**Components:**
- Top bar: team name, season/round indicator, next race countdown (T-minus timer)
- 5 health widgets: Constructor standing (with trend), budget remaining (% bar), PU reliability (with warnings), team morale, active alerts count
- Driver cards (2): each showing WDC position, points, last result, morale status with brief reason
- Department Heads panel: 4 rows showing each head's current focus + flagged issues
- Paddock Feed: scrollable, color-coded event stream with inline action buttons for quick decisions
- "Advance to Race Weekend" button when in Management Phase

#### Screen 2: The Factory (Engineering)

**Purpose:** Where the car is built, tested, and evolved.

**Components:**
- Car Performance Radar: 6-axis chart with overall rating and grid rank
- Component Status: PU element allocation bars with penalty risk warnings
- R&D Tech Tree: 3-branch visual tree (Chassis, Power Unit, Active Aero) with states: Complete (green), In Progress (cyan glow + progress bar + ETA), Queued, Locked (with prerequisite shown)
- Aero Testing: Wind tunnel hours (donut chart + usage stats) and CFD runs (donut chart + current focus)
- Technical Director recommendation callouts

#### Screen 3: Driver Office

**Purpose:** Manage drivers, scout talent, negotiate contracts.

**Components:**
- Roster view: Car 01 and Car 02 driver cards with full stat radar (6 attributes)
- Mentality tracker: visual mood indicator with history graph (motivation/frustration/confidence over last 5 races)
- Contract details: salary, term, bonuses, clauses, expiry countdown
- Scouting panel: F2/F3 talent list with scout ratings, potential estimates, cost to sign
- Negotiation interface: sliders for salary, term, bonuses when making offers
- Reserve driver slot
- Driver comparison tool: side-by-side stat overlay

#### Screen 4: Strategy Room (Race Weekend)

**Purpose:** The heart of the game — live race simulation with telemetry and narrative.

**Sub-phases:**

*Practice (FP1/FP2/FP3):*
- Choose practice programs per driver: race pace simulation, qualifying simulation, tire degradation test, aero balance test
- Results update car setup confidence and tire data accuracy
- Sprint weekends: only FP1 available before Sprint Qualifying

*Qualifying (and Sprint Qualifying):*
- Set tire compound strategy per session (Q1/Q2/Q3)
- Watch results in timing tower format
- Risk management: push for better grid vs. conserve tires for race

*Race (and Sprint):*
- Three-column layout:
  - Left: Live timing tower (all 20 drivers, gaps, sector times with color-coded improvement)
  - Center: Tire degradation curve with pit window visualization, strategy options (Undercut/Optimum/Overcut with probability outcomes), driver command buttons (Push/Standard/Conserve/Overtake+/Defend/PIT NOW)
  - Right: Narrative commentary feed (color-coded drama), battle forecast (overtake probability bars), simulation speed controls (1x/2x/5x/MAX/Pause)
- Top status bar: weather (with rain probability trend), track temperature, safety car status, PU stress per car
- Commentary examples: lap events, driver radio, weather warnings, overtake narratives, mentality updates

#### Screen 5: Financial HQ

**Purpose:** Budget management, sponsorship, and prestige tracking.

**Components:**
- Budget cap tracker: spend vs. $215M cap, category breakdown (R&D, salaries, operations, marketing)
- Prestige meter: A+ to F rating with contributing factors breakdown
- Sponsor management: active sponsors with KPI progress, renewal dates, risk indicators
- Available sponsors: filtered by prestige tier, showing requirements and value
- Marketing campaigns: investment options to boost prestige or specific revenue streams
- Season financial projection: estimated end-of-season balance

#### Screen 6: Calendar

**Purpose:** Season overview and upcoming event preparation.

**Components:**
- 22-race calendar in timeline or grid view
- Sprint weekend indicators (6 per season)
- Race cards: circuit name, date, characteristics (high/low downforce, tire wear, overtaking difficulty)
- Results for completed races (position, points gained)
- Next race detail panel: circuit map, weather forecast, historical data, setup recommendations

#### Screen 7: Regulations

**Purpose:** FIA rules, proposed changes, and political maneuvering.

**Components:**
- Current regulations summary (key rules affecting gameplay)
- Proposed changes for next season with voting interface
- Technical directives feed (mid-season rule clarifications)
- Lobbying interface: spend political capital to influence votes
- Other teams' known positions on proposals
- Regulation timeline: when current rules expire, upcoming changes

**MVP Regulations screen:** Since voting/lobbying is deferred to Phase 2, the MVP Regulations screen shows: current rules summary, a read-only timeline of upcoming pre-scripted regulation changes, and a Technical Directives feed (informational only). The voting and lobbying UI elements are not present in MVP.

---

## 5. Visual Design System: "Kinetic Command"

### 5.1 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0A0A0A` | Main background |
| `--bg-secondary` | `#111111` | Card backgrounds |
| `--bg-surface` | `rgba(255,255,255,0.03)` | Elevated surfaces |
| `--border-default` | `rgba(255,255,255,0.06)` | Default borders |
| `--accent-lime` | `#CCFF00` | Primary accent — positive states, your team, active elements |
| `--accent-cyan` | `#00E5FF` | Secondary accent — data, in-progress, informational |
| `--accent-red` | `#FF3B30` | Danger, breaking news, critical alerts |
| `--accent-amber` | `#FFC800` | Warning, caution, medium priority |
| `--accent-purple` | `#B450FF` | Narrative, rumors, story elements |
| `--text-primary` | `#FFFFFF` | Primary text |
| `--text-secondary` | `#AAAAAA` | Secondary text |
| `--text-muted` | `#888888` | Tertiary text |
| `--text-dim` | `#555555` | Disabled / very low emphasis |

### 5.2 Typography

- **Headings:** Space Grotesk — tight tracking for large sizes
- **Body:** Inter — comfortable readability
- **Data/Monospace:** JetBrains Mono — timing data, telemetry readouts, code-like displays

### 5.3 UI Patterns

- **Glassmorphic cards:** `rgba(255,255,255,0.03)` background with `1px solid rgba(255,255,255,0.06)` border, `border-radius: 8px`
- **Active/selected states:** accent color glow (`box-shadow: 0 0 8px rgba(accent, 0.15)`) + brighter border
- **Progress bars:** `4px` height, rounded, accent-colored fill on `rgba(255,255,255,0.06)` track
- **Status badges:** Small uppercase text on tinted background (e.g., `rgba(204,255,0,0.15)` with lime text)
- **Data visualization:** Filled area under curves with gradient fade, accent-colored strokes
- **Paddock Feed items:** Left border color-coded by severity, stacked vertically, newest first

### 5.4 Animation Principles

- Animate only `transform` and `opacity`
- No `transition-all`
- Hover/focus-visible/active states on all interactive elements
- Simulation updates: smooth number transitions for gaps and timing
- Commentary feed: slide-in animation for new entries
- Dashboard widgets: subtle pulse on value change

### 5.5 Accessibility

- **Color-blind safety:** All color-coded elements (paddock feed severity, sector times, status indicators) include a secondary indicator alongside color: icons (circle/triangle/diamond), text labels ("BREAKING"/"WARNING"), or patterns. No information is conveyed by color alone.
- **Keyboard navigation:** All interactive elements are focusable and operable via keyboard. Tab order follows visual layout. Strategy Room driver commands work with arrow keys + Enter.
- **Screen reader support:** Data visualizations include `aria-label` descriptions (e.g., radar chart reads out attribute values). Live race updates use `aria-live="polite"` for commentary and `aria-live="assertive"` for critical alerts.
- **High contrast mode:** A toggle in settings switches to a higher contrast variant — brighter accent colors on pure black, thicker borders, no glassmorphism. Preserves the Kinetic Command aesthetic while improving readability.
- **Reduced motion:** Respects `prefers-reduced-motion` — disables commentary slide-in, widget pulse, and number transitions. Data still updates, just without animation.

---

## 6. Data Model (Key Entities)

### 6.1 Game State
```
GameState
  ├── season: number
  ├── currentRound: number (1-22)
  ├── phase: "management" | "practice" | "qualifying" | "race" | "post-race" | "season-end"
  ├── playerTeam: TeamId
  ├── scenario: ScenarioType
  └── seed: number (deterministic randomness)
```

### 6.2 Team
```
Team
  ├��─ id, name, shortName
  ├── powerUnitSupplier: TeamId (or self for works teams)
  ├── drivers: [DriverId, DriverId]
  ├── reserveDriver: DriverId | null
  ├── staff: { technicalDirector, raceEngineer, commercialDirector, teamManager }
  ├── car: CarPerformance
  ├── rnd: RndState (tech tree progress)
  ├── finance: FinanceState
  ├── prestige: PrestigeRating
  ├── morale: number (0-100)
  └── facilities: FacilityState
```

### 6.3 Driver
```
Driver
  ├── id, firstName, lastName, nationality, age
  ├── attributes: { pace, racecraft, experience, mentality, marketability, developmentPotential }
  ├── mood: { motivation, frustration, confidence }
  ├── contract: { salary, termEnd, bonuses, releaseClauses }
  ├── season stats: { points, wins, podiums, dnfs, penalties }
  ├── rivalries: [{ driverId, intensity, cause }]
  └── developmentCurve: { peakAge, declineRate }
```

### 6.4 Race
```
Race
  ├── id, name, circuit, country, round
  ├── isSprint: boolean
  ├── characteristics: { downforceLevel, tireWear, overtakingDifficulty, weatherVariability }
  ├── compounds: [Compound, Compound, Compound] (selected by Pirelli)
  └── laps: number
```

### 6.5 Narrative Event
```
NarrativeEvent
  ├── id, type: EventThread (6 types)
  ├── severity: "breaking" | "decision" | "technical" | "rumor" | "news"
  ├── headline, body
  ├── options: [{ text, consequences }] (for decision events)
  ├── arcId: StoryArcId | null (links to multi-race arc)
  ├── expiresAtRound: number | null
  ├── defaultOutcome: ConsequenceSet | null  # applied if event expires unresolved
  └── resolved: boolean
```

**Event expiration behavior:** When a decision-required event expires without player action (player advances past `expiresAtRound`), the `defaultOutcome` is applied automatically. Default outcomes are always the "most passive" option — e.g., ignoring a poaching alert lets the engineer leave, ignoring a driver complaint lets frustration increase. A brief notification appears: "EVENT EXPIRED: [headline] — [outcome description]". This creates soft time pressure without blocking game progress.

---

## 7. Technical Architecture

### 7.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Server Components for data pages, Client Components for interactivity |
| Language | TypeScript (strict) | Type safety across game logic and UI |
| Styling | Tailwind CSS 4 | Utility-first, design token integration |
| Animation | Framer Motion | Performant, declarative animations |
| Data Viz | Recharts + custom SVG | Radar charts, degradation curves, timeline graphs |
| Client State | Zustand | Lightweight, minimal boilerplate for game state |
| Persistence | localStorage + IndexedDB | Single-player, client-side save system |
| Race Sim | Web Worker | Offload simulation computation from main thread |

### 7.2 Key Architecture Decisions

**Client-side game engine:** Since this is a pure single-player game, all simulation runs client-side. No backend server needed for MVP. Game state persists in IndexedDB as the primary store.

**Save/Load System:**
- 3 manual save slots + 1 auto-save slot
- Auto-save triggers: before each race weekend, after each race, at season end
- Save format: JSON blob stored in IndexedDB (typical save ~2-5MB for multi-season career)
- Schema versioning: each save includes a `schemaVersion` number. On load, a migration pipeline runs sequential transforms (v1→v2→v3...) to upgrade old saves to current format
- Export/import: player can download saves as `.json` files and re-import them (backup/transfer)
- No localStorage dependency — IndexedDB only (avoids 5MB limit issues)

**Web Worker for race simulation:** The lap-by-lap race engine runs in a Web Worker to keep the UI responsive during simulation.

*Worker Communication Protocol:*
- **Main → Worker messages:** `{ type: "start", raceState, seed }`, `{ type: "setSpeed", speed: 1|2|5|"max" }`, `{ type: "pause" }`, `{ type: "resume" }`, `{ type: "command", carId, command: "push"|"conserve"|"pit"|... }`, `{ type: "strategyChange", carId, strategy }`
- **Worker → Main messages:** `{ type: "lapUpdate", lap, timingTower, tireStates, gaps, events[] }`, `{ type: "commentary", entries[] }`, `{ type: "raceEnd", results }`, `{ type: "incident", incident }` (safety car, failure, weather change)
- At 1x speed, worker posts one `lapUpdate` per ~2 seconds. At MAX, worker runs all laps and streams updates as fast as main thread can consume them
- Pause/resume: worker holds simulation in a paused state, main thread can still send strategy changes while paused

**Deterministic simulation:** All randomness uses a seeded PRNG. Given the same game state + seed, the simulation produces identical results. This enables save/load reliability and future replay features.

**Narrative event system:** Events are generated by evaluating game state against a rule engine (condition → event templates). Story arcs track state across events and progress through stages. This is extensible — new event types and arcs can be added without changing the core engine.

### 7.3 File Structure

```
f1-simulation/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with nav
│   │   ├── page.tsx                  # Landing / new game
│   │   ├── paddock/                  # Dashboard
│   │   ├── factory/                  # Engineering & R&D
│   │   ├── drivers/                  # Driver management
│   │   ├── strategy/                 # Race weekend
│   │   ├── finance/                  # Financial HQ
│   │   ├── calendar/                 # Season calendar
│   │   └── regulations/             # Rules & voting
│   ├── components/
│   │   ├── ui/                       # Button, Card, Badge, ProgressBar, etc.
│   │   ├── charts/                   # RadarChart, DegradationCurve, DonutChart
│   │   ├── paddock/                  # PaddockFeed, HealthWidget, DriverCard
│   │   ├── factory/                  # TechTree, ComponentStatus, AeroAllocation
│   │   ├── drivers/                  # DriverProfile, MoodTracker, ScoutPanel
│   │   ├── strategy/                 # TimingTower, TireStrategy, Commentary, BattleForecast
│   │   ├── finance/                  # BudgetTracker, SponsorCard, PrestigeMeter
│   │   └── layout/                   # NavBar, TopBar, PageShell
│   ├── engine/                       # Game simulation (runs in Web Worker)
│   │   ├── core/                     # GameLoop, StateManager, SaveSystem
│   │   ├── engineering/              # RndEngine, ComponentLifecycle, AeroTesting
│   │   ├���─ race/                     # RaceSimulator, TireDegradation, PitStrategy, Weather
│   │   ├── drivers/                  # DriverModel, MoodSystem, AgingCurve, ContractEngine
│   │   ├── finance/                  # BudgetEngine, SponsorEngine, PrestigeCalc
│   │   ├── narrative/                # EventGenerator, StoryArcTracker, PaddockRumors
│   │   ├── regulations/              # RegulationEngine, VotingSystem
│   │   └── delegation/              # DepartmentHeadAI, AutoDecisionEngine
│   ├── data/                         # Static game data
│   │   ├── teams.ts                  # 11 teams with base stats
│   │   ├── drivers.ts                # 22+ drivers with attributes
│   │   ├── circuits.ts               # 22 circuits with characteristics
│   │   ├── scenarios.ts              # 4 starting scenarios
│   │   ├── rnd-tree.ts               # Tech tree definitions
│   │   ├── sponsors.ts               # Sponsor pool with KPIs
│   │   └── events/                   # Narrative event templates
│   ├── stores/                       # Zustand stores
│   │   ├── gameStore.ts              # Core game state
│   │   ├── uiStore.ts                # UI state (selected driver, active tab, etc.)
│   │   └── settingsStore.ts          # User preferences
│   ├── types/                        # TypeScript type definitions
│   │   ├── game.ts                   # Core game types
│   │   ├── team.ts                   # Team, Car, Staff types
│   │   ├── driver.ts                 # Driver, Contract, Mood types
│   │   ├── race.ts                   # Race, Lap, Strategy types
│   │   ├── finance.ts                # Budget, Sponsor, Prestige types
│   │   └── narrative.ts              # Event, StoryArc types
│   ├── workers/
│   │   └── raceSimWorker.ts          # Web Worker for race simulation
│   └── styles/
│       └── tokens.css                # Design tokens (CSS custom properties)
├── public/
│   ├── tracks/                       # Circuit SVGs
│   ├── teams/                        # Team color swatches / logos
│   └── fonts/                        # Space Grotesk, Inter, JetBrains Mono
├── tests/
│   ├── engine/                       # Unit tests for simulation engines
│   └── components/                   # Component tests
└── docs/
    └── superpowers/specs/            # This document
```

---

## 8. MVP Scope

### Phase 1 (MVP)

**Full implementation:**
- New game flow: team selection + scenario selection
- The Paddock dashboard with all widgets and paddock feed
- The Factory with car radar, component status, R&D tech tree (3 branches, ~12 total upgrades)
- Driver Office with roster, stats, mood tracking, basic contract negotiation
- Strategy Room with full race simulation (telemetry + commentary + driver commands)
- Calendar with 22-race schedule
- Basic Financial HQ with budget cap tracking
- Narrative engine with all 6 threads at foundational depth (2-3 event templates per thread)
- Multi-season save/load (carry-over between seasons)
- 4 starting scenarios
- Delegation system (4 department heads with auto-decisions)

**Simplified for MVP:**
- Scouting: list of available drivers with stats, no scout network investment yet
- Sponsorship: 3-5 sponsors per tier, basic KPI tracking
- Regulations: pre-scripted regulation changes per season, no voting
- Story arcs: 3-4 scripted arc templates that trigger based on conditions
- Sprint weekends: functionally identical to standard except shorter race + no mandatory pit

### Phase 2 (Post-MVP)

- Expanded narrative: 20+ event templates per thread, 10+ story arc types
- Full scouting system with F2/F3 pipeline and scout network
- Regulation voting and lobbying
- Expanded sponsor system with sponsor personalities
- Press conference mini-game
- Detailed facility management
- Season statistics and career summary screens
- Global leaderboards (requires account system)

### Phase 3 (Future)

- Asynchronous leagues
- Custom team creation (Create-a-Constructor)
- Historical seasons mode
- Mobile-optimized layout
- Dynasty mode (infinite career)

---

## 9. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Narrative events feel repetitive | Kills engagement loop | Template variety + conditional logic so events respond to unique game states |
| Race simulation feels boring | Core gameplay fails | Commentary feed adds drama; simulation speed lets players control pacing |
| Data density overwhelms users | High drop-off | Progressive disclosure; delegation system handles complexity; clean visual hierarchy |
| Balancing 11 AI teams is hard | Unfair gameplay | Deterministic sim with tunable parameters; extensive playtesting per scenario |
| Client-side storage limits | Save corruption / loss | IndexedDB with versioned saves + export/import JSON backup |
| Performance during race sim | UI jank during simulation | Web Worker offloads computation; main thread only handles render updates |

---

## 10. Success Criteria

- A player can complete a full 22-race season and want to start Season 2
- The Strategy Room race simulation creates genuine tension and excitement
- Paddock Feed events provoke emotional reactions and difficult decisions
- The game is playable and enjoyable within 15 minutes of first load (tutorial-free — UI teaches through progressive disclosure)
- A race weekend can be completed in 10-20 minutes depending on simulation speed preference
