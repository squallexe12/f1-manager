import type { Driver } from '@/types/driver'
import type { CSSProperties } from 'react'
import { calculateOverallRating } from '@/engine/drivers/driver-rating'
import { FORM_DNF } from '@/engine/drivers/form-history'

interface DriverCardProps {
  driver: Driver
  driverNumber: number
  wdcPosition: number
  teamColor: string
}

function moodPill(driver: Driver): 'motivated' | 'frustrated' | 'stable' {
  if (driver.mood.frustration > 70) return 'frustrated'
  if (driver.mood.motivation > 80) return 'motivated'
  return 'stable'
}

function moodLabel(pill: ReturnType<typeof moodPill>): string {
  if (pill === 'motivated') return 'MOTIVATED'
  if (pill === 'frustrated') return 'FRUSTRATED'
  return 'STABLE'
}

export function DriverCard({ driver, driverNumber, wdcPosition, teamColor }: DriverCardProps) {
  const rating = calculateOverallRating(driver.attributes)
  const pill = moodPill(driver)
  // `termEndSeason` is RELATIVE (seasons remaining; nulled at expiry, so always >= 1).
  // Glance-tier card shows urgency, not the absolute season index used on the Drivers page.
  const expiring = driver.contract != null && driver.contract.termEndSeason <= 1
  const contractLabel = driver.contract
    ? expiring
      ? 'FINAL SEASON'
      : `${driver.contract.termEndSeason} SEASONS LEFT`
    : 'FREE AGENT'

  // Sparkline path for last-7 finishing positions, capped at 20 so the line
  // stays inside the 0-100 viewBox. DNF sentinel is clamped to the bottom.
  const form = driver.form
  const sparkPts = form.length === 0
    ? []
    : form.length === 1
      ? [[50, (Math.min(form[0], FORM_DNF) - 1) / 19 * 100]] as const
      : form.map((p, i) => {
        const x = (i / (form.length - 1)) * 100
        const y = Math.min(Math.max((p - 1) / 19 * 100, 0), 100)
        return [x, y] as const
      })
  const sparkPath = sparkPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const sparkColor = pill === 'frustrated' ? 'var(--sig-red)' : 'var(--sig-green)'

  const lastLabel = driver.lastRaceResult != null
    ? `LAST: P${driver.lastRaceResult}`
    : 'LAST: —'

  return (
    <article
      className="pd-driver-card"
      style={{ '--team-color': teamColor } as CSSProperties}
      aria-label={`${driver.firstName} ${driver.lastName} summary`}
    >
      <div className="pd-driver-head">
        <div className="pd-driver-num" aria-hidden>
          {String(driverNumber).padStart(2, '0')}
        </div>
        <div className="pd-driver-body">
          <div className="pd-driver-name">{driver.firstName} {driver.lastName}</div>
          <div className="pd-driver-meta">
            {driver.shortName} · {driver.nationality.toUpperCase()} ·{' '}
            <span className={expiring ? 'pd-contract expiring' : 'pd-contract'}>{contractLabel}</span>
          </div>
        </div>
        <div className="pd-driver-wdc">
          P{wdcPosition}
          <span className="sub">WDC</span>
        </div>
      </div>

      <div className="pd-driver-stats" role="list">
        <div className="pd-driver-stat" role="listitem">
          <div className="k">Points</div>
          <div className="v">{driver.seasonStats.points}</div>
        </div>
        <div className="pd-driver-stat" role="listitem">
          <div className="k">Wins</div>
          <div className="v">{driver.seasonStats.wins}</div>
        </div>
        <div className="pd-driver-stat" role="listitem">
          <div className="k">Podiums</div>
          <div className="v">{driver.seasonStats.podiums}</div>
        </div>
        <div className="pd-driver-stat" role="listitem">
          <div className="k">Rating</div>
          <div className="v" style={{ color: 'var(--sig-cyan)' }}>{rating}</div>
        </div>
      </div>

      <div className="pd-driver-moods">
        <div className="pd-mood mot">
          <div className="k">Motivation</div>
          <div className="pd-mood-bar"><div className="fill" style={{ width: `${driver.mood.motivation}%` }} /></div>
          <div className="v">{driver.mood.motivation}</div>
        </div>
        <div className="pd-mood con">
          <div className="k">Confidence</div>
          <div className="pd-mood-bar"><div className="fill" style={{ width: `${driver.mood.confidence}%` }} /></div>
          <div className="v">{driver.mood.confidence}</div>
        </div>
        <div className="pd-mood frs">
          <div className="k">Frustration</div>
          <div className="pd-mood-bar"><div className="fill" style={{ width: `${driver.mood.frustration}%` }} /></div>
          <div className="v">{driver.mood.frustration}</div>
        </div>
      </div>

      <div className="pd-driver-mini">
        <span className={`pill ${pill}`}>{moodLabel(pill)}</span>
        <div className="sparkline" aria-hidden>
          {form.length > 0 && (
            <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: '100%', height: '20px' }}>
              <path d={sparkPath} fill="none" stroke={sparkColor} strokeWidth={1.5} />
            </svg>
          )}
        </div>
        <span style={{ color: 'var(--ink-dim)', letterSpacing: '0.14em', fontSize: '9px' }}>
          {lastLabel}
        </span>
      </div>
    </article>
  )
}
