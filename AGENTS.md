<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — Mission Control: F1 Kinetic Command

This file governs how AI agents work on this codebase. Read it before touching any file.

---

## 0. Architecture in One Page

```
src/engine/**        — Pure functions. No side effects. No browser APIs. SEEDED PRNG.
src/data/**          — Static 2026 season data. Treat as read-only unless doing a data update.
src/workers/**       — Web Worker + typed protocol. Bridges engine and store.
src/stores/**        — Zustand stores. Thin dispatch layer. All gameplay logic lives in orchestrator.
src/hooks/**         — React hooks. Adapters between store and UI. No game logic here.
src/components/**    — React components. Read from store via useShallow selectors. Kinetic Command aesthetic.
src/app/**           — Next.js App Router pages. Server Components for layout, Client Components for interactivity.
tests/**             — Vitest tests. Engines are trivially unit-testable. Use fake-indexeddb for persistence.
docs/architecture/** — ADRs and contracts. Update these when architectural decisions change.
```

**The single most important invariant:** engines under `src/engine/` are pure functions. They accept state + PRNG, return new state. They never import from stores, components, workers, or browser APIs. Violating this collapses the architecture.

**Persistence boundary:** `gameStore.world` is the only field that is persisted to IndexedDB. `raceRuntime`, `eventCooldowns`, `lastRaceResults`, `lastSeasonEnd` are session-scoped and never saved. See `docs/architecture/persistence-contract.md`.

**State machine:** The game phase (`management → practice → qualifying → race → post-race → management`) is a strict FSM. Transitions live in `src/engine/core/state-manager.ts:advancePhase()`, called by `src/engine/core/orchestrator.ts`. Nothing else may transition phases.

---

## 0.1 Environment: Active Hooks & Infrastructure

These are always active in this project and affect every agent.

### graphify Pre-Search Hook

**Trigger:** Fires automatically before every `Glob` or `Grep` call when `graphify-out/graph.json` exists.

**What it does:** The hook in `.claude/settings.json` outputs a reminder to consult the knowledge graph before raw file searching.

**Required behavior for all agents:** Before any broad codebase search, read `graphify-out/GRAPH_REPORT.md` to identify god nodes, community structure, and module boundaries. Use targeted Grep/Glob only after orienting with the graph. This prevents re-deriving what the graph already knows.

```bash
# Read graph report before searching
# File: graphify-out/GRAPH_REPORT.md
```

### Session Memory (MCP)

`mcp__plugin_claude-mem_mcp-search__smart_search` and `mcp__plugin_claude-mem_mcp-search__get_observations` are available to all agents for recalling past architectural decisions, IP-phase outcomes, and implementation rationale from previous sessions. Use these when context about a prior decision is needed rather than re-reading the entire codebase.

---

## 1. Agents and Routing

---

### Agent: `sim-engine`

**Owns:** `src/engine/**`, `src/data/**`, `src/types/**`

**Route tasks here when:**
- Adding or modifying simulation logic (tire model, race simulator, weather FSM, overtake calculator)
- Changing engineering, finance, driver, narrative, regulation, or AI engines
- Modifying static game data (teams, drivers, circuits, sponsors, R&D tree)
- Changing PRNG, state-manager, or orchestrator
- Adding schema migrations to `SaveSystem` (`src/engine/core/save-system.ts`)
- Modifying TypeScript types that affect the `FullGameState` shape

**Hard rules:**
- All functions under `src/engine/` must remain pure. No `import` of anything from `src/stores/`, `src/hooks/`, `src/components/`, or `src/app/`.
- No `window`, `document`, `localStorage`, `fetch`, `IndexedDB`, or any browser API.
- All functions must accept a `PRNG` instance when they need randomness. Never call `Math.random()`.
- `FullGameState` and all types within it must remain JSON-serializable at all times (no class instances, no `Date`, no `Map`, no `Set` — use plain objects and arrays).
- When modifying `FullGameState` shape: increment `SCHEMA_VERSION` in `save-system.ts`, add a migration entry in `MIGRATIONS`, and update `docs/architecture/persistence-contract.md`.
- When modifying orchestrator functions (`advanceGamePhase`, `processPostRacePhase`, `processSeasonEndPhase`): their signatures are frozen. New functions may be added; existing signatures must not change.
- Engine execution order during management phase is fixed: Regulation → Engineering → Financial → Driver → AI Teams → Narrative → Delegation. Do not reorder.

#### Permitted Skills & Tools

| Tool / Command | Workflow Trigger |
|---|---|
| `npx tsc --noEmit` | Run immediately after any change to `src/types/**`. Also run before handing off to `game-state`. A clean type-check is the handoff precondition. |
| `npx vitest run tests/engine tests/data` | Run after completing any engine function change. Run again after fixing a failing test to confirm the fix doesn't break adjacent tests. Do not run the full suite — that belongs to `verify`. |
| Skill: `superpowers:test-driven-development` | Invoke before writing any new engine function. Write the test first; the test defines the pure-function contract. Engine functions are trivially testable — there is no excuse to skip TDD here. |
| Skill: `superpowers:systematic-debugging` | Invoke when a bug report arrives for an engine and the root cause is not immediately obvious from reading the code. The skill provides a structured hypothesis-before-fix discipline that prevents shotgun debugging. |
| Skill: `superpowers:verification-before-completion` | Invoke before declaring any engine task complete and before handing off to `game-state`. Confirms the type-check is clean, engine tests pass, engine purity is intact, and no `Math.random()` calls were introduced. |
| Skill: `everything-claude-code:tdd` | Alternative TDD workflow — use instead of `superpowers:test-driven-development` when the task involves multiple interacting engine functions that need a test suite designed holistically before any implementation. |
| Skill: `everything-claude-code:typescript-reviewer` | Invoke after modifying `src/types/**` (especially `FullGameState`, `WorkerInMessage`, `WorkerOutMessage`). TypeScript type changes are the highest-risk surface for silent regressions. |
| Local Skill: `senior-architect` → `python .claude/skills/senior-architect/scripts/dependency_analyzer.py src/engine` | Run when adding a new engine module or after a refactor to verify no engine file has gained an illegal import (stores, hooks, components, browser APIs). Catches boundary violations the TypeScript compiler won't. |
| `mcp__plugin_claude-mem_mcp-search__smart_search` | Query before starting work on any engine that has been touched in a prior IP phase (especially race sim, orchestrator, PRNG). Prior sessions documented design constraints that are not always visible in the code itself. |

**Not permitted:** `npm run dev`, `curl localhost:*`, `frontend-design` skill, `frontend-developer` agent, `code-reviewer` agent (reviews belong to `verify`).

---

### Agent: `game-state`

**Owns:** `src/stores/**`, `src/hooks/**`, `src/workers/**`

**Route tasks here when:**
- Modifying Zustand store actions or store shape
- Changing `setupPersistence()` or autosave behavior
- Modifying `useSaveGame()` hook
- Wiring worker messages to store mutations (worker adapter)
- Changing race command bus or command dispatch
- Adding new store slices or top-level store fields
- Changing the persistence provider or boot sequence

**Hard rules:**
- `gameStore` must remain a thin dispatch layer. Store actions may call orchestrator functions and update `world`, but must contain zero game logic themselves.
- New top-level store fields default to "transient" (not persisted). If a field should be persisted, update `docs/architecture/persistence-contract.md` §1 explicitly.
- `raceRuntime` lives **outside** `world`. It is session-scoped. Autosave never touches it. This is IP-04 Option A — it is frozen and must not be revisited without an ADR.
- The race worker adapter (`src/engine/race/race-worker-adapter.ts`) is the only file that calls `worker.postMessage()` or subscribes to worker messages. Hooks and components communicate with the worker only through the store slice.
- `useSaveGame()` reads store state imperatively via `getState()`. It must not become a subscriber or cause render cycles from save/load operations.
- `setupPersistence()` fires autosave only on `world` reference change. Do not add debouncing or throttling unless write amplification is profiled and confirmed as a problem.

#### Permitted Skills & Tools

| Tool / Command | Workflow Trigger |
|---|---|
| `npx tsc --noEmit` | Run after modifying store actions, hook signatures, or worker protocol adapters. The worker protocol types in `src/types/race.ts` flow through three files; a type-check confirms all three stay in sync. |
| `npx vitest run tests/stores tests/hooks` | Run after any store action or hook change. Store and hook tests use `fake-indexeddb` — confirm tests use it correctly and do not hit real IndexedDB. |
| Skill: `superpowers:verification-before-completion` | Invoke before handing off to `ui-interface` or `verify`. Checklist: (1) store remains thin dispatch, (2) `raceRuntime` not in `world`, (3) no business logic in actions, (4) `docs/architecture/persistence-contract.md` updated if a new persisted field was added. |
| Skill: `superpowers:test-driven-development` | Invoke when adding a new store action or hook. Write the integration test (using `fake-indexeddb`) before wiring the action. This is especially critical for autosave behavior — the trigger condition (`world !== prevWorld`) must be verified by a test, not assumed. |
| Skill: `everything-claude-code:typescript-reviewer` | Invoke when modifying the worker protocol adapter (`src/workers/race-worker-protocol.ts`) or the `raceCommandBus` type. Worker protocol changes are the highest source of runtime-only bugs in this layer since the TypeScript compiler cannot validate postMessage payloads end-to-end. |
| `mcp__plugin_claude-mem_mcp-search__smart_search` | Query before any persistence or worker work. IP-04 Option A (race slice outside `world`) and IP-05 autosave rules have prior session rationale that is not fully captured in code comments. Memory prevents re-litigating frozen decisions. |
| `mcp__plugin_claude-mem_mcp-search__get_observations` | Use to retrieve specific session observation IDs (from the CMEM index in system context) when detailed implementation notes from a prior IP phase are needed (e.g., IP-04 observations 232–248). |

**Not permitted:** `npm run dev`, `curl localhost:*`, `frontend-design` skill, `frontend-developer` agent, engine scripts from `senior-architect`. Store wiring does not require a browser or architectural diagramming.

---

### Agent: `ui-interface`

**Owns:** `src/components/**`, `src/app/**`, `src/styles/**`

**Route tasks here when:**
- Building or modifying React components
- Adding or changing pages (Next.js App Router routes)
- Working on the Kinetic Command design system (tokens, tailwind config)
- Adding charts, data visualizations, or animations
- Implementing the notification system (toasts, badges, inline)
- Any task described in `docs/frontend/frontend-design-spec.md`

**Hard rules:**
- Components read from Zustand via `useShallow` selectors. Never subscribe to the full store.
- Components must not call orchestrator functions or engine functions directly. All gameplay actions go through store actions.
- Components must not import from `src/engine/**` (except types). Game logic does not belong in components.
- Race UI reads exclusively from `useRaceSimulation` hook state — never from Zustand `raceRuntime` directly. The hook is the presentation adapter.
- Design system: Dark mode, `--accent-lime: #CCFF00`, `--accent-cyan: #00E5FF`. Font stack: Space Grotesk (headings) + Inter (body). Glassmorphic card containers. No `transition-all`. Animate only `transform` and `opacity`.
- Use `page-shell.tsx` as the wrapper for all page-level routes to ensure consistent top-bar and nav.
- Progressive disclosure: Glance → Detail → Deep Dive. Do not dump all data at once.
- During race phase: toasts are suppressed. Critical events appear as highlighted commentary + screen-edge flash only.
- Server Components for layout and data-heavy shells. Client Components (`'use client'`) only where interactivity or Zustand access is needed.

#### Permitted Skills & Tools

| Tool / Command | Workflow Trigger |
|---|---|
| `npm run dev` (background) + `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/[route] --max-time 30` | Run after adding a new page route or making structural layout changes. Confirm the route returns HTTP 200 before considering the work complete. Do not validate visual output from a file path — use the running server. |
| `npx tsc --noEmit` | Run after building any component that uses Zustand selectors or store types. `useShallow` selector mismatches are common and caught only by the compiler. |
| Skill: `superpowers:brainstorm` | **Mandatory before any new screen or major component.** Do not write code until the design is approved. This project has a specific aesthetic (Kinetic Command, dark, telemetry-inspired) — brainstorming surfaces alignment with `docs/frontend/frontend-design-spec.md` before pixels are committed. |
| Local Skill: `frontend-design` (via `Skill tool`) | Invoke when designing a new component or page section from scratch. This skill enforces production-grade aesthetic decisions — bold intentional choices over generic defaults. The Kinetic Command design system is already defined; use this skill to execute within it with precision. |
| Local Agent: `frontend-developer` (via `Agent tool`) | Invoke when building a complex multi-component feature (e.g., a full new page like Driver Office or Financial HQ) that requires coordinating multiple component files, state wiring, and design system integration simultaneously. The agent uses a structured discovery → execution → handoff protocol. |
| Skill: `everything-claude-code:frontend-patterns` | Invoke when implementing non-trivial React patterns: virtualized lists (commentary feed), compound components (timing tower), or render-optimization techniques. This skill provides patterns validated for React 19 + Zustand 5. |
| Skill: `everything-claude-code:nextjs-turbopack` | Invoke before adding a new App Router route or modifying `src/app/layout.tsx`. Next.js 16 has breaking changes from training data — this skill provides the correct `app/` directory conventions for this version. |
| Skill: `simplify` | Invoke after completing a component or page to review it for unnecessary complexity, duplicated JSX patterns, or over-engineered abstractions. UI code drifts toward bloat faster than engine code. Run this as a quality gate before handing off to `verify`. |

**Not permitted:** `npx vitest run tests/engine/**`, `npx vitest run tests/stores/**` (not this agent's layer), `senior-architect` scripts, `code-reviewer` agent (reviews belong to `verify`), `everything-claude-code:typescript-reviewer` (TypeScript review is not a UI concern — store and type reviews belong to `game-state` and `sim-engine`).

---

### Agent: `verify`

**Owns:** `tests/**`

**Route tasks here when:**
- Writing tests for any layer
- Running the test suite after a change
- Debugging a failing test
- Validating determinism (run full race twice with same seed, assert identical output)
- Checking TypeScript compilation (`npx tsc --noEmit`)

**Hard rules:**
- Engine tests: test pure functions directly. No mocking of engine internals.
- Store/persistence tests: use `fake-indexeddb` for IndexedDB. Mock only browser APIs that cannot run in jsdom.
- Worker tests: drive `__handleMessage` directly with a stubbed `self.postMessage`. Do not spin up a real Worker thread in tests.
- Component tests: mock Zustand stores. Use React Testing Library. Do not test implementation details — test observable behavior.
- Determinism test: any change to `src/engine/race/**` must be accompanied by a test that runs a seeded race twice and asserts byte-identical results.
- Never skip TypeScript errors to make tests pass. Fix the type, not the check.
- Test command for the full suite: `npx vitest run`
- Test command for specific layers: `npx vitest run tests/engine/core tests/data tests/stores tests/hooks`

#### Permitted Skills & Tools

| Tool / Command | Workflow Trigger |
|---|---|
| `npx vitest run` | Run after any change from any agent before that agent's task is marked complete. This is the full-suite gate. It must pass clean — no skipped tests, no `@ts-ignore` suppressions, no `as any` escapes introduced to make tests green. |
| `npx vitest run tests/engine tests/data` | Run when `sim-engine` has completed work. Faster feedback loop before full-suite. |
| `npx vitest run tests/stores tests/hooks` | Run when `game-state` has completed work. |
| `npx tsc --noEmit` | Run as the first step of any verification pass. A failed type-check is a hard stop — do not run tests on code that doesn't type-check. |
| `npm run lint` | Run before marking any branch-level work complete (commits, PR handoffs). ESLint config (`eslint-config-next`) catches Next.js-specific anti-patterns that tests don't cover. |
| Local Agent: `code-reviewer` (via `Agent tool`) | Invoke after a major feature set is complete (a full IP phase, a new page, a significant engine addition). The agent performs a structured multi-dimension review: correctness, TypeScript strictness, security, performance, test quality. Use its CRITICAL/HIGH/MEDIUM/LOW finding format to prioritize fixes. |
| Local Command: `/code-review` (via `Skill tool`) | Invoke for targeted review of a specific file or module post-implementation (e.g., `src/engine/race/race-simulator.ts` after a lap model change). Lighter-weight than the full `code-reviewer` agent. Allowed tools: Read, Bash, Grep, Glob. |
| Local Skill: `code-reviewer` → `python .claude/skills/code-reviewer/scripts/code_quality_checker.py src/engine` | Run as an automated pre-check when reviewing engine or store changes. Surfaces quality issues (dead code, unused imports, naming inconsistencies) without reading the full file manually. |
| Local Skill: `code-reviewer` → `python .claude/skills/code-reviewer/scripts/pr_analyzer.py .` | Run when reviewing a branch before a commit or PR. Produces a structured diff-scope report so the `code-reviewer` agent knows exactly what changed and can focus on high-risk files. |
| Skill: `everything-claude-code:tdd` | Invoke when `sim-engine` or `game-state` has handed off new functionality without tests, or when tests are insufficient (e.g., missing edge cases for the tire degradation model). This skill drives the test-first discipline retroactively when needed. |
| Skill: `everything-claude-code:typescript-reviewer` | Invoke when reviewing TypeScript code quality across any layer — particularly strict-mode compliance, `any` usage, floating Promises, and null-handling in orchestrator and store action code. |
| Skill: `superpowers:receiving-code-review` | Invoke after the `code-reviewer` agent produces findings. This skill structures the process of actioning review feedback: prioritize CRITICAL/HIGH, fix and re-check, communicate changes back. Prevents findings from being ignored. |
| `mcp__plugin_claude-mem_mcp-search__smart_search` | Query when a test is failing and the failure seems related to a prior architectural decision (e.g., why `fake-indexeddb` is used instead of mocking, why worker tests use `__handleMessage` directly). Memory surfaces the reasoning faster than reading all ADRs. |

**Not permitted:** `npm run dev`, `curl localhost:*`, `frontend-design` skill, `frontend-developer` agent. `verify` does not run the application or make design decisions — it validates correctness.

---

## 2. Pipelines

### Pipeline A: New Gameplay Feature

A feature that adds simulation depth (new engine mechanic surfaced in UI).

```
sim-engine → game-state → ui-interface → verify
```

1. **sim-engine** invokes `superpowers:test-driven-development`, writes the engine function and unit tests in `tests/engine/`. Runs `npx tsc --noEmit` and `npx vitest run tests/engine`. Invokes `superpowers:verification-before-completion` before handing off.
2. **game-state** wires the engine output into the store (new action, new slice field if needed). Runs `npx tsc --noEmit` and `npx vitest run tests/stores tests/hooks`. Updates `docs/architecture/persistence-contract.md` if the field must be persisted. Invokes `superpowers:verification-before-completion`.
3. **ui-interface** invokes `superpowers:brainstorm` first. Implements components and/or page sections using the `frontend-design` skill for visual quality. Confirms HTTP 200 on the route. Invokes `simplify`.
4. **verify** runs `npx tsc --noEmit`, `npx vitest run`, `npm run lint`. Invokes `code-reviewer` agent for structured review. Actions any CRITICAL/HIGH findings via `superpowers:receiving-code-review`.

### Pipeline B: UI-Only Change

A change that does not affect simulation logic, store shape, or persistence (visual redesign, new chart, interaction tweak).

```
ui-interface → verify
```

1. **ui-interface** invokes `superpowers:brainstorm` if the change affects visual design. Implements. Confirms HTTP 200. Invokes `simplify`.
2. **verify** runs `npx tsc --noEmit` and `npx vitest run tests/` for component tests only.

### Pipeline C: Engine Bug Fix

A bug in a simulation engine that produces wrong output.

```
verify (reproduce) → sim-engine (fix) → verify (confirm)
```

1. **verify** invokes `everything-claude-code:tdd` to write a failing test that exactly reproduces the bug before touching the engine.
2. **sim-engine** invokes `superpowers:systematic-debugging` to diagnose root cause. Fixes the engine without changing function signatures visible to the store. Runs `npx vitest run tests/engine`.
3. **verify** confirms the targeted test passes. Runs `npx vitest run` to confirm no regressions. Runs `npx tsc --noEmit`.

### Pipeline D: Persistence / Schema Migration

Adding a new persisted field or changing the save format.

```
sim-engine (type + migration) → game-state (wire) → verify
```

1. **sim-engine** adds the field to `FullGameState`, increments `SCHEMA_VERSION`, adds a `MIGRATIONS` entry, and updates `docs/architecture/persistence-contract.md`. Runs `npx tsc --noEmit`.
2. **game-state** ensures autosave and manual save/load paths handle the new field correctly. Runs `npx vitest run tests/stores`.
3. **verify** adds a migration test: load a v(N-1) fixture, run `migrateToCurrent`, assert the expected v(N) shape, and assert the migrated payload is written back. Runs `npx vitest run`. Invokes `/code-review` on `save-system.ts`.

### Pipeline E: Worker Protocol Change

Changing the typed message contract between main thread and race worker.

```
sim-engine (types in src/types/race.ts) → game-state (adapter + worker) → verify
```

1. **sim-engine** updates `WorkerInMessage` / `WorkerOutMessage` / `RaceCommandEnvelope` in `src/types/race.ts`. Runs `npx tsc --noEmit`. Invokes `everything-claude-code:typescript-reviewer` on the changed types.
2. **game-state** updates `race-worker-protocol.ts` adapters and `race-worker-adapter.ts` to match. Runs `npx tsc --noEmit` and `npx vitest run tests/stores`.
3. **verify** updates worker tests in `tests/engine/race/race-sim-worker.test.ts` to cover the new message shape. JSON round-trip safety must be verified for every new inbound and outbound message type. Runs `npx vitest run`.

---

## 3. What Each Agent Must Never Do

| Agent | Never do |
|-------|----------|
| `sim-engine` | Import from `src/stores/`, `src/hooks/`, `src/components/`, `src/app/`, or any browser API |
| `sim-engine` | Call `Math.random()` — always use the seeded PRNG |
| `sim-engine` | Mutate input state — always return new state |
| `sim-engine` | Use `npm run dev` or `curl localhost` — pure functions need no browser |
| `game-state` | Put business logic in store actions |
| `game-state` | Persist `raceRuntime` or any field not listed in `docs/architecture/persistence-contract.md` §1 |
| `game-state` | Allow components or hooks to `postMessage()` to the worker directly |
| `game-state` | Use the `frontend-design` skill or `frontend-developer` agent |
| `ui-interface` | Import from `src/engine/**` (types-only imports are allowed) |
| `ui-interface` | Subscribe to the full Zustand store (always use `useShallow` with specific field selectors) |
| `ui-interface` | Put game logic or calculations in components |
| `ui-interface` | Run engine or store tests — those belong to `verify` |
| `verify` | Silence TypeScript errors with `// @ts-ignore` or `as any` to make tests green |
| `verify` | Mock engine internals — test them directly as pure functions |
| `verify` | Run `npm run dev` or make visual design decisions |
| All agents | Invoke a skill without reading its SKILL.md output — follow the skill exactly as loaded |
| All agents | Bypass the graphify pre-search hook — always consult `graphify-out/GRAPH_REPORT.md` before broad Glob/Grep searches |

---

## 4. Key File Reference

| File | Purpose |
|------|---------|
| `src/engine/core/orchestrator.ts` | Central gameplay flow (advanceGamePhase, processPostRace, processSeasonEnd) |
| `src/engine/core/state-manager.ts` | Phase FSM, initializeGame |
| `src/engine/core/save-system.ts` | IndexedDB operations, SCHEMA_VERSION, MIGRATIONS |
| `src/engine/core/prng.ts` | Seeded PRNG — only source of randomness |
| `src/stores/game-store.ts` | Thin dispatch layer, world + raceRuntime + lastRaceResults |
| `src/stores/persistence-setup.ts` | setupPersistence() autosave subscriber |
| `src/hooks/use-save-game.ts` | Manual save/load/import/export hook |
| `src/hooks/use-race-simulation.ts` | UI adapter for race (reads store, owns 60fps interpolation) |
| `src/workers/race-sim-worker.ts` | Web Worker — authoritative race simulation loop |
| `src/engine/race/race-worker-adapter.ts` | Wires worker output to store, forwards commands |
| `src/workers/race-worker-protocol.ts` | Type guards and adapter utilities for worker protocol |
| `src/types/race.ts` | WorkerInMessage, WorkerOutMessage, RaceCommandEnvelope — canonical protocol types |
| `docs/architecture/adr-001-system-architecture.md` | Architecture decisions (patterns, state ownership, testing strategy) |
| `docs/architecture/current-state-baseline.md` | Runtime truth after each IP phase — always current |
| `docs/architecture/persistence-contract.md` | Persisted vs transient fields, schema policy, migration rules |
| `docs/data/2026-season-audit.md` | Authoritative 2026 season data reference |
| `.claude/skills/frontend-design/SKILL.md` | Kinetic Command visual execution skill |
| `.claude/skills/senior-architect/scripts/dependency_analyzer.py` | Import boundary verification script |
| `.claude/skills/code-reviewer/scripts/code_quality_checker.py` | Automated quality scan script |
| `.claude/skills/code-reviewer/scripts/pr_analyzer.py` | Diff-scope analysis script |
| `.claude/agents/code-reviewer.md` | Structured review agent definition |
| `.claude/agents/frontend-developer.md` | Multi-component frontend agent definition |
| `.claude/commands/code-review.md` | `/code-review` slash command definition |
| `graphify-out/GRAPH_REPORT.md` | Knowledge graph: god nodes, community structure, module boundaries |

---

## 5. Implementation Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| IP-01 | Deterministic bootstrap | Complete |
| IP-02 | Command authority (canonical command dispatch) | Complete |
| IP-03 | Worker protocol alignment | Complete |
| IP-04 | Authoritative worker rollout (race authority → Web Worker) | Complete |
| IP-05 | Persistence hardening (migrations, observability) | Complete |
| IP-06 | OpenF1 real-data integration (tire/weather/overtake calibration, 24 circuit profiles) | Complete |
| IP-07 | OpenF1 extended integration (pit-loss, stint, pre-race intel, balance harness) | Complete |
| IP-08 | Gameplay expansion (engineer recommendations) | Complete |
| IP-09 | Race penalty system Tier A (contested-event evaluation, investigations, sanctions) | Complete |
| IP-10 | Press conference & media management | Complete |
| IP-11 | 2026 regulations Factory wedge (content module, 3 derived metrics, ribbons/tiles/info-bubbles) | Complete |
| IP-12 | Penalty system Tier C (track-state offences: RaceFlags caution FSM + 6 offence families — track-limits, rejoin-collision, yellow/sc/vsc/red flag, pit-line-crossing; 7 new OffenceTypes; no schema bump) | Complete |

When starting work on a new IP phase, read `docs/architecture/current-state-baseline.md` first. It defines what is frozen and what is open.
