import type { CSSProperties } from 'react'
import { RegRibbon } from '@/components/factory/regulations/RegRibbon'

interface AeroCardProps {
  windTunnelUsed: number
  windTunnelLimit: number
  cfdUsed: number
  cfdLimit: number
  /** Days until the CDT window resets — TODO(Phase B) */
  daysToReset: number
  /** Reset date label (e.g., "JUN 24 · 00:00 UTC") — TODO(Phase B) */
  resetDateLabel: string
  /** 14-day daily booking history for wind tunnel (0-1 values, oldest → newest) — TODO(Phase B) */
  wtDaily: number[]
  /** 14-day daily booking history for CFD — TODO(Phase B) */
  cfdDaily: number[]
  /** Index within daily arrays considered "today" */
  todayIndex: number
  /** ATR coefficient (0.7x–1.0x) — TODO(Phase B) */
  atrCoefficient: number
  /** Correlation delta vs on-track, as percent — TODO(Phase B) */
  correlationDelta: number
  /** Round number of the next major aero delivery — TODO(Phase B) */
  nextDeliveryRound?: number
}

interface MetricProps {
  label: string
  tag: string
  color: 'cyan' | 'purple'
  used: number
  limit: number
  daily: number[]
  todayIndex: number
  readoutLeft: string
  readoutUnit: string
  readoutNote: string
}

function AeroMetric({ label, tag, color, used, limit, daily, todayIndex, readoutLeft, readoutUnit, readoutNote }: MetricProps) {
  const swatch = color === 'cyan' ? 'var(--sig-cyan)' : 'var(--sig-purple)'
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div className="aero-metric" style={{ ['--fill' as string]: swatch } as CSSProperties}>
      <div className="aero-metric-head">
        <span className="k">
          <span className="swatch" style={{ background: swatch }} />
          {label}
        </span>
        <span className="tag">{tag}</span>
      </div>
      <div className="aero-days">
        {daily.map((v, i) => (
          <div
            key={i}
            className={`aero-day${i === todayIndex ? ' today' : ''}${i > todayIndex ? ' future' : ''}`}
          >
            {v > 0 && <div className="aero-day-fill" style={{ height: `${Math.min(100, v * 100)}%` }} />}
          </div>
        ))}
      </div>
      <div className="aero-bar-stack">
        <div className="aero-bar-used" style={{ width: `${pct}%` }} />
        <div className="aero-bar-remaining" />
      </div>
      <div className="aero-readout">
        <span className="big">
          {readoutLeft}
          <span className="u">{readoutUnit}</span>
        </span>
        <span className="d">{readoutNote}</span>
        <span className="pct">{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

export function AeroCard({
  windTunnelUsed,
  windTunnelLimit,
  cfdUsed,
  cfdLimit,
  daysToReset,
  resetDateLabel,
  wtDaily,
  cfdDaily,
  todayIndex,
  atrCoefficient,
  correlationDelta,
  nextDeliveryRound,
}: AeroCardProps) {
  const wtLeft = Math.max(0, windTunnelLimit - windTunnelUsed)
  const cfdLeft = Math.max(0, cfdLimit - cfdUsed)
  const wtSessionsLeft = Math.max(0, Math.round(wtLeft / 1.8))

  return (
    <div className="fac-panel aero-card">
      <div className="aero-hero-strip">
        <div className="aero-hero-stat wt">
          <span className="k">Wind Tunnel</span>
          <span className="v">
            {windTunnelUsed}
            <span className="u">/ {windTunnelLimit}h</span>
          </span>
        </div>
        <div className="aero-hero-stat cfd">
          <span className="k">CFD Runs</span>
          <span className="v">
            {cfdUsed}
            <span className="u">/ {cfdLimit}</span>
          </span>
        </div>
        <div className="aero-hero-clock">
          <span className="k">Window Resets</span>
          <span className="v">D−{String(Math.max(0, daysToReset)).padStart(2, '0')}</span>
          <span className="d">{resetDateLabel}</span>
        </div>
      </div>
      <RegRibbon card="aero" />
      <div className="fac-phead flush">
        <div className="t">Aero Testing</div>
        <div className="s">CDT WINDOW · 14 DAYS</div>
      </div>
      <div className="aero-body">
        <AeroMetric
          label="Wind Tunnel Utilization"
          tag="DAILY BOOKINGS"
          color="cyan"
          used={windTunnelUsed}
          limit={windTunnelLimit}
          daily={wtDaily}
          todayIndex={todayIndex}
          readoutLeft={wtLeft.toFixed(1)}
          readoutUnit="h left"
          readoutNote={`≈ ${wtSessionsLeft} sessions remaining`}
        />
        <AeroMetric
          label="CFD Compute"
          tag="TFLOP-HRS"
          color="purple"
          used={cfdUsed}
          limit={cfdLimit}
          daily={cfdDaily}
          todayIndex={todayIndex}
          readoutLeft={cfdLeft.toFixed(0)}
          readoutUnit="runs left"
          readoutNote="queue depth: 3 · avg 42m per run"
        />
      </div>
      <div className="aero-foot">
        <div className="aero-foot-cell">
          <span className="k">ATR Coefficient</span>
          <span className="v">{atrCoefficient.toFixed(2)}×</span>
        </div>
        <div className="aero-foot-cell">
          <span className="k">Correlation Δ</span>
          <span className="v cyan">
            {correlationDelta >= 0 ? '+' : ''}
            {correlationDelta.toFixed(1)}%
          </span>
        </div>
        <div className="aero-foot-cell">
          <span className="k">Next Delivery</span>
          <span className="v purple">{nextDeliveryRound ? `R${String(nextDeliveryRound).padStart(2, '0')}` : '—'}</span>
        </div>
      </div>
    </div>
  )
}
