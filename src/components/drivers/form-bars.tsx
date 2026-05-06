'use client'

interface FormBarsProps {
  form: number[]
  lastRaceResult: number | null
}

function posClass(pos: number): string {
  if (pos >= 21) return 'back'
  if (pos <= 3) return 'podium'
  if (pos <= 10) return 'points'
  if (pos <= 15) return 'midfield'
  return 'back'
}

export function FormBars({ form, lastRaceResult }: FormBarsProps) {
  const lastLabel =
    lastRaceResult === null ? '—'
    : lastRaceResult >= 21 ? 'DNF'
    : `P${lastRaceResult}`

  return (
    <div className="drv-form" style={{ gridColumn: '1 / -1' }}>
      <span className="fk">FORM · LAST {form.length} ROUNDS</span>
      <div className="form-bars">
        {form.length === 0 ? (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--ink-dim)',
            textTransform: 'uppercase',
          }}>
            NO RACE STARTS THIS SEASON
          </span>
        ) : form.map((pos, i) => {
          const isDNF = pos >= 21
          const cls = posClass(pos)
          const h = isDNF ? 100 : Math.max(8, ((21 - pos) / 21) * 100)
          return (
            <div key={i} className={`fb ${cls}`}>
              <div className="fb-bar" style={{ height: 24 }}>
                <div className="fb-fill" style={{ height: `${h}%` }} />
              </div>
              <span className="fb-pos">{isDNF ? 'DNF' : `P${pos}`}</span>
            </div>
          )
        })}
      </div>
      <div className="last">
        <span className="lk">LAST RACE</span>
        {lastLabel}
      </div>
    </div>
  )
}
