import type { Driver } from '@/types/driver'
import { ProgressBar } from '@/components/ui/progress-bar'

interface DriverSummaryCardProps {
  driver: Driver
  wdcPosition: number
  lastRaceResult?: number
  teamColor: string
  className?: string
}

function moodLabel(driver: Driver): { text: string; color: string } {
  if (driver.mood.frustration > 70) return { text: 'Frustrated', color: 'var(--accent-red)' }
  if (driver.mood.motivation > 80) return { text: 'Motivated', color: 'var(--accent-lime)' }
  if (driver.mood.confidence < 40) return { text: 'Low confidence', color: 'var(--accent-amber)' }
  return { text: 'Stable', color: 'var(--text-muted)' }
}

export function DriverSummaryCard({ driver, wdcPosition, lastRaceResult, teamColor, className = '' }: DriverSummaryCardProps) {
  const mood = moodLabel(driver)

  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: teamColor }} />
        <div>
          <div className="text-sm font-heading font-bold text-[var(--text-primary)]">
            {driver.firstName} {driver.lastName}
          </div>
          <div className="text-[10px] font-mono text-[var(--text-dim)]">
            {driver.shortName} · {driver.nationality}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-2 text-xs">
        <div>
          <span className="text-[var(--text-muted)]">WDC </span>
          <span className="font-mono text-[var(--text-primary)]">P{wdcPosition}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">PTS </span>
          <span className="font-mono text-[var(--text-primary)]">{driver.seasonStats.points}</span>
        </div>
        {lastRaceResult !== undefined && (
          <div>
            <span className="text-[var(--text-muted)]">Last </span>
            <span className="font-mono text-[var(--text-primary)]">P{lastRaceResult}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ProgressBar
          value={driver.mood.motivation}
          color={mood.color}
          className="flex-1"
        />
        <span className="text-[10px]" style={{ color: mood.color }}>{mood.text}</span>
      </div>
    </div>
  )
}
