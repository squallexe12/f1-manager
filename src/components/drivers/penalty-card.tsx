'use client'

import type { Driver } from '@/types/driver'
import { computeExpiryRound } from '@/lib/utils/penalty-expiry'
import {
  OFFENCE_LABELS,
  bandForPoints,
  colorForBand,
} from '@/components/strategy/penalty-labels'

type Band = ReturnType<typeof bandForPoints>

function labelForBand(b: Band): string {
  const labels: Record<Band, string> = {
    clean: 'CLEAN',
    approaching: 'APPROACHING',
    warning: 'WARNING ZONE',
    critical: 'BAN PENDING',
  }
  return labels[b]
}

const SEGMENTS = [
  { threshold: 3, band: 'clean' },
  { threshold: 6, band: 'approaching' },
  { threshold: 9, band: 'warning' },
  { threshold: 12, band: 'critical' },
]

const W_THRESH = 5

interface PenaltyCardProps {
  driver: Driver
  currentSeason: number
  currentRound: number
}

export function PenaltyCard({ driver, currentSeason, currentRound }: PenaltyCardProps) {
  const total = driver.penaltyPoints.reduce((a, e) => a + e.points, 0)
  const band = bandForPoints(total)
  const label = labelForBand(band)
  const isClean =
    total === 0 &&
    driver.warningsThisSeason === 0 &&
    driver.banUntilRound === null &&
    driver.nextRaceGridDrop === 0

  if (isClean) {
    return (
      <div className="drv-card">
        <div className="drv-card-head">
          <span className="t">Steward Record</span>
          <span className="s">22-Round Window</span>
        </div>
        <div className="drv-card-body">
          <div className="penalty-clean">
            <div className="check">✓</div>
            <div className="ck">CLEAN RECORD</div>
            <div className="cs">No active penalty points · No warnings</div>
          </div>
        </div>
      </div>
    )
  }

  const wBand =
    driver.warningsThisSeason >= W_THRESH ? 'crit' :
    driver.warningsThisSeason >= 3 ? 'warn' : ''

  const sortedEntries = [...driver.penaltyPoints].sort((a, b) => {
    // Sort newest first: higher season first, then higher round
    if (b.issuedSeason !== a.issuedSeason) return b.issuedSeason - a.issuedSeason
    return b.issuedRound - a.issuedRound
  })

  return (
    <div className="drv-card">
      <div className="drv-card-head">
        <span className="t">Steward Record</span>
        <span className="s">22-Round Window</span>
      </div>
      <div className="drv-card-body">
        {driver.banUntilRound !== null && (
          <div className="ban-banner">
            BANNED · UNTIL R{String(driver.banUntilRound).padStart(2, '0')}
            <span className="bnote">{driver.banUntilRound - currentRound} race(s) away</span>
          </div>
        )}
        <div className="penalty-hero">
          <div className={`penalty-points ${band}`}>{total}</div>
          <div className="penalty-points-meta">
            <span className="pk">Penalty Points</span>
            <span
              className={`plbl ${band}`}
              style={{ color: colorForBand(band) }}
            >
              {label}
            </span>
          </div>
          <div className="penalty-segs">
            {SEGMENTS.map((s, i) => (
              <div
                key={i}
                className={`penalty-seg ${total >= s.threshold ? `f ${s.band}` : ''}`}
              />
            ))}
          </div>
        </div>
        {sortedEntries.length > 0 && (
          <div className="penalty-entries">
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.2em',
              color: 'var(--ink-dim)',
              textTransform: 'uppercase',
              paddingBottom: 4,
              borderBottom: '1px solid var(--line-hair)',
            }}>
              Active Entries
            </div>
            {sortedEntries.map((e, i) => {
              const expiry = computeExpiryRound(e.issuedRound, e.issuedSeason, 22)
              const roundsLeft = 22 - ((currentSeason - e.issuedSeason) * 22 + (currentRound - e.issuedRound))
              return (
                <div key={i} className="penalty-entry">
                  <div className="pp">+{e.points}</div>
                  <div>
                    <div className="poff">{OFFENCE_LABELS[e.offenceType] ?? e.offenceType}</div>
                    <div className="ptime">
                      <span>S{e.issuedSeason} R{String(e.issuedRound).padStart(2, '0')}</span>
                      <span style={{ color: 'var(--line-strong)' }}>·</span>
                      <span>EXPIRES S{expiry.season} R{String(expiry.round).padStart(2, '0')}</span>
                    </div>
                  </div>
                  <div className="pexp">{roundsLeft} R LEFT</div>
                </div>
              )
            })}
          </div>
        )}
        <div className="warnings-block">
          <div className="w-head">
            <span className="wk">Season Warnings</span>
            <span className={`wv ${wBand}`}>{driver.warningsThisSeason} / {W_THRESH}</span>
          </div>
          <div className="warning-track">
            {Array.from({ length: W_THRESH }).map((_, i) => (
              <div
                key={i}
                className={`warning-seg ${i < driver.warningsThisSeason ? `f ${wBand}` : ''}`}
              />
            ))}
          </div>
          {driver.nextRaceGridDrop > 0 && (
            <div className="grid-drop">
              ⚠ −{driver.nextRaceGridDrop} GRID PLACES PENDING NEXT QUALIFYING
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
