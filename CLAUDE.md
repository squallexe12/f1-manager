# CLAUDE.md - MISSION CONTROL: F1 Kinetic Command

# Project Constitution
Read the @AGENTS.md file and execute all my commands in accordance with the architectural rules and pipeline workflows outlined there.

## Context Navigation
When you need to understand the codebase, docs, or any files in this project:
1. ALWAYS query the knowledge graph first: `/graphify query "your question"`
2. Only read raw files if I explicitly say "read the file" or "look at the raw file"
3. Use `graphify-out/wiki/index.md` as your navigation entrypoint for browsing structure


## Project Identity

**Project Name:** MISSION CONTROL: F1 Kinetic Command
**Type:** Web-Based F1 Management Simulation Game
**Core Concept:** A "Football Manager" style turn-based/asynchronous F1 team management game where players act as Team Principal, making strategic decisions across engineering, drivers, finance, and race operations.
**Target:** F1 enthusiasts who want deep strategic gameplay in a premium, futuristic web interface.

---

## Product Requirements Document (PRD)

### 1. Executive Summary

Mission Control is a high-fidelity F1 management web application for enthusiasts who want the strategic depth of Football Manager applied to Formula 1. Players command a constructor through full seasons, making decisions on R&D, driver management, race strategy, sponsorships, and regulations. The game uses real 2026 F1 regulation data as its foundation, with 11 teams, 22 drivers, and authentic race mechanics.

**Core Philosophy:** "Signal over Noise" — deep simulation presented through a sleek, futuristic telemetry-inspired interface using progressive disclosure.

### 2. Problem Statement

Existing F1 games are either arcade-style racing (EA F1 series) or cancelled management sims (Frontier's F1 Manager series ended after 2024). Web-based options like iGP Manager and F1Manager.info are simplistic. There is no premium, web-first management experience that captures the full depth of running an F1 team — from aero development to driver egos to pit strategy.

### 3. Goals & Objectives

- **Engagement:** Create a "just one more race" loop through dynamic events, driver mentality, and poaching mechanics
- **Immersion:** Every screen feels like a high-tech telemetry command center
- **Accessibility:** Progressive disclosure — deep data without overwhelming new users
- **Authenticity:** Ground simulation in real F1 2026 regulations, teams, and mechanics

### 4. Target Audience

- **Primary:** F1 fans (20-50) who follow technical analysis and enjoy strategic depth
- **Secondary:** Football Manager / Motorsport Manager fans seeking a modern web-first alternative

---

## Game Mechanics & Systems

### 5. Season Structure

Based on the real 2026 F1 calendar:
- **22 Grand Prix events** per season
- **6 Sprint weekends** (Canada, Netherlands, Singapore, Britain, etc.)
- **Standard weekend:** FP1 → FP2 → FP3 → Qualifying → Race
- **Sprint weekend:** FP1 → Sprint Qualifying → Sprint → Qualifying → Race
- **Inter-season:** Contract negotiations, R&D planning, regulation voting, facility upgrades

### 6. Teams & Drivers (Based on Real 2026 Grid)

**11 Constructors:**
| Team | Driver 1 | Driver 2 | Power Unit |
|------|----------|----------|------------|
| McLaren | Lando Norris | Oscar Piastri | Mercedes |
| Mercedes | George Russell | Kimi Antonelli | Mercedes |
| Red Bull | Max Verstappen | Isack Hadjar | Red Bull |
| Ferrari | Charles Leclerc | Lewis Hamilton | Ferrari |
| Williams | Alex Albon | Carlos Sainz | Mercedes |
| Racing Bulls | Liam Lawson | Arvid Lindblad | Red Bull |
| Aston Martin | Fernando Alonso | Lance Stroll | Honda |
| Haas | Esteban Ocon | Oliver Bearman | Ferrari |
| Alpine | Pierre Gasly | Franco Colapinto | Renault |
| Cadillac | Valtteri Bottas | Sergio Perez | Ferrari |
| Audi | Nico Hulkenberg | Gabriel Bortoleto | Audi |

**Driver Attributes:**
- Pace (raw speed, qualifying performance)
- Racecraft (overtaking, wheel-to-wheel, defensive driving)
- Experience (consistency, tire management, wet weather)
- Mentality (pressure handling, motivation, frustration threshold)
- Marketability (sponsor appeal, social media presence)
- Development Potential (improvement ceiling for young drivers)

### 7. Engineering & R&D System

**2026 Regulation Foundation:**
- 1.6L V6 Turbo Hybrid with ~50/50 ICE/Electric power split
- No MGU-H (removed for 2026)
- Active Aerodynamics (front + rear wing adjustment)
- No traditional DRS — replaced by "Straight Mode" and "Overtake Mode"
- Advanced Sustainable Fuels mandatory
- Smaller, narrower, lighter cars (3400mm wheelbase, reduced floor width)

**R&D Tech Tree (Multi-Tier):**
- **Chassis:** Front Wing, Rear Wing, Floor/Diffuser, Sidepods, Suspension
- **Power Unit:** ICE, ERS/Battery, Turbo, Energy Recovery Efficiency
- **Active Aero System:** Straight Mode efficiency, Overtake Mode effectiveness
- **Reliability:** Component lifespan, failure probability reduction

**Aerodynamic Testing:**
- Wind Tunnel hours allocation (FIA-regulated limits)
- CFD (Computational Fluid Dynamics) simulation runs
- Trade-off: High-downforce vs. Low-drag development paths
- Circuit-specific setup optimization

**Component Lifecycle:**
- Power Unit elements have allocation limits per season
- Grid penalties for exceeding allocations
- Reliability vs. Performance trade-off per component

### 8. Race Strategy System

**Tire Management:**
- Compounds: C1 (Hard) through C5 (Soft) — Pirelli selects 3 per race
- Degradation curves: affected by track surface, temperature, driving style, car weight
- Tire life prediction with visual degradation graphs
- Mandatory compound change during race (except Sprint)

**Pit Stop Strategy:**
- **Undercut:** Pit early, gain time on fresh tires while rival is on worn rubber
- **Overcut:** Stay out longer, build gap, pit later with track position
- **Optimum Window:** AI-calculated ideal pit lap based on degradation model
- Pit crew performance affects stop time (training investable)

**Race Simulation:**
- Weather system (dry, damp, wet, changing conditions)
- Safety Car / Virtual Safety Car events
- Mechanical failure probability (based on reliability investment)
- Driver-to-driver battles influenced by racecraft + car performance delta
- Real-time strategy adjustments: fuel mode, tire management, push/conserve

**Sprint Race Rules:**
- 100km distance, no mandatory pit stop
- Top 8 score points (8-7-6-5-4-3-2-1)
- Sprint Qualifying: Medium tires for SQ1/SQ2, Soft for SQ3

### 9. Driver Management

**Contract System:**
- Salary negotiation (affects budget cap)
- Contract length (1-3 years)
- Performance bonuses and clauses
- Release clauses and buyout options
- Driver happiness affects willingness to re-sign

**Mentality & Morale:**
- Dynamic mood system: motivation, frustration, confidence
- Affected by: race results, team treatment, car competitiveness, teammate rivalry
- Low morale = more mistakes, worse feedback, potential contract demands
- High morale = overperformance, better tire management, team harmony

**Scouting & Development:**
- F2/F3 talent pipeline
- Scout network investment
- Young Driver Programme
- Reserve driver slot
- Poaching mechanics: AI teams can target your drivers (and vice versa)
- "Poaching Alerts" defense system

### 10. Financial System

**Budget Cap (Based on 2026 Rules):**
- Team operations cap: $215 million
- Power unit manufacturer cap: $130 million
- Real-time spend tracking against FIA hard cap
- Penalty system for overspending (points deduction, wind tunnel reduction)

**Revenue Streams:**
- Constructor Championship prize money (based on final standings)
- Sponsorship deals (title, major, minor sponsors)
- Marketing campaigns and merchandise
- Facility rentals and licensing

**Sponsorship System:**
- Sponsor tiers: Title ($$$), Major ($$), Minor ($)
- Each sponsor has KPIs: finish positions, screen time, social media reach
- Meeting KPIs unlocks bonus payments
- Failing KPIs risks sponsor departure
- **Prestige Rating** (A+ to F): determines which sponsors are available
- Prestige affected by: results, media coverage, driver marketability, scandals

### 11. Regulation & Politics

- FIA regulation proposals between seasons
- Team voting on rule changes (e.g., weight limits, cost cap adjustments)
- Technical directives mid-season that can affect car performance
- Lobbying system: influence regulation outcomes
- Concorde Agreement negotiations

### 12. The Paddock (Social Layer)

- **Paddock Rumors:** AI-generated news feed with transfer gossip, technical leaks, team drama
- **Media Management:** Press conference responses affect team image
- **Rivalry System:** Driver vs. driver, team vs. team dynamics
- **Team Morale:** Staff satisfaction affects R&D speed and pit crew performance

---

## Technical Specifications

### 13. Design System: "Kinetic Command"

- **Theme:** Dark mode primary, high-tech telemetry aesthetic
- **Colors:** Deep blacks/dark grays, Neon Lime (#CCFF00) and Cyan (#00E5FF) accents
- **Typography:** Space Grotesk (headings), Inter (body)
- **UI Elements:** Glassmorphic containers, high-contrast data visualization
- **Data Viz:** Radar charts, degradation curves, timeline graphs, circuit maps
- **Motion:** Purposeful micro-animations on state changes, no gratuitous animation
- **Layout:** Dashboard-driven, card-based progressive disclosure

### 14. Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Framer Motion (animations)
- Recharts / D3.js (data visualization)
- Zustand (client state management)

**Backend:**
- Node.js with Express or Fastify
- PostgreSQL (primary database)
- Prisma ORM
- Redis (caching, session management)
- WebSocket for live race simulation updates

**Infrastructure:**
- Vercel (frontend deployment)
- Docker containers for backend
- GitHub Actions (CI/CD)

### 15. Core Pages / Screens

1. **The Paddock (Dashboard)** — Race countdown, team health widgets, paddock rumors feed
2. **The Factory (Engineering)** — R&D tech tree, component status, aero testing allocation
3. **Driver Office** — Roster, driver stats radar, mentality tracking, scouting, contracts
4. **Strategy Room** — Race weekend flow: practice → qualifying → race simulation
5. **Financial HQ** — Budget cap tracker, sponsorship management, prestige meter
6. **Calendar** — Season schedule, upcoming events, sprint indicators
7. **Regulations** — Current rules, proposed changes, voting interface
8. **Team Settings** — Facilities, staff, pit crew training, livery customization

### 16. Game Flow Per Round

1. **Pre-Race (Between Events):**
   - Allocate R&D resources
   - Manage driver contracts / scouting
   - Handle sponsor KPIs
   - Review paddock news
   - Upgrade facilities

2. **Race Weekend:**
   - **Practice Sessions:** Gather data, test setups (choose programs: race pace, qualifying sim, tire test)
   - **Qualifying:** Watch results, adjust based on grid position
   - **Race:** Set strategy (tire plan, pit windows), react to live events (weather, safety car, failures)
   - **Post-Race:** Review results, check budget impact, driver morale update

3. **Season End:**
   - Final standings and prize money
   - Contract renewals / driver market
   - Regulation voting
   - R&D reset for new season

### 17. MVP Scope (Phase 1)

**In Scope:**
- Single-player season mode (pick one of 11 teams)
- Full 22-race calendar with race simulation
- R&D tech tree (simplified: 3 main branches)
- Driver management (2 drivers + reserve)
- Basic financial system with budget cap
- Tire strategy and pit stop planning
- Dashboard with paddock rumors
- Responsive web UI (desktop-first, mobile-friendly)

**Out of Scope (Future Phases):**
- Multiplayer / league mode
- 3D track visualization
- Custom team creation (Create-a-Constructor)
- Mobile native app
- Real-time head-to-head racing
- Historical seasons mode
- Detailed facility management

### 18. Success Metrics

- **Retention:** % of users completing a full 22-race season
- **Session Length:** Average time per race weekend session
- **Engagement:** Frequency of return visits between simulated race weekends
- **Virality:** Screenshot sharing of results, standings, and scouting reports

---

## Development Standards

### Code Quality
- TypeScript strict mode everywhere
- ESLint + Prettier enforced
- Component-driven architecture (atomic design)
- Server Components for data-heavy pages, Client Components for interactivity
- API routes with proper validation (Zod schemas)

### Testing
- Unit tests for game simulation engine
- Integration tests for API endpoints
- E2E tests for critical user flows (race weekend, contract negotiation)

### Performance
- Target: < 2s initial page load
- Lazy load non-critical dashboard widgets
- Efficient database queries with proper indexing
- Redis caching for computed standings and statistics

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatible data visualizations
- High contrast mode option (given dark theme default)

---

## File Structure Convention

```
f1-simulation/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (dashboard)/        # Dashboard layout group
│   │   ├── factory/            # Engineering/R&D
│   │   ├── drivers/            # Driver management
│   │   ├── strategy/           # Race strategy
│   │   ├── finance/            # Financial HQ
│   │   ├── calendar/           # Season calendar
│   │   └── api/                # API routes
│   ├── components/             # Shared UI components
│   │   ├── ui/                 # Atomic UI primitives
│   │   ├── dashboard/          # Dashboard-specific
│   │   ├── factory/            # Factory-specific
│   │   ├── drivers/            # Driver-specific
│   │   ├── strategy/           # Strategy-specific
│   │   └── finance/            # Finance-specific
│   ├── lib/                    # Utilities and helpers
│   │   ├── engine/             # Game simulation engine
│   │   ├── db/                 # Database client & queries
│   │   ├── stores/             # Zustand stores
│   │   └── utils/              # General utilities
│   ├── types/                  # TypeScript type definitions
│   └── styles/                 # Global styles & design tokens
├── prisma/                     # Database schema & migrations
├── public/                     # Static assets
│   ├── tracks/                 # Circuit SVGs/images
│   ├── teams/                  # Team logos & liveries
│   └── drivers/                # Driver portraits
├── tests/                      # Test files
└── docs/                       # Documentation
```

---

## Key Constraints

- All game logic must be deterministic given the same seed (for reproducibility)
- Race simulation must feel dynamic but be fair — no pure RNG outcomes
- Budget cap violations must have meaningful consequences
- Driver attributes must evolve realistically over seasons
- The UI must never feel like a spreadsheet — every data point needs visual context

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
