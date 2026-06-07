'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import { fpCount } from '@/types/weekend'
import type { PracticeProgram } from '@/types/weekend'
import type { CommentaryEntry, SimSpeed, TireCompound } from '@/types/race'
import type { PracticeDriverLive, PracticeStatus } from '@/stores/practice-runtime-slice'

/**
 * Practice live-screen presentation adapter (plan §M5). Mirrors the
 * `use-race-simulation` pattern: reads transient `practiceRuntime` + the durable
 * `world.weekendState` via `useShallow` selectors, owns the client-side reveal
 * loop (a `setInterval` that ticks the session clock and interpolates each
 * driver's setup bars toward the values committed by `runPracticeSession`), and
 * exposes thin action wrappers for the screen. No engine imports (types only) —
 * all game logic lives in the engine/store; the reveal here is pure theatre and
 * never feeds back into `world`.
 */

/** Session clock, seconds. Mirrors engine SESSION_TIME_BUDGET_MINS = 60 (kept
 *  local so the UI imports no engine values — AGENTS.md). */
export const PRACTICE_SESSION_SECONDS = 60 * 60

/** Reveal is divided into this many clock steps; each interval advances one.
 *  The per-step decrement is derived from the SEEDED session budget (captured in
 *  the anchor), not a module constant, so the reveal stays correct for any
 *  `timeBudget` a future caller might pass to startPracticeSession. */
const REVEAL_TOTAL_STEPS = 30

/** Wall-clock interval per sim speed (ms) — faster speed, shorter reveal. */
const REVEAL_INTERVAL_MS: Record<string, number> = { '1': 450, '2': 260, '5': 130, 'max': 40 }

const COMPOUND_ROLE = ['hard', 'medium', 'soft'] as const
export type CompoundRole = (typeof COMPOUND_ROLE)[number]

export interface PracticeTireSet {
  compound: TireCompound
  role: CompoundRole
  setsRemaining: number
}

export interface PracticeDriverView {
  driverId: string
  code: string
  teamColor: string
  isPlayer: boolean
  program: PracticeProgram | null
  compound: TireCompound | null
  setupConfidence: number
  tireDegRead: number
  lapsCompleted: number
}

export interface PracticeSessionView {
  status: PracticeStatus
  simSpeed: SimSpeed
  timeRemaining: number
  timeBudget: number
  isSprint: boolean
  fpTotal: number
  completedCount: number
  activeFpIndex: number
  sessionLabel: string
  sessionName: string
  allFpDone: boolean
  circuitId: string
  circuitName: string
  raceName: string
  round: number
  circuitCompounds: TireCompound[]
  ledger: PracticeTireSet[]
  /** Per-compound sets remaining — the same data as `ledger`, keyed for the
   *  driver tire picker (so the screen doesn't re-derive it). */
  setsByCompound: Partial<Record<TireCompound, number>>
  setsRemaining: number
  drivers: PracticeDriverView[]
  /** Driver leading the session by accrued setup confidence; null before any
   *  progress (hero strip renders '—'). */
  leader: { driverId: string; code: string; teamColor: string; setupConfidence: number } | null
  commentary: CommentaryEntry[]
  /** True when an FP sub-session can be launched (idle and FPs remain). */
  canStart: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Per-driver from→to reveal anchors captured at session start, plus the seeded
 *  session budget the reveal interpolates against. */
interface RevealAnchor {
  from: Record<string, { setup: number; tire: number }>
  to: Record<string, { setup: number; tire: number; laps: number }>
  budget: number
}

export function usePracticeSession() {
  // Transient slice — changes on every reveal tick (intended; the screen must
  // re-render to animate the clock + bars).
  const runtime = useGameStore((s) => s.practiceRuntime)

  // Durable bits — stable references during a session (world only mutates once,
  // at commit). `useShallow` means an unrelated store change (e.g. raceRuntime)
  // returns the same object and triggers no re-render.
  const world = useGameStore(
    useShallow((s) => ({
      weekendState: s.world?.weekendState,
      gameState: s.world?.gameState,
      drivers: s.world?.drivers,
      teams: s.world?.teams,
      calendar: s.world?.calendar,
    })),
  )

  // Store actions (stable refs in Zustand — selecting them never re-renders).
  // startPracticeSession / runPracticeSession are dispatched via getState() inside
  // startSubSession (so the commit reads the freshest world), so they are not
  // selected here.
  const tickPractice = useGameStore((s) => s.tickPractice)
  const revealPracticeProgress = useGameStore((s) => s.revealPracticeProgress)
  const pushPracticeCommentary = useGameStore((s) => s.pushPracticeCommentary)
  const pausePractice = useGameStore((s) => s.pausePractice)
  const resumePractice = useGameStore((s) => s.resumePractice)
  const setPracticeSpeed = useGameStore((s) => s.setPracticeSpeed)
  const selectPracticeRunPlan = useGameStore((s) => s.selectPracticeRunPlan)
  const selectPracticeTire = useGameStore((s) => s.selectPracticeTire)
  const advancePracticeSubSession = useGameStore((s) => s.advancePracticeSubSession)
  const advancePhase = useGameStore((s) => s.advancePhase)

  const { weekendState, gameState, drivers, teams, calendar } = world
  const round = gameState?.currentRound ?? 1
  const race = calendar?.[round - 1]
  const isSprint = race?.isSprint ?? false
  const fpTotal = fpCount(isSprint)
  const completedCount = weekendState?.practiceResults.length ?? 0

  const playerTeamId = gameState?.playerTeamId ?? ''
  const circuitCompounds = useMemo<TireCompound[]>(
    () => (race?.circuit.compounds ? [...race.circuit.compounds] : []),
    // Dep is the whole `race` to match what the React Compiler infers (a nested
    // `race?.circuit.compounds` dep is rejected as "less specific"). `race` is a
    // stable reference for the whole weekend, so this never over-recomputes.
    [race],
  )

  // Player racers in stable roster order — the engine's PRNG stream order.
  const playerRacers = useMemo(
    () => (drivers ?? []).filter((d) => d.teamId === playerTeamId && !d.isReserve && !d.isF2),
    [drivers, playerTeamId],
  )

  const teamColorById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of teams ?? []) m[t.id] = t.color
    return m
  }, [teams])

  // ── Reveal loop ────────────────────────────────────────────────────────────
  const anchorRef = useRef<RevealAnchor | null>(null)
  const status = runtime.status
  const simSpeed = runtime.simSpeed

  // Capture from→to anchors exactly once when a session begins (idle → running).
  // `from` = the pre-session live values seeded by startSubSession; `to` = the
  // values `runPracticeSession` just committed to world.weekendState.
  const prevStatusRef = useRef<PracticeStatus>('idle')
  useEffect(() => {
    if (status === 'running' && prevStatusRef.current !== 'running' && anchorRef.current === null) {
      const pr = useGameStore.getState().practiceRuntime
      const ws = useGameStore.getState().world?.weekendState
      const live = pr.driverLive
      const result = ws?.practiceResults[ws.practiceResults.length - 1]
      const from: RevealAnchor['from'] = {}
      const to: RevealAnchor['to'] = {}
      for (const [id, l] of Object.entries(live)) {
        from[id] = { setup: l.setupConfidence, tire: l.tireDegRead }
        const setup = ws?.driverSetup[id]
        const dr = result?.driverResults.find((r) => r.driverId === id)
        to[id] = {
          setup: setup?.setupConfidence ?? l.setupConfidence,
          tire: setup?.tireDegRead ?? l.tireDegRead,
          laps: dr?.lapsCompleted ?? 0,
        }
      }
      // Budget = the seeded clock at session start (before any tick).
      anchorRef.current = { from, to, budget: pr.timeRemaining || PRACTICE_SESSION_SECONDS }
    }
    // Drop the anchor on any reset out of a live session. The session-end snap
    // effect ALSO consumes (nulls) it after snapping, so a fresh session always
    // re-captures even on an (unused-today) session-end → running re-entry.
    if (status === 'idle') anchorRef.current = null
    prevStatusRef.current = status
  }, [status])

  // Tick the clock + interpolate the bars while running.
  useEffect(() => {
    if (status !== 'running') return
    const intervalMs = REVEAL_INTERVAL_MS[String(simSpeed)] ?? 450
    const id = setInterval(() => {
      const anchor = anchorRef.current
      const budget = anchor?.budget || PRACTICE_SESSION_SECONDS
      tickPractice(budget / REVEAL_TOTAL_STEPS)
      const tr = useGameStore.getState().practiceRuntime.timeRemaining
      const frac = clamp(1 - tr / budget, 0, 1)
      if (anchor) {
        for (const id2 of Object.keys(anchor.to)) {
          const f = anchor.from[id2] ?? { setup: 0, tire: 0 }
          const t = anchor.to[id2]
          revealPracticeProgress(
            id2,
            lerp(f.setup, t.setup, frac),
            lerp(f.tire, t.tire, frac),
            Math.round(lerp(0, t.laps, frac)),
          )
        }
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [status, simSpeed, tickPractice, revealPracticeProgress])

  // On session-end, snap every driver to the committed targets exactly so the
  // bars always rest on the durable value (never a rounding remainder).
  useEffect(() => {
    if (status !== 'session-end') return
    const anchor = anchorRef.current
    if (!anchor) return
    for (const id of Object.keys(anchor.to)) {
      const t = anchor.to[id]
      revealPracticeProgress(id, t.setup, t.tire, t.laps)
    }
    // Consume the anchor so a subsequent session always re-captures fresh
    // from→to/budget — robust even if a future FSM path re-enters running from
    // session-end without passing through idle.
    anchorRef.current = null
  }, [status, revealPracticeProgress])

  // ── View-model ───────────────────────────────────────────────────────────--
  const activeFpIndex = status === 'idle' ? completedCount : runtime.sessionIndex
  const allFpDone = completedCount >= fpTotal

  const driverViews: PracticeDriverView[] = useMemo(() => {
    return playerRacers.map((d) => {
      const l = runtime.driverLive[d.id]
      const durable = weekendState?.driverSetup[d.id]
      return {
        driverId: d.id,
        code: d.shortName,
        teamColor: teamColorById[d.teamId ?? ''] ?? '#666',
        isPlayer: true,
        program: l?.program ?? null,
        compound: l?.compound ?? null,
        // Before a session starts the slice is empty — fall back to the durable
        // accrued figures so the bars show real standing, not zero.
        setupConfidence: l?.setupConfidence ?? durable?.setupConfidence ?? 0,
        tireDegRead: l?.tireDegRead ?? durable?.tireDegRead ?? 0,
        lapsCompleted: l?.lapsCompleted ?? 0,
      }
    })
  }, [playerRacers, runtime.driverLive, weekendState?.driverSetup, teamColorById])

  const ledger: PracticeTireSet[] = useMemo(() => {
    const remaining = weekendState?.tireLedger.remaining ?? {}
    return circuitCompounds.map((compound, i) => ({
      compound,
      role: COMPOUND_ROLE[i] ?? 'soft',
      setsRemaining: remaining[compound] ?? 0,
    }))
  }, [weekendState?.tireLedger.remaining, circuitCompounds])

  const setsRemaining = useMemo(() => ledger.reduce((sum, r) => sum + r.setsRemaining, 0), [ledger])

  const setsByCompound = useMemo(
    () =>
      ledger.reduce<Partial<Record<TireCompound, number>>>((acc, r) => {
        acc[r.compound] = r.setsRemaining
        return acc
      }, {}),
    [ledger],
  )

  const leader = useMemo(() => {
    // No session leader until at least one FP has been committed this weekend —
    // before that both drivers sit on the identical skip baseline (hero '—').
    if (completedCount === 0) return null
    let best: PracticeSessionView['leader'] = null
    for (const d of driverViews) {
      if (d.setupConfidence <= 0) continue
      if (!best || d.setupConfidence > best.setupConfidence) {
        best = { driverId: d.driverId, code: d.code, teamColor: d.teamColor, setupConfidence: d.setupConfidence }
      }
    }
    return best
  }, [driverViews, completedCount])

  const state: PracticeSessionView = useMemo(
    () => ({
      status,
      simSpeed,
      timeRemaining: runtime.timeRemaining,
      timeBudget: PRACTICE_SESSION_SECONDS,
      isSprint,
      fpTotal,
      completedCount,
      activeFpIndex,
      sessionLabel: `FP${activeFpIndex + 1}`,
      sessionName: `Free Practice ${activeFpIndex + 1}`,
      allFpDone,
      circuitId: race?.circuit.id ?? '',
      circuitName: race?.circuit.name ?? '',
      raceName: race?.name ?? '',
      round,
      circuitCompounds,
      ledger,
      setsByCompound,
      setsRemaining,
      drivers: driverViews,
      leader,
      commentary: runtime.commentary,
      canStart: status === 'idle' && !allFpDone,
    }),
    [
      status, simSpeed, runtime.timeRemaining, runtime.commentary, isSprint, fpTotal,
      completedCount, activeFpIndex, allFpDone, circuitCompounds, ledger, setsByCompound,
      setsRemaining, driverViews, leader, race, round,
    ],
  )

  // ── Action wrappers ──────────────────────────────────────────────────────--
  const selectRunPlan = useCallback(
    (driverId: string, program: PracticeProgram) => selectPracticeRunPlan(driverId, program),
    [selectPracticeRunPlan],
  )
  const selectTire = useCallback(
    (driverId: string, compound: TireCompound) => selectPracticeTire(driverId, compound),
    [selectPracticeTire],
  )
  const setSpeed = useCallback((speed: SimSpeed) => setPracticeSpeed(speed), [setPracticeSpeed])
  const pause = useCallback(() => pausePractice(), [pausePractice])
  const resume = useCallback(() => resumePractice(), [resumePractice])

  const codeFor = useCallback(
    (driverId: string) =>
      playerRacers.find((d) => d.id === driverId)?.shortName ?? driverId.slice(0, 3).toUpperCase(),
    [playerRacers],
  )
  const sendLap = useCallback(
    (driverId: string) => {
      pushPracticeCommentary([
        { lap: activeFpIndex + 1, text: `${codeFor(driverId)} sent out for a flying lap.`, severity: 'highlight' },
      ])
    },
    [pushPracticeCommentary, codeFor, activeFpIndex],
  )
  const abortLap = useCallback(
    (driverId: string) => {
      pushPracticeCommentary([
        { lap: activeFpIndex + 1, text: `${codeFor(driverId)} aborts the lap and returns to the garage.`, severity: 'info' },
      ])
    },
    [pushPracticeCommentary, codeFor, activeFpIndex],
  )

  // Launch the active FP sub-session: seed the live reveal at the PRE-session
  // accrued setup (anchor `from`), THEN commit the durable result. Order matters
  // — startPracticeSession reads the pre-commit FP index, runPracticeSession then
  // appends the result and overwrites driverSetup with the reveal's `to` targets.
  const startSubSession = useCallback(() => {
    const st = useGameStore.getState()
    const w = st.world
    if (!w) return
    const racers = w.drivers.filter(
      (d) => d.teamId === w.gameState.playerTeamId && !d.isReserve && !d.isF2,
    )
    const live = st.practiceRuntime.driverLive
    const programByDriver: Record<string, PracticeProgram> = {}
    const runCompoundByDriver: Record<string, TireCompound> = {}
    const initial: PracticeDriverLive[] = racers.map((d) => {
      const sel = live[d.id]
      const setup = w.weekendState.driverSetup[d.id]
      if (sel?.program) programByDriver[d.id] = sel.program
      if (sel?.compound) runCompoundByDriver[d.id] = sel.compound
      return {
        driverId: d.id,
        program: sel?.program ?? null,
        compound: sel?.compound ?? null,
        setupConfidence: setup?.setupConfidence ?? 0,
        tireDegRead: setup?.tireDegRead ?? 0,
        lapsCompleted: 0,
      }
    })
    st.startPracticeSession(initial, PRACTICE_SESSION_SECONDS)
    st.runPracticeSession(programByDriver, runCompoundByDriver)
  }, [])

  const advanceSubSession = useCallback(() => advancePracticeSubSession(), [advancePracticeSubSession])
  const skipToQualifying = useCallback(() => advancePhase(), [advancePhase])

  return {
    state,
    selectRunPlan,
    selectTire,
    setSpeed,
    pause,
    resume,
    sendLap,
    abortLap,
    startSubSession,
    advanceSubSession,
    skipToQualifying,
  }
}
