'use client'

import type { Driver } from '@/types/driver'

interface ScoutPanelProps {
  scouts: Driver[]
  onApproach: (id: string) => void
  onFileReport: (id: string) => void
}

function signalClass(signal: string): string {
  switch (signal) {
    case 'hot': return 'signal hot'
    case 'tracking': return 'signal tracking'
    default: return 'signal available'
  }
}

export function ScoutPanel({ scouts, onApproach, onFileReport }: ScoutPanelProps) {
  const sorted = [...scouts].sort(
    (a, b) =>
      (b.attributes.pace + b.attributes.developmentPotential) -
      (a.attributes.pace + a.attributes.developmentPotential),
  )

  const top = sorted[0] ?? null
  const risingCount = scouts.filter(s => s.isF2).length
  const vetCount = scouts.filter(s => !s.isF2 && s.age >= 30).length

  return (
    <div>
      <div className="drv-section-head">
        <div>
          <div className="st">Scout Pool</div>
          <div className="ss">
            {sorted.length} AVAILABLE · {risingCount} RISING · {vetCount} VETERAN
          </div>
        </div>
        {top && (
          <div className="rt">
            RECOMMENDED · <span className="b">{top.lastName.toUpperCase()} · {top.scoutingReports} SCOUTING REPORTS</span>
          </div>
        )}
      </div>
      <div className="scout-grid">
        <div className="scout-row head">
          <div>CODE</div>
          <div>DRIVER</div>
          <div>PAC</div>
          <div>RCR</div>
          <div>POT</div>
          <div>SALARY</div>
          <div>STATUS</div>
        </div>
        {sorted.map(s => (
          <div key={s.id} className="scout-row">
            <div className="sc-code">
              {s.shortName}
              <span className="scn">#{s.scoutingReports}</span>
            </div>
            <div className="sc-name">
              <span className="nm">{s.firstName} {s.lastName}</span>
              <span className="meta">
                {s.isF2 && <span className="badge">F2</span>}
                {!s.isF2 && <span className="badge cyan">FREE AGENT</span>}
                {s.nationality} · AGE {s.age}
              </span>
            </div>
            <div className="sc-stat"><span className="sk">PAC</span>{s.attributes.pace}</div>
            <div className="sc-stat"><span className="sk">RCR</span>{s.attributes.racecraft}</div>
            <div className="sc-stat pot"><span className="sk">POT</span>{s.attributes.developmentPotential}</div>
            <div className="sc-salary">
              <span className="sk">ASKING</span>
              {s.contract ? `$${(s.contract.salary / 1_000_000).toFixed(s.contract.salary >= 10_000_000 ? 0 : 1)}M` : '—'}
            </div>
            <div className="sc-action">
              <span className={signalClass(s.scoutSignal)}>{s.scoutSignal.toUpperCase()}</span>
              <button className="approach-btn" onClick={() => onApproach(s.id)}>Approach</button>
              <button className="approach-btn" onClick={() => onFileReport(s.id)}>File Report</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
