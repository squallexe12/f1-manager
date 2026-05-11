/**
 * media.ts — Zustand selectors for the media / press conference slice.
 *
 * These are pure selector functions that take store state and return a
 * derived value. Use with `useGameStore(selector)` or `useShallow` in hooks.
 *
 * Architecture: selectors live outside the store itself so they can be
 * imported by hooks and components without importing the full store factory.
 */

import type { GameStore } from '@/stores/game-store'
import type { PressEvent, PressTranscript } from '@/types/media'

/** Returns the pending press event, or null if none is queued. */
export const selectPendingPress = (s: GameStore): PressEvent | null =>
  s.world?.media?.pendingPress ?? null

/** Returns the full transcripts array (most-recent last). */
export const selectPressTranscripts = (s: GameStore): PressTranscript[] =>
  s.world?.media?.transcripts ?? []

/**
 * Returns the most recently completed/skipped transcript, or null if there
 * are no transcripts yet.
 */
export const selectLastTranscript = (s: GameStore): PressTranscript | null => {
  const ts = s.world?.media?.transcripts
  return ts && ts.length > 0 ? ts[ts.length - 1] : null
}
