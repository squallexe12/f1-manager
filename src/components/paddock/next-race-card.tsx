import type { NextRaceBrief } from '@/engine/paddock/race-brief'
import type { PrestigeRating } from '@/types/finance'

interface NextRaceCardProps {
  brief: NextRaceBrief
  prestige: PrestigeRating
}

const RING_CIRC = 2 * Math.PI * 36

export function NextRaceCard({ brief, prestige }: NextRaceCardProps) {
  const { round, totalRounds, race, daysOut, sessions, weather } = brief

  // Ring fills in reverse of countdown — fuller circle as race approaches.
  const maxDays = 24
  const progress = Math.max(0, Math.min(RING_CIRC, ((maxDays - daysOut) / maxDays) * RING_CIRC))

  return (
    <div className="pd-next-race">
      <div className="pd-next-head">
        <div>
          <div className="pd-next-k">▸ NEXT RACE · ROUND {round}/{totalRounds}</div>
        </div>
        <div className="pd-next-round">SUNDAY · 15:00 LOCAL</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
        <div className="pd-ring" aria-label={`${daysOut} days until the next race`}>
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" className="track" />
            <circle
              cx="40" cy="40" r="36" className="prog"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={RING_CIRC - progress}
            />
          </svg>
          <div className="val">
            {daysOut}
            <span className="sub">DAYS</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="pd-next-name">{race.name.toUpperCase()}</div>
          <div className="pd-next-loc">{race.circuit.country.toUpperCase()}</div>
        </div>
      </div>

      <div className="pd-sessions" role="list">
        {sessions.map(s => (
          <div
            key={s.key}
            className={`pd-session ${s.key === 'RACE' ? 'race' : ''}`}
            role="listitem"
          >
            <div className="k">{s.key}</div>
            <div className="d">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="pd-next-weather">
        <span><span className="k">AIR</span><span className="v">{weather.airTemp}°C</span></span>
        <span><span className="k">TRACK</span><span className="v">{weather.trackTemp}°C</span></span>
        <span>
          <span className="k">RAIN</span>
          <span className="v" style={{ color: 'var(--sig-amber)' }}>{weather.rainChance}%</span>
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <span className="k">PRESTIGE</span>
          <span className="v" style={{ color: 'var(--sig-purple)' }}>{prestige}</span>
        </span>
      </div>
    </div>
  )
}
