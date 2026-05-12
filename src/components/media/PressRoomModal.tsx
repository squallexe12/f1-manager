'use client'

import { useState, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePressConference } from '@/hooks/use-press-conference'
import { useGameStore } from '@/stores/game-store'
import { PressRoomBackdrop } from './PressRoomBackdrop'
import { PressSpeakerCard } from './PressSpeakerCard'
import { PressQuestionPanel } from './PressQuestionPanel'
import { PressProgressDots } from './PressProgressDots'
import '@/styles/media.css'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function PressRoomModal({ isOpen, onClose }: Props) {
  const press = usePressConference()

  const teamName = useGameStore(
    useShallow(s => {
      const playerId = s.world?.gameState.playerTeamId
      return s.world?.teams.find(t => t.id === playerId)?.shortName ?? ''
    }),
  )

  const driverMotivation = useGameStore(
    useShallow(s => {
      if (!press.pendingPress?.speakerDriverId) return null
      const id = press.pendingPress.speakerDriverId
      return s.world?.drivers.find(d => d.id === id)?.mood.motivation ?? null
    }),
  )

  const [activeIndex, setActiveIndex] = useState(0)
  const [selections, setSelections] = useState<Map<number, string>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset flow state when modal closes or a different pending press loads.
  useEffect(() => {
    if (!isOpen || !press.pendingPress) {
      setActiveIndex(0)
      setSelections(new Map())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, press.pendingPress?.id])

  // Escape closes (NOT skip) — mirrors backdrop-click.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Simple focus trap — move focus to first interactive element on open.
  useEffect(() => {
    if (!isOpen) return
    const first = containerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (first) first.focus()
  }, [isOpen])

  if (!isOpen || !press.hasPending || !press.pendingPress) return null

  const total = press.questions.length
  const allAnswered = selections.size === total
  const activeQuestion = press.questions[activeIndex]
  const selectedAnswerId = selections.get(activeIndex) ?? null

  const handleSelect = (answerId: string) => {
    setSelections(prev => {
      const next = new Map(prev)
      next.set(activeIndex, answerId)
      return next
    })
    // Auto-advance to the next question after a short delay so the card
    // highlight animation completes before the panel transitions.
    if (activeIndex < total - 1) {
      setTimeout(() => setActiveIndex(i => Math.min(total - 1, i + 1)), 200)
    }
  }

  const handleSubmit = () => {
    const answers = Array.from(selections.entries()).map(
      ([questionIndex, answerId]) => ({ questionIndex, answerId }),
    )
    press.resolve(answers)
    onClose()
  }

  const handleSkip = () => {
    press.skip()
    onClose()
  }

  return (
    <>
      <PressRoomBackdrop onBackdropClick={onClose} />
      <div
        ref={containerRef}
        className="press-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="press-room-title"
      >
        <h1 id="press-room-title" className="sr-only">Press Conference</h1>
        <PressProgressDots
          total={total}
          answered={selections.size}
          active={activeIndex}
        />
        <div className="press-modal__grid">
          <PressSpeakerCard
            speakerLabel={press.speakerLabel}
            speakerDriverPortrait={press.speakerDriverPortrait}
            speakerRole={press.pendingPress.speakerKind}
            teamName={teamName}
            surface={press.pendingPress.surface}
            driverMotivation={driverMotivation}
          />

          {!allAnswered ? (
            <PressQuestionPanel
              question={activeQuestion}
              selectedAnswerId={selectedAnswerId}
              onSelectAnswer={handleSelect}
              onSkip={handleSkip}
            />
          ) : (
            <div className="press-panel press-glass press-panel--submit">
              <p>All responses recorded.</p>
              <button type="button" className="press-submit" onClick={handleSubmit}>
                Submit Responses
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
