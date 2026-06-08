'use client'

import { useQualifyingSession } from '@/hooks/use-qualifying-session'
import { Button } from '@/components/ui/button'
import { QualiBroadcastChrome } from './quali-broadcast-chrome'
import { QualiTimingTower } from './quali-timing-tower'
import { QualiDriverCommands } from './quali-driver-commands'
import { QualiClassificationReveal } from './quali-classification-reveal'
import { CommentaryFeed } from './commentary-feed'

/**
 * Qualifying live screen (plan §M7). Self-contained — reads everything from
 * `useQualifyingSession` (which owns the reveal loop) and renders the broadcast
 * layout. Lives inside `/strategy` behind `phase === 'qualifying'`.
 *
 * Flow: idle (Begin / Skip + tire pre-pick) → running/paused (timed reveal) →
 * segment-end (Start next, or auto-collate on the final segment) → finished
 * (the earned-grid reveal + Confirm Grid hand-off to the race).
 */
export function QualifyingLiveScreen() {
  const {
    state,
    begin,
    nextSegment,
    skip,
    confirmGrid,
    selectTire,
    setSpeed,
    pause,
    resume,
    sendLap,
    abortLap,
  } = useQualifyingSession()

  const { sessionPhase } = state
  const isIdle = sessionPhase === 'idle'
  const isSegEnd = sessionPhase === 'segment-end'

  // Finished — the earned grid takes the whole screen, then hands off to the race.
  if (sessionPhase === 'finished' && state.classification) {
    return (
      <QualiClassificationReveal
        rows={state.classification}
        pole={state.pole}
        fastest={state.fastest}
        isSprint={state.isSprint}
        onConfirm={confirmGrid}
      />
    )
  }

  return (
    <div className="flex flex-col">
      <QualiBroadcastChrome
        segmentLabel={state.segmentLabel}
        segmentName={state.segmentName}
        timeRemaining={state.segmentTimeRemaining}
        sessionPhase={sessionPhase}
        weather={state.weather}
        currentSpeed={state.simSpeed}
        onSetSpeed={setSpeed}
        onPause={pause}
        onResume={resume}
        tickerEntries={state.commentary}
      />

      {/* Session header + segment actions */}
      <div className="flex items-center justify-between gap-3 my-3 flex-wrap">
        <div className="font-mono text-[12px] text-ink-mute uppercase tracking-[0.14em]">
          {state.raceName} · {state.segmentName}
        </div>
        <div className="flex items-center gap-2">
          {isIdle && (
            <>
              <Button size="lg" onClick={begin}>
                Begin {state.segmentLabel}
              </Button>
              <Button size="lg" variant="secondary" onClick={skip}>
                Skip Qualifying
              </Button>
            </>
          )}
          {isSegEnd && !state.isLastSegment && (
            <Button size="lg" onClick={nextSegment}>
              Start {state.nextSegmentLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Data panels — tower (wide) + per-driver controls / commentary */}
      <div
        className="
          grid gap-4
          grid-cols-1
          min-[1200px]:grid-cols-[1fr_360px]
        "
      >
        <div className="flex flex-col gap-3">
          <QualiTimingTower entries={state.tower} cutlinePosition={state.cutlinePosition} />
        </div>

        <div className="flex flex-col gap-3">
          {state.players.length === 0 ? (
            <div className="bg-surface-paper border border-line-sub rounded-rad p-6 font-mono text-[12px] text-ink-dim">
              No player drivers available for this session.
            </div>
          ) : (
            state.players.map((p) => (
              <QualiDriverCommands
                key={p.driverId}
                driverId={p.driverId}
                driverName={p.code}
                compound={p.compound}
                circuitCompounds={state.circuitCompounds}
                setsByCompound={state.setsByCompound}
                sessionPhase={sessionPhase}
                onSelectTire={selectTire}
                onSendLap={sendLap}
                onAbortLap={abortLap}
              />
            ))
          )}
          <CommentaryFeed entries={state.commentary} />
        </div>
      </div>
    </div>
  )
}
