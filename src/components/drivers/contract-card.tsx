'use client'

import type { Driver } from '@/types/driver'

/**
 * Formats a salary/bonus number as $XM, e.g. $55M or $2.2M.
 * Matches formatM in the reference HTML (new-designs/drivers/Drivers Page.html).
 */
function formatM(n: number): string {
  return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
}

interface ContractCardProps {
  driver: Driver
  currentSeason: number
  onNegotiate: () => void
  onRelease: () => void
}

export function ContractCard({ driver, currentSeason, onNegotiate, onRelease }: ContractCardProps) {
  const c = driver.contract

  if (!c) {
    return (
      <div className="drv-card">
        <div className="drv-card-head">
          <span className="t">Contract</span>
          <span className="s">—</span>
        </div>
        <div className="drv-card-body">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
            FREE AGENT — NO ACTIVE CONTRACT
          </p>
        </div>
      </div>
    )
  }

  const expiringSoon = c.termEndSeason <= 1

  return (
    <div className="drv-card">
      <div className="drv-card-head">
        <span className="t">Contract</span>
        <span className="s">{c.termEndSeason} SEASON{c.termEndSeason !== 1 ? 'S' : ''} REMAINING</span>
      </div>
      <div className="drv-card-body">
        <div className="contract-hero">
          <div>
            <div className="ck">Annual Salary</div>
            <div className="cv">
              {formatM(c.salary)}
              <span className="u">/ YR</span>
            </div>
          </div>
          <div className={`cterm ${expiringSoon ? 'expiring' : ''}`}>
            <span className="tk">Expires</span>
            <span className="tv">
              {expiringSoon ? 'EOS' : `S${currentSeason + c.termEndSeason - 1}`}
            </span>
          </div>
        </div>
        <div className="contract-rows">
          <div className="contract-row">
            <span className="k">Release Clause</span>
            <span className={`v ${c.releaseClause ? '' : 'muted'}`}>
              {c.releaseClause ? formatM(c.releaseClause) : 'None'}
            </span>
          </div>
          <div className="contract-row">
            <span className="k">Signed Through</span>
            <span className="v">S{currentSeason + c.termEndSeason - 1}</span>
          </div>
        </div>
        {c.performanceBonuses.length > 0 && (
          <div className="contract-bonuses">
            <div className="contract-bonus-head">Performance Bonuses</div>
            {c.performanceBonuses.map((b, i) => (
              <div key={i} className="bonus-row">
                <span className="bcond">{b.condition}</span>
                <span className="bval">+{formatM(b.value)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="contract-actions">
          <button className="cact-btn primary" onClick={onNegotiate}>Open Negotiation</button>
          <button className="cact-btn" onClick={onRelease}>Release Talks</button>
        </div>
      </div>
    </div>
  )
}
