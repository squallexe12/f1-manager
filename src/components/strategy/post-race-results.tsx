'use client'

interface DriverResultDisplay {
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  position: number
  gapToLeader: number
  lapTime: number | null
  retired: boolean
}

interface PostRaceResultsProps {
  results: DriverResultDisplay[]
  fastestLap: { driverId: string; time: number } | null
  raceName: string
  onContinue: () => void
  className?: string
}

const POINTS_TABLE: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
  6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

// Stint analysis skipped: compoundHistory is not in PostRaceResultsProps (prop
// signature is frozen per AGENTS.md). Fallback: left column fills full width.

// Standings swing skipped: no pre/post championship delta is computed in the
// store or orchestrator. Fallback: Championship snapshot tile showing race
// points scored, derived from results + POINTS_TABLE (data available in props).

export function PostRaceResults({ results, fastestLap, raceName, onContinue, className = '' }: PostRaceResultsProps) {
  const podium = results.slice(0, 3)
  // Reference layout: [P2, P1, P3] — visual podium stagger
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as DriverResultDisplay[]

  const fastestDriver = fastestLap
    ? results.find(r => r.driverId === fastestLap.driverId)
    : null

  // Top 10 with points for championship snapshot sidebar. Retired (DNF) cars
  // score nothing even if attrition classifies them inside the top 10.
  const pointsRows = results.slice(0, 10).map(r => ({
    ...r,
    points: r.retired ? 0 : (POINTS_TABLE[r.position] ?? 0),
    hasFastestLap: !r.retired && fastestLap?.driverId === r.driverId,
  }))

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* ── Post-wrap: left (hero + table) | right (sidebar) ── */}
      {/* Sidebar widens since stint-analysis section is omitted (§5.1 fallback) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 400px' }}>

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">

          {/* Hero block */}
          <div
            className="relative overflow-hidden bg-surface-paper border border-line-sub rounded-rad p-8"
          >
            {/* Diagonal stripe — right-edge decoration */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-2/5 opacity-40"
              style={{
                background:
                  'repeating-linear-gradient(135deg, transparent 0 14px, oklch(0.22 0.02 260) 14px 16px)',
              }}
              aria-hidden
            />

            {/* Flag label */}
            <div className="font-mono text-[11px] tracking-[0.3em] text-sig-red font-bold uppercase">
              ◆ CHEQUERED FLAG · {raceName.toUpperCase()}
            </div>

            {/* Race name */}
            <div
              className="font-display font-extrabold text-ink-hi mt-1 leading-none"
              style={{ fontSize: '44px', letterSpacing: '-0.03em' }}
            >
              {raceName.toUpperCase()}
            </div>

            {/* Podium grid — P2 | P1 | P3 */}
            <div className="grid grid-cols-3 gap-3 mt-7 items-end">
              {podiumOrder.map(result => {
                const pos = result.position
                const isFirst = pos === 1
                const marginTop = isFirst ? '0px' : pos === 2 ? '18px' : '32px'
                return (
                  <div
                    key={result.driverId}
                    className={[
                      'relative overflow-hidden flex flex-col gap-2 rounded-rad p-[18px]',
                      isFirst
                        ? 'border border-sig-red'
                        : 'bg-surface-raised border border-line-hair',
                    ].join(' ')}
                    style={{
                      marginTop,
                      // P1: red-shaded background per spec .podium-slot.p1
                      background: isFirst
                        ? 'oklch(0.24 0.05 25 / 0.5)'
                        : undefined,
                      // team colour left-edge stripe via ::before equivalent
                      borderLeft: `4px solid ${result.teamColor}`,
                    }}
                  >
                    {/* Position number */}
                    <div
                      className="font-display font-extrabold leading-none tabular-nums"
                      style={{
                        fontSize: '52px',
                        letterSpacing: '-0.04em',
                        color: isFirst ? 'var(--sig-red)' : 'var(--ink-hi)',
                      }}
                    >
                      {pos}
                    </div>

                    {/* Driver name */}
                    <div
                      className="font-display font-bold text-ink-hi"
                      style={{ fontSize: '20px' }}
                    >
                      {result.driverName}
                    </div>

                    {/* Team name */}
                    <div className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
                      {result.teamName}
                    </div>

                    {/* Time / gap */}
                    <div
                      className={[
                        'font-mono text-[13px] tabular-nums mt-1',
                        result.retired ? 'text-sig-red font-bold' : 'text-ink-body',
                      ].join(' ')}
                    >
                      {result.retired
                        ? 'DNF'
                        : pos === 1
                          ? '—'
                          : `+${result.gapToLeader.toFixed(3)}s`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Classification table */}
          <div className="bg-surface-paper border border-line-sub rounded-rad overflow-hidden">
            {/* Header */}
            <div
              className="grid gap-3 px-4 py-2.5 bg-surface-raised border-b border-line-hair
                         font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim font-bold"
              style={{ gridTemplateColumns: '38px 1fr 80px 90px' }}
            >
              <div>POS</div>
              <div>DRIVER · TEAM</div>
              <div className="text-right">GAP</div>
              <div className="text-right">POINTS</div>
            </div>

            {results.map((r) => {
              const racePoints = r.retired ? 0 : (POINTS_TABLE[r.position] ?? 0)
              const hasFl = !r.retired && fastestLap?.driverId === r.driverId
              const totalPoints = racePoints + (hasFl && r.position <= 10 ? 1 : 0)
              const isLast = r.position === results.length

              return (
                <div
                  key={r.driverId}
                  className={[
                    'grid gap-3 px-4 py-2.5 font-mono text-[12px] items-center',
                    isLast ? '' : 'border-b border-line-hair',
                    r.retired ? 'opacity-60' : '',
                  ].join(' ')}
                  style={{
                    gridTemplateColumns: '38px 1fr 80px 90px',
                    background: r.isPlayer
                      ? 'oklch(0.20 0.03 25 / 0.35)'
                      : undefined,
                  }}
                >
                  {/* Position */}
                  <div
                    className="font-display font-extrabold tabular-nums"
                    style={{
                      fontSize: '16px',
                      color: r.position === 1 ? 'var(--sig-red)' : 'var(--ink-hi)',
                    }}
                  >
                    {r.position}
                  </div>

                  {/* Driver + team */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-[3px] h-[18px] shrink-0 rounded-full"
                      style={{ background: r.teamColor }}
                    />
                    <span
                      className="font-display font-bold text-ink-hi"
                      style={{ fontSize: '14px' }}
                    >
                      {r.driverName.split(' ').pop()?.toUpperCase()}
                    </span>
                    <span className="text-ink-dim text-[10px] tracking-[0.12em]">
                      {r.teamName.slice(0, 14).toUpperCase()}
                    </span>
                    {hasFl && (
                      <span className="font-mono text-[9px] tracking-[0.12em] text-sig-purple font-bold uppercase">
                        FL
                      </span>
                    )}
                  </div>

                  {/* Gap */}
                  <div
                    className={[
                      'text-right tabular-nums',
                      r.retired ? 'text-sig-red font-bold' : 'text-ink-body',
                    ].join(' ')}
                  >
                    {r.retired
                      ? 'DNF'
                      : r.position === 1
                        ? 'WINNER'
                        : `+${r.gapToLeader.toFixed(1)}s`}
                  </div>

                  {/* Points */}
                  <div
                    className="text-right font-bold tabular-nums"
                    style={{ color: totalPoints > 0 ? 'var(--sig-green)' : 'var(--ink-dim)' }}
                  >
                    {totalPoints > 0 ? `+${totalPoints}` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="flex flex-col gap-4">

          {/* Fastest Lap card */}
          {fastestDriver && fastestLap && (
            <div
              className="relative rounded-rad border border-sig-purple p-[22px]"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.22 0.14 300 / 0.3), transparent 60%), var(--surface-paper)',
              }}
            >
              <div className="font-mono text-[10px] tracking-[0.2em] text-ink-dim uppercase font-bold mb-3">
                Fastest Lap
              </div>
              <div
                className="font-display font-extrabold text-sig-purple leading-none tabular-nums"
                style={{ fontSize: '40px', letterSpacing: '-0.02em' }}
              >
                {formatTime(fastestLap.time)}
              </div>
              <div
                className="font-display font-bold text-ink-hi mt-1.5"
                style={{ fontSize: '16px' }}
              >
                {fastestDriver.driverName.toUpperCase()}
              </div>
              <div className="font-mono text-[10px] tracking-[0.16em] text-ink-dim uppercase mt-0.5">
                +1 POINT AWARDED
              </div>
            </div>
          )}

          {/* Championship snapshot — race points scored this round (standings swing
              data unavailable: no pre/post delta in store; §5.2 fallback applied) */}
          <div className="bg-surface-paper border border-line-sub rounded-rad overflow-hidden">
            <div className="px-4 py-3 bg-surface-raised border-b border-line-hair font-mono text-[10px] tracking-[0.16em] text-ink-hi font-bold uppercase">
              Points Scored · This Race
            </div>
            <div className="flex flex-col">
              {pointsRows.map((r, i) => {
                const isLastRow = i === pointsRows.length - 1
                return (
                  <div
                    key={r.driverId}
                    className={[
                      'flex justify-between items-center px-4 py-2 font-mono text-[12px]',
                      isLastRow ? '' : 'border-b border-dashed border-line-hair',
                    ].join(' ')}
                    style={{
                      background: r.isPlayer
                        ? 'oklch(0.20 0.03 25 / 0.35)'
                        : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-ink-dim w-5 tabular-nums">{r.position}</span>
                      <div
                        className="w-[3px] h-[14px] rounded-full shrink-0"
                        style={{ background: r.teamColor }}
                      />
                      <span className="text-ink-body">
                        {r.driverName.split(' ').pop()?.toUpperCase()}
                      </span>
                      {r.hasFastestLap && (
                        <span className="text-[9px] text-sig-purple font-bold tracking-[0.1em]">FL</span>
                      )}
                    </div>
                    <span
                      className="font-bold tabular-nums"
                      style={{
                        color: r.points > 0 ? 'var(--sig-green)' : 'var(--ink-dim)',
                      }}
                    >
                      {r.points > 0 ? `+${r.points + (r.hasFastestLap ? 1 : 0)}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Continue CTA */}
          <div
            className="bg-surface-paper border border-line-sub rounded-rad p-4 mt-auto"
          >
            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-2 px-4 py-3
                         bg-sig-red text-ink-hi font-mono font-bold text-[12px]
                         tracking-[0.12em] uppercase rounded-rad
                         hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sig-red
                         focus-visible:ring-offset-2 focus-visible:ring-offset-surface-paper
                         active:scale-[0.98]"
              style={{ transition: 'opacity 150ms ease, transform 100ms ease' }}
            >
              CONTINUE TO MANAGEMENT
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
