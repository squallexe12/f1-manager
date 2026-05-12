import type { CarPerformance } from '@/types/team'
import { RegRibbon } from '@/components/factory/regulations/RegRibbon'

interface CarPerformanceCardProps {
  rating: number
  car: CarPerformance
  /** Peer axes values in the same order as AXES — TODO(Phase B): derive from other teams */
  peerAxes: number[]
  /** Constructor rank among peers (1-11), or null before any race is processed. */
  peerRank: number | null
  /** Rolling OVR trend (oldest → newest) — TODO(Phase B): derive from history */
  trendSeries: number[]
  /** Δ vs championship leader, in seconds per lap — TODO(Phase B) */
  deltaVsLeader: number
  /** Reliability MTBF (laps) — TODO(Phase B) */
  reliabilityMtbf: number
  /** Round number of the most recent shipped upgrade — TODO(Phase B) */
  lastUpgradeRound: number
}

const AXES: Array<{ k: keyof CarPerformance; label: string }> = [
  { k: 'downforce', label: 'DOWNFORCE' },
  { k: 'straightSpeed', label: 'POWER' },
  { k: 'braking', label: 'BRAKING' },
  { k: 'cornering', label: 'CORNERING' },
  { k: 'reliability', label: 'RELIABILITY' },
  { k: 'tireManagement', label: 'TIRE MGMT' },
]

function Radar({ values, peer }: { values: number[]; peer: number[] }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const R = 86
  const n = values.length

  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }

  const ringPath = (r: number) =>
    Array.from({ length: n }, (_, i) => pt(i, r))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ') + ' Z'

  const valPath =
    values
      .map((v, i) => pt(i, (v / 100) * R))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ') + ' Z'

  const peerPath = peer.length
    ? peer
        .map((v, i) => pt(i, (v / 100) * R))
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
        .join(' ') + ' Z'
    : null

  return (
    <svg className="radar-svg" viewBox={`-34 -34 ${size + 68} ${size + 68}`}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--sig-red)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--sig-red)" stopOpacity="0.06" />
        </radialGradient>
        <filter id="radarGlow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <path
          key={r}
          d={ringPath(R * r)}
          fill="none"
          stroke="var(--line-hair)"
          strokeWidth="1"
          strokeDasharray={r === 1 ? 'none' : '2 3'}
        />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line-hair)" strokeWidth="1" />
      })}
      {peerPath && (
        <path
          d={peerPath}
          fill="none"
          stroke="var(--sig-amber)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.7"
        />
      )}
      <path d={valPath} fill="url(#radarFill)" stroke="var(--sig-red)" strokeWidth="2" filter="url(#radarGlow)" opacity="0.5" />
      <path d={valPath} fill="none" stroke="var(--sig-red)" strokeWidth="2" />
      {values.map((v, i) => {
        const [lx, ly] = pt(i, R + 22)
        const [vx, vy] = pt(i, (v / 100) * R)
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 3}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8.5,
                letterSpacing: '0.18em',
                fill: 'var(--ink-dim)',
                fontWeight: 600,
              }}
            >
              {AXES[i].label}
            </text>
            <text
              x={lx}
              y={ly + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 800,
                fill: 'var(--ink-hi)',
                letterSpacing: '-0.02em',
              }}
            >
              {v}
            </text>
            <circle cx={vx} cy={vy} r="3.5" fill="var(--sig-red)" stroke="var(--bg-void)" strokeWidth="1.5" />
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r="2" fill="var(--ink-dim)" />
    </svg>
  )
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const W = 160
  const H = 34
  const min = Math.min(...points) - 2
  const max = Math.max(...points) + 2
  const range = max - min || 1
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - ((v - min) / range) * H
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const area = `M 0 ${H} L ${points.map((v, i) => `${x(i)} ${y(v)}`).join(' L ')} L ${W} ${H} Z`
  const last = points[points.length - 1]
  return (
    <svg className="rhs-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--sig-green)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--sig-green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spg)" />
      <path d={line} fill="none" stroke="var(--sig-green)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={x(points.length - 1)} cy={y(last)} r="2.5" fill="var(--sig-green)" />
    </svg>
  )
}

export function CarPerformanceCard({
  rating,
  car,
  peerAxes,
  peerRank,
  trendSeries,
  deltaVsLeader,
  reliabilityMtbf,
  lastUpgradeRound,
}: CarPerformanceCardProps) {
  const values = AXES.map(({ k }) => Math.round(car[k]))
  const trendDelta = trendSeries.length >= 2 ? trendSeries[trendSeries.length - 1] - trendSeries[0] : 0
  const trendLabel = trendDelta >= 0 ? `+${trendDelta} pts` : `${trendDelta} pts`

  return (
    <div className="fac-panel radar-card">
      <div className="radar-hero-strip">
        <div className="rhs-big">
          {rating}
          <span className="u">CAR PERFORMANCE · OVR</span>
        </div>
        <div className="rhs-vs" />
        <div className="rhs-trend">
          <span className="tk">6-RACE TREND</span>
          <span className={`tv${trendDelta < 0 ? ' dn' : ''}`}>{trendLabel}</span>
          <Sparkline points={trendSeries} />
        </div>
        <div className="rhs-rank">
          <div className="rnum">{peerRank === null ? '—' : `P${peerRank}`}</div>
          <span className="rsub">PEER RANK</span>
        </div>
      </div>
      <RegRibbon card="car-performance" />
      <div className="radar-body">
        <Radar values={values} peer={peerAxes} />
        <div className="radar-axes">
          {AXES.map(({ k, label }, i) => {
            const v = values[i]
            const peer = peerAxes[i] ?? 70
            const delta = v - peer
            return (
              <div
                key={k}
                className="radar-axis-row"
                style={{ ['--peer' as string]: `${peer}%` } as React.CSSProperties}
              >
                <span className="rk">{label}</span>
                <div className="radar-axis-bar">
                  <div className="fill" style={{ transform: `scaleX(${v / 100})` }} />
                </div>
                <span className="rv">
                  {v}
                  <span className={`rdelta ${delta >= 0 ? 'up' : 'dn'}`}>
                    {delta >= 0 ? '+' : ''}
                    {delta} vs peer
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="radar-foot">
        <div className="radar-foot-cell">
          <span className="k">Last Upgrade</span>
          <span className="v">{lastUpgradeRound > 0 ? `R${String(lastUpgradeRound).padStart(2, '0')}` : '—'}</span>
        </div>
        <div className="radar-foot-cell">
          <span className="k">Δ vs Leader</span>
          <span className={`v ${deltaVsLeader <= 0 ? 'dn' : 'up'}`}>
            {deltaVsLeader <= 0 ? '' : '+'}
            {deltaVsLeader.toFixed(2)}s
          </span>
        </div>
        <div className="radar-foot-cell">
          <span className="k">Reliability MTBF</span>
          <span className="v up">{reliabilityMtbf.toFixed(1)} laps</span>
        </div>
      </div>
    </div>
  )
}
