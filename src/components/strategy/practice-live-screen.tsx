'use client'

import { usePracticeSession } from '@/hooks/use-practice-session'
import { Button } from '@/components/ui/button'
import { PracticeBroadcastChrome } from './practice-broadcast-chrome'
import { PracticeHeroStrip } from './practice-hero-strip'
import { FpSessionSelector } from './fp-session-selector'
import { SessionBudgetMeter } from './session-budget-meter'
import { PracticeSetupProgress } from './practice-setup-progress'
import { PracticeDriverCommands } from './practice-driver-commands'
import { CommentaryFeed } from './commentary-feed'

/**
 * Practice live screen (plan §M5). Self-contained — reads everything from
 * `usePracticeSession` (which owns the reveal loop) and renders the broadcast
 * layout. Lives inside `/strategy` behind `phase === 'practice'`.
 *
 * Deviations from the literal plan, forced by practice's data model (documented
 * in the M5 design):
 *  - No `CircuitMap`: it hard-codes a LAP n/n counter that has no meaning in
 *    practice; widening it was explicitly out of scope.
 *  - No `TeamRadioPanel`: practice emits no radio transmissions, so the panel
 *    would render permanently empty. The CommentaryFeed carries the live text.
 */
export function PracticeLiveScreen() {
  const {
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
  } = usePracticeSession()

  const { status } = state
  const isIdle = status === 'idle'
  const live = status === 'running' || status === 'paused'
  const sessionEnd = status === 'session-end'

  const qualiLabel = state.isSprint ? 'Advance to Sprint Qualifying' : 'Advance to Qualifying'

  return (
    <div className="flex flex-col">
      <PracticeBroadcastChrome
        sessionLabel={state.sessionLabel}
        sessionName={state.sessionName}
        timeRemaining={state.timeRemaining}
        status={status}
        currentSpeed={state.simSpeed}
        onSetSpeed={setSpeed}
        onPause={pause}
        onResume={resume}
        tickerEntries={state.commentary}
      />

      <PracticeHeroStrip
        timeRemaining={state.timeRemaining}
        timeBudget={state.timeBudget}
        leader={state.leader}
        setsRemaining={state.setsRemaining}
      />

      {/* FP progression + session actions */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <FpSessionSelector
          total={state.fpTotal}
          activeIndex={state.activeFpIndex}
          completedCount={state.completedCount}
        />
        <div className="flex items-center gap-2">
          {isIdle && !state.allFpDone && (
            <>
              <Button size="lg" onClick={startSubSession}>
                Start {state.sessionLabel}
              </Button>
              <Button size="lg" variant="secondary" onClick={skipToQualifying}>
                Skip to Qualifying
              </Button>
            </>
          )}
          {isIdle && state.allFpDone && (
            <Button size="lg" onClick={skipToQualifying}>
              {qualiLabel}
            </Button>
          )}
          {live && (
            <Button size="lg" variant="secondary" onClick={skipToQualifying}>
              Skip to Qualifying
            </Button>
          )}
          {sessionEnd && !state.allFpDone && (
            <>
              <Button size="lg" onClick={advanceSubSession}>
                Next Session
              </Button>
              <Button size="lg" variant="secondary" onClick={skipToQualifying}>
                {qualiLabel}
              </Button>
            </>
          )}
          {sessionEnd && state.allFpDone && (
            <Button size="lg" onClick={skipToQualifying}>
              {qualiLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Data panels — 3-column broadcast grid */}
      <div
        className="
          grid gap-4
          grid-cols-1
          min-[1200px]:grid-cols-[380px_1fr_360px]
        "
      >
        {/* Left — setup progress + live budget */}
        <div className="flex flex-col gap-3">
          <PracticeSetupProgress drivers={state.drivers} />
          <SessionBudgetMeter
            visible={!isIdle}
            timeRemaining={state.timeRemaining}
            timeBudget={state.timeBudget}
            ledger={state.ledger}
          />
        </div>

        {/* Center — per-driver control surface */}
        <div className="flex flex-col gap-3">
          {state.drivers.length === 0 ? (
            <div className="bg-surface-paper border border-line-sub rounded-rad p-6 font-mono text-[12px] text-ink-dim">
              No player drivers available for this session.
            </div>
          ) : (
            state.drivers.map((d) => (
              <PracticeDriverCommands
                key={d.driverId}
                driverId={d.driverId}
                driverName={d.code}
                program={d.program}
                compound={d.compound}
                circuitCompounds={state.circuitCompounds}
                setsByCompound={state.setsByCompound}
                status={status}
                onSelectRunPlan={selectRunPlan}
                onSelectTire={selectTire}
                onSendLap={sendLap}
                onAbortLap={abortLap}
              />
            ))
          )}
        </div>

        {/* Right — live commentary */}
        <div className="flex flex-col gap-3">
          <CommentaryFeed entries={state.commentary} />
        </div>
      </div>
    </div>
  )
}
