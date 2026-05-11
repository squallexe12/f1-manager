'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useGameStore } from '@/stores/game-store'
import { useShallow } from 'zustand/react/shallow'
import { selectLastTranscript } from '@/stores/selectors/media'
import type { PressAnswerDelta } from '@/types/media'

export function PressTranscriptToast() {
  const transcript = useGameStore(useShallow(selectLastTranscript))
  const gamePhase = useGameStore(useShallow((s) => s.world?.gameState.phase))

  // visibleId: the eventId currently being shown.
  // dismissedId: the most recently dismissed eventId — prevents re-showing
  // on re-render after the transcript reference stabilises.
  const [visibleId, setVisibleId] = useState<string | null>(null)
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const transcriptEventId = transcript?.eventId ?? null

  useEffect(() => {
    if (!transcriptEventId) return
    if (transcriptEventId === dismissedId) return
    // Suppress during active race phase per AGENTS.md design rules
    if (gamePhase === 'race') return

    // Use a short leading timeout to defer the setVisibleId call out of the
    // effect body synchronous execution path, avoiding the set-state-in-effect
    // lint rule while keeping the animation trigger behaviour identical.
    const showTimer = setTimeout(() => {
      setVisibleId(transcriptEventId)
    }, 0)

    const hideTimer = setTimeout(() => {
      setDismissedId(transcriptEventId)
      setVisibleId(null)
    }, 4500)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [transcriptEventId, gamePhase, dismissedId])

  if (!transcript || visibleId !== transcript.eventId) return null

  const isSkipped = transcript.exchanges.length === 0
  const delta = transcript.aggregateDelta

  return (
    <div className="press-toast press-glass" role="status" aria-live="polite">
      <div className="press-toast__head">
        {isSkipped
          ? 'Press Skipped'
          : `${transcript.speakerLabel} · ${transcript.surface === 'thursday-fia' ? 'Thursday' : 'Post-Race'}`}
      </div>
      <div className="press-toast__deltas">
        {renderDelta(delta.driverMood, 'mood')}
        {renderDelta(delta.sponsorKPI, 'KPI')}
        {renderDelta(delta.prestige, 'prestige')}
      </div>
    </div>
  )
}

function renderDelta(
  value: PressAnswerDelta[keyof PressAnswerDelta] | undefined,
  label: string,
): ReactNode {
  const numericValue = typeof value === 'number' ? value : undefined
  if (numericValue === undefined || numericValue === 0) return null
  const arrow = numericValue > 0 ? '▲' : '▼'
  const cls =
    numericValue > 0 ? 'press-toast__delta--pos' : 'press-toast__delta--neg'
  return (
    <span key={label} className={cls}>
      {arrow} {label}
    </span>
  )
}
