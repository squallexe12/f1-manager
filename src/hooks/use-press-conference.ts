'use client'

/**
 * use-press-conference.ts — IP-10 Press Conference & Media Management
 *
 * Presentation adapter for the pending press event. Components read from
 * this hook instead of subscribing to the store directly.
 *
 * Architecture rules:
 * - Reads from store via useShallow — only subscribes to the fields it needs.
 * - Zero game logic; all calculations here are pure derivations from state.
 * - Components must not call resolvePress / skipPress directly on the store;
 *   they use the `resolve` and `skip` functions returned by this hook.
 */

import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import type { PressEvent, PressSurface, ResolvedPressQuestion } from '@/types/media'
import type { Driver } from '@/types/driver'

// Stable empty array used when world is null — prevents useShallow from seeing
// a new [] reference on each render, which would cause an infinite update loop.
const EMPTY_DRIVERS: Driver[] = []

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePressConferenceResult {
  /** The current pending press event, or null if none is queued. */
  pendingPress: PressEvent | null
  /** Convenience boolean — true when `pendingPress !== null`. */
  hasPending: boolean
  /**
   * Display label for the speaker. Either the driver's full name
   * ("Lando Norris") or "Team Principal" when no driver is assigned.
   * Empty string when there is no pending press event.
   */
  speakerLabel: string
  /**
   * Portrait URL for the speaking driver, or null when the speaker is the
   * Team Principal or the driver has no portrait set.
   */
  speakerDriverPortrait: string | null
  /** Which press conference surface this event belongs to. */
  surface: PressSurface | null
  /** Resolved questions from the pending press event (text substituted). */
  questions: ResolvedPressQuestion[]
  /**
   * Parallel array to `questions`. Element [i] is the chosen answer id for
   * question [i], or null if that question has not been answered yet.
   */
  answeredAnswerIds: (string | null)[]
  /** How many questions have been answered vs total. */
  progress: { answered: number; total: number }
  /**
   * Dispatch: answer all questions and resolve the press event.
   *
   * Callers must supply one entry per question (questionIndex → answerId).
   * The store action validates that all questions are answered before calling
   * the engine's resolvePressEvent; partial answers will throw in the engine.
   */
  resolve: (answers: Array<{ questionIndex: number; answerId: string }>) => void
  /**
   * Dispatch: skip the press event without answering.
   *
   * Applies the fixed skip penalty and writes a skipped transcript.
   */
  skip: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePressConference(): UsePressConferenceResult {
  // NOTE: drivers is typed as the real array reference or null — never a new
  // [] literal — so useShallow can stabilise it by reference comparison.
  const { pending, drivers, resolve, skip } = useGameStore(
    useShallow(s => ({
      pending: s.world?.media?.pendingPress ?? null,
      drivers: s.world?.drivers ?? null,
      resolve: s.resolvePress,
      skip: s.skipPress,
    })),
  )

  // Stable empty array constant used when drivers is null (world not loaded).
  // Declared at module level so the reference never changes between renders.
  const driversArray = drivers ?? EMPTY_DRIVERS

  // Find the speaking driver (undefined when Team Principal is the speaker)
  const speakerDriver =
    pending?.speakerDriverId != null
      ? driversArray.find(d => d.id === pending.speakerDriverId)
      : undefined

  const speakerLabel = pending
    ? speakerDriver != null
      ? `${speakerDriver.firstName} ${speakerDriver.lastName}`
      : 'Team Principal'
    : ''

  // Count answered questions
  const answered = pending?.answeredAnswerIds.filter(a => a !== null).length ?? 0
  const total = pending?.questions.length ?? 0

  return {
    pendingPress: pending,
    hasPending: pending !== null,
    speakerLabel,
    speakerDriverPortrait: speakerDriver?.portraitUrl ?? null,
    surface: pending?.surface ?? null,
    questions: pending?.questions ?? [],
    answeredAnswerIds: pending?.answeredAnswerIds ?? [],
    progress: { answered, total },
    resolve,
    skip,
  }
}
