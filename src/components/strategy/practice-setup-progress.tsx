'use client'

interface SetupProgressDriver {
  driverId: string
  code: string
  teamColor: string
  setupConfidence: number
  tireDegRead: number
}

interface PracticeSetupProgressProps {
  drivers: SetupProgressDriver[]
  className?: string
}

// The two setup bars deliberately reference the bright :root brand accents
// (--accent-lime #CCFF00 / --accent-cyan #00E5FF) rather than the broadcast-muted
// sig-* ramp, so they pop as the spec mandates (lime = setup, cyan = tire-read) —
// matching the hero-strip leader figure. A future broadcast accent re-tune must
// update these two vars (or alias them) to keep the bars in sync.
const LIME = 'var(--accent-lime)'
const CYAN = 'var(--accent-cyan)'

/** A single labelled 0–100 progress bar with full ARIA. */
function MeterBar({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim">{label}</span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-ink-hi">{v}</span>
      </div>
      <div
        className="h-1.5 bg-surface-void rounded-[2px] overflow-hidden"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-[2px]"
          style={{ width: `${v}%`, backgroundColor: color, transition: 'width 300ms ease' }}
        />
      </div>
    </div>
  )
}

/**
 * Setup progress (plan §M5), progressive disclosure:
 *  - Glance: two team-average bars (Setup Confidence in lime, Tire-Deg Read in cyan).
 *  - Detail: per-driver rows, each with both bars.
 */
export function PracticeSetupProgress({ drivers, className = '' }: PracticeSetupProgressProps) {
  const n = drivers.length || 1
  const avgSetup = drivers.reduce((s, d) => s + d.setupConfidence, 0) / n
  const avgTire = drivers.reduce((s, d) => s + d.tireDegRead, 0) / n

  return (
    <div className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b border-line-sub">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">Setup Progress</span>
      </div>

      {/* Glance — team averages */}
      <div className="grid grid-cols-2 gap-4 px-3 py-3 border-b border-line-hair">
        <MeterBar label="Avg Setup" value={avgSetup} color={LIME} />
        <MeterBar label="Avg Tire Read" value={avgTire} color={CYAN} />
      </div>

      {/* Detail — per driver */}
      <div className="flex flex-col gap-px bg-line-hair">
        {drivers.map((d) => (
          <div key={d.driverId} className="bg-surface-paper px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-[3px] h-3.5 rounded-[1px]" style={{ backgroundColor: d.teamColor }} aria-hidden />
              <span className="font-display font-bold text-[12px] text-ink-hi tracking-[0.02em]">{d.code}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MeterBar label="Setup" value={d.setupConfidence} color={LIME} />
              <MeterBar label="Tire Read" value={d.tireDegRead} color={CYAN} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
