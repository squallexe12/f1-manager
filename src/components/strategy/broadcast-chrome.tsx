'use client'

import { RaceStatusBar } from './race-status-bar'
import { SimSpeedControl } from './sim-speed-control'
import { RaceTicker } from './race-ticker'
import { FlagStateIndicator } from './flag-state-indicator'
import type { WeatherForecast, SimSpeed, CommentaryEntry, RaceFlag } from '@/types/race'

interface BroadcastChromeProps {
  // Phase + flag context (spec §6)
  phase: 'race' | 'sprint' | 'post-race'
  flagStatus?: 'green' | 'yellow' | 'sc' | 'vsc' | 'red' | 'chequered'

  // ─── RaceStatusBar pass-through (exact types from step 2.1) ───
  lap: number
  totalLaps: number
  weather: WeatherForecast
  trackTemp: number
  safetyCar: RaceFlag

  // ─── SimSpeedControl pass-through (exact types from step 2.1) ───
  currentSpeed: SimSpeed
  onSetSpeed: (speed: SimSpeed) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean

  // ─── RaceTicker pass-through (exact types from step 2.1) ───
  tickerEntries: CommentaryEntry[]

  // Layout
  sticky?: boolean
}

export function BroadcastChrome({
  phase,
  flagStatus,
  lap,
  totalLaps,
  weather,
  trackTemp,
  safetyCar,
  currentSpeed,
  onSetSpeed,
  onPause,
  onResume,
  isPaused,
  tickerEntries,
  sticky = true,
}: BroadcastChromeProps) {
  // phase is part of the contract per spec §6.
  void phase

  return (
    <div className={sticky ? 'sticky top-12 z-20 bg-surface-void/95 backdrop-blur-md pb-2 -mx-4 px-4 pt-1' : ''}>
      {/* Top command bar — .topbar aesthetic */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-paper border border-line-sub rounded-t-rad px-1 py-1">
        <RaceStatusBar
          lap={lap}
          totalLaps={totalLaps}
          weather={weather}
          trackTemp={trackTemp}
          safetyCar={safetyCar}
        />
        {flagStatus && flagStatus !== 'chequered' && (
          <FlagStateIndicator flag={flagStatus as RaceFlag} />
        )}
        <SimSpeedControl
          currentSpeed={currentSpeed}
          onSetSpeed={onSetSpeed}
          onPause={onPause}
          onResume={onResume}
          isPaused={isPaused}
          className="pr-2"
        />
      </div>
      {/* Flag strip — .flag-strip aesthetic, rounded bottom, no top border */}
      <RaceTicker entries={tickerEntries} />
    </div>
  )
}
