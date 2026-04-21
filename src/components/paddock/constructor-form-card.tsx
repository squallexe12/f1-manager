import type { Team } from '@/types/team'
import type { Driver } from '@/types/driver'

interface ConstructorFormCardProps {
  team: Team
  drivers: Driver[]
}

/**
 * Builds the SVG path strings for the constructor-form sparkline.
 * Y-axis is inverted: P1 plots near the top, P11 near the bottom.
 */
function buildSparklinePaths(form: number[]): { line: string; area: string } | null {
  if (form.length === 0) return null
  if (form.length === 1) {
    const y = 100 - ((form[0] - 1) / 10) * 90
    return { line: `M0,${y} L100,${y}`, area: `M0,${y} L100,${y} L100,100 L0,100 Z` }
  }
  const pts = form.map((p, i) => {
    const x = (i / (form.length - 1)) * 100
    // Squash P1..P11 into 10..100 (leave P1 at top with headroom)
    const y = 100 - Math.max(0, Math.min(10, 11 - p)) / 10 * 90
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const area = `${line} L100,100 L0,100 Z`
  return { line, area }
}

export function ConstructorFormCard({ team, drivers }: ConstructorFormCardProps) {
  const form = team.seasonForm
  const paths = buildSparklinePaths(form)

  // Team totals across the roster's active drivers (reserve/F2 excluded).
  const active = drivers.filter(d => d.teamId === team.id && !d.isReserve && !d.isF2)
  const wins = active.reduce((s, d) => s + d.seasonStats.wins, 0)
  const podiums = active.reduce((s, d) => s + d.seasonStats.podiums, 0)
  const poles = active.reduce((s, d) => s + d.seasonStats.poles, 0)
  const dnfs = active.reduce((s, d) => s + d.seasonStats.dnfs, 0)

  return (
    <div className="pd-form-card">
      <div className="pd-form-head">
        <div className="pd-form-title">▸ CONSTRUCTOR FORM</div>
        <div className="pd-form-sub">LAST {form.length || 0} ROUND{form.length === 1 ? '' : 'S'}</div>
      </div>

      <div className="pd-form-chart" role="img" aria-label="Constructor position over recent rounds">
        {paths && form.length > 0 ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d={paths.area} className="pd-form-area" />
            <path d={paths.line} className="pd-form-line" />
            {form.map((_, i) => {
              const x = form.length > 1 ? (i / (form.length - 1)) * 100 : 50
              const y = 100 - Math.max(0, Math.min(10, 11 - form[i])) / 10 * 90
              return <circle key={i} cx={x} cy={y} r={2} className="pd-form-dot" />
            })}
          </svg>
        ) : (
          <div
            className="grid place-items-center h-full font-mono text-[10px] tracking-[0.16em] uppercase"
            style={{ color: 'var(--ink-dim)' }}
          >
            No completed rounds yet
          </div>
        )}
      </div>

      <div className="pd-form-rounds">
        {form.length === 0
          ? Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rnd-box">
              <div className="pos">—</div>
              <div>R{i + 1}</div>
            </div>
          ))
          : form.map((p, i) => (
            <div
              key={i}
              className={`rnd-box ${p === 1 ? 'win' : p <= 3 ? 'podium' : ''}`}
            >
              <div className="pos">P{p}</div>
              <div>R{i + 1}</div>
            </div>
          ))}
      </div>

      <div className="pd-form-summary">
        <div><span className="k">Wins</span><span className="v">{wins}</span></div>
        <div><span className="k">Podiums</span><span className="v">{podiums}</span></div>
        <div><span className="k">Poles</span><span className="v">{poles}</span></div>
        <div><span className="k">DNFs</span><span className="v">{dnfs}</span></div>
      </div>
    </div>
  )
}
