import type { ComponentAllocation } from '@/types/team'
import type { SwapRow } from '@/engine/engineering/component-strategy'
import { RegRibbon } from '@/components/factory/regulations/RegRibbon'

interface PowerUnitCardProps {
  components: ComponentAllocation[]
  /** Round of the next predicted component change — TODO(Phase B): derive from race cadence */
  nextChangeRound?: number
  /** Element whose next change will happen soonest — TODO(Phase B) */
  nextChangeElement?: string
  /** Penalties already taken this season */
  penaltiesTaken: number
  /** Projected grid-position loss if limits are exceeded */
  projectedGridLoss: number
  /** Total races in the season, for header label */
  totalRaces: number
  /** Phase 2 — render-ready rows for the Component Strategy sub-section. */
  swapRows: SwapRow[]
  /** Phase 2 — store action wired by the page. */
  onElectSwap: (driverId: string, element: ComponentAllocation['element']) => void
}

const ELEMENT_LABELS: Record<string, string> = {
  ice: 'ICE',
  turbo: 'TURBO',
  'mgu-k': 'MGU-K',
  'ers-battery': 'ERS BATTERY',
  gearbox: 'GEARBOX',
}

function PuRow({ element, used, limit }: ComponentAllocation) {
  // `used` is a fractional accumulator from passive wear (`tickComponentWear`
  // ticks at 0.4/race); floor it for the displayed "X / Y USED" label and
  // dot-bucket logic so the visible swap count stays whole-number.
  const usedFloor = Math.floor(used)
  const warn = usedFloor >= limit - 1 && usedFloor < limit
  const danger = usedFloor >= limit
  const remaining = Math.max(0, limit - usedFloor)
  const dots: React.ReactNode[] = []
  for (let i = 0; i < limit; i++) {
    const isUsed = i < usedFloor
    const cls = isUsed ? `used ${danger ? 'danger' : warn && i === usedFloor - 1 ? 'warn' : ''}`.trim() : ''
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
            {usedFloor}/{limit} USED
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
  swapRows,
  onElectSwap,
}: PowerUnitCardProps) {
  // `used` is a fractional wear accumulator; floor before integer-bucket math
  // so the hero "components remaining" stays whole-number and matches PuRow.
  const totalRemaining = components.reduce(
    (acc, c) => acc + Math.max(0, c.limit - Math.floor(c.used)),
    0,
  )
  const hasDanger = components.some((c) => Math.floor(c.used) >= c.limit)
  const hasWarn = components.some((c) => Math.floor(c.used) >= c.limit - 1)
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
      <RegRibbon card="power-unit" />
      <div className="fac-phead flush">
        <div className="t">Power Unit Allocation</div>
        <div className="s">SEASON · {totalRaces} RACES</div>
      </div>
      <div className="pu-body">
        {components.map((c) => (
          <PuRow key={c.element} {...c} />
        ))}
      </div>
      {swapRows.length > 0 && (
        <div className="pu-strategy">
          <div className="fac-phead flush">
            <div className="t">Component Strategy</div>
            <div className="s">PRE-WEEKEND ELECTIONS</div>
          </div>
          <div className="pu-strategy-rows">
            {swapRows.map((row) => (
              <button
                key={`${row.driverId}-${row.element}`}
                type="button"
                className={`pu-swap-row ${row.band}${row.elected ? ' elected' : ''}`}
                onClick={() => onElectSwap(row.driverId, row.element)}
                disabled={row.elected}
              >
                <span className="pk">
                  {row.driverShortName} · {(ELEMENT_LABELS[row.element] ?? row.element.toUpperCase())} · {Math.floor(row.used)}/{row.limit} USED
                </span>
                <span className="pv">
                  {row.elected
                    ? 'ELECTED'
                    : row.band === 'danger'
                      ? `INTRODUCE NEW · −${row.projectedPenalty} PL`
                      : 'INTRODUCE NEW · FREE'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
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
