import type { ComponentAllocation } from '@/types/team'

interface PowerUnitCardProps {
  components: ComponentAllocation[]
  /** Round of the next predicted component change — TODO(Phase B): derive from race cadence */
  nextChangeRound?: number
  /** Element whose next change will happen soonest — TODO(Phase B) */
  nextChangeElement?: string
  /** Penalties already taken this season — TODO(Phase B) */
  penaltiesTaken: number
  /** Projected grid-position loss if limits are exceeded — TODO(Phase B) */
  projectedGridLoss: number
  /** Total races in the season, for header label */
  totalRaces: number
}

const ELEMENT_LABELS: Record<string, string> = {
  ice: 'ICE',
  turbo: 'TURBO',
  'mgu-k': 'MGU-K',
  'ers-battery': 'ERS BATTERY',
  gearbox: 'GEARBOX',
}

function PuRow({ element, used, limit }: ComponentAllocation) {
  const warn = used >= limit - 1 && used < limit
  const danger = used >= limit
  const remaining = Math.max(0, limit - used)
  const dots: React.ReactNode[] = []
  for (let i = 0; i < limit; i++) {
    const isUsed = i < used
    const cls = isUsed ? `used ${danger ? 'danger' : warn && i === used - 1 ? 'warn' : ''}`.trim() : ''
    dots.push(<span key={i} className={`pu-dot ${cls}`.trim()} />)
  }
  return (
    <div>
      <div className="pu-row">
        <span className="pk">{ELEMENT_LABELS[element] ?? element.toUpperCase()}</span>
        <div className="pu-dots">{dots}</div>
        <span
          className="pv"
          style={{ color: danger ? 'var(--sig-red)' : warn ? 'var(--sig-amber)' : 'var(--ink-hi)' }}
        >
          {remaining}
          <span className="plim">
            {used}/{limit} USED
          </span>
        </span>
      </div>
      {danger && <div className="pu-penalty">⚠ GRID PENALTY ON NEXT CHANGE</div>}
    </div>
  )
}

export function PowerUnitCard({
  components,
  nextChangeRound,
  nextChangeElement,
  penaltiesTaken,
  projectedGridLoss,
  totalRaces,
}: PowerUnitCardProps) {
  const totalRemaining = components.reduce((acc, c) => acc + Math.max(0, c.limit - c.used), 0)
  const hasDanger = components.some((c) => c.used >= c.limit)
  const hasWarn = components.some((c) => c.used >= c.limit - 1)
  const health = hasDanger ? 'CRITICAL' : hasWarn ? 'AT RISK' : 'NOMINAL'
  const healthClass = hasDanger ? 'danger' : hasWarn ? 'warn' : ''

  const nextLabel = nextChangeRound && nextChangeElement
    ? `R${String(nextChangeRound).padStart(2, '0')} · ${ELEMENT_LABELS[nextChangeElement] ?? nextChangeElement.toUpperCase()}`
    : '—'

  return (
    <div className="fac-panel pu-card">
      <div className="pu-hero-strip">
        <div className="pu-hero-big">
          {totalRemaining}
          <span className="u">COMPONENTS REMAINING</span>
        </div>
        <div className="pu-hero-health">
          <span className="k">Fleet Health</span>
          <span className={`v ${healthClass}`.trim()}>{health}</span>
        </div>
        <div className="pu-hero-next">
          NEXT CHANGE
          <span className="rd">{nextLabel}</span>
        </div>
      </div>
      <div className="fac-phead flush">
        <div className="t">Power Unit Allocation</div>
        <div className="s">SEASON · {totalRaces} RACES</div>
      </div>
      <div className="pu-body">
        {components.map((c) => (
          <PuRow key={c.element} {...c} />
        ))}
      </div>
      <div className="pu-foot">
        <div className="pu-foot-cell">
          <span className="k">Penalties Taken</span>
          <span className="v">{penaltiesTaken}</span>
        </div>
        <div className="pu-foot-cell">
          <span className="k">Projected Grid Loss</span>
          <span className={`v ${projectedGridLoss > 0 ? 'danger' : ''}`.trim()}>
            {projectedGridLoss > 0 ? `−${projectedGridLoss} PL` : '0'}
          </span>
        </div>
      </div>
    </div>
  )
}
