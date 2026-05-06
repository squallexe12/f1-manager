'use client'

import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import { computeDriverOvr } from '@/lib/utils/driver-ovr'
import { DriverPortrait } from '@/components/drivers/driver-portrait'
import { FormBars } from '@/components/drivers/form-bars'

interface DriverHeroProps {
  driver: Driver
  team: Team
  currentSeason: number
  championshipPosition: number | null
  championshipGap: number | null
}

export function DriverHero({ driver, team, currentSeason, championshipPosition, championshipGap }: DriverHeroProps) {
  const ovr = computeDriverOvr(driver.attributes)
  const stats = driver.seasonStats
  const hasCareer = driver.careerStarts > 0

  return (
    <div className="drv-hero" style={{ ['--team' as string]: team.color }}>
      {/* Helmet column */}
      <div className="drv-helm">
        {driver.worldTitles > 0 && (
          <div className="drv-helm-titles">
            {Array.from({ length: Math.min(driver.worldTitles, 5) }).map((_, i) => (
              <span key={i} className="star">★</span>
            ))}
            <span className="tlbl">{driver.worldTitles}× WORLD CHAMPION</span>
          </div>
        )}
        <div className="drv-helm-shape">
          <DriverPortrait driver={driver} color={team.color} />
        </div>
        <div className="drv-helm-num">{driver.shortName}</div>
        <div className="drv-helm-code">{driver.shortName}</div>
        <div className="drv-helm-tag">
          {driver.isReserve ? 'RESERVE' : driver.teamId ? 'RACE DRIVER' : 'FREE AGENT'} · {team.name}
        </div>
        {hasCareer && (
          <div className="drv-helm-career">
            <div className="cw-cell"><span className="k">CAREER WINS</span><span className="v">{driver.careerWins}</span></div>
            <div className="cw-cell"><span className="k">PODIUMS</span><span className="v">{driver.careerPodiums}</span></div>
            <div className="cw-cell"><span className="k">STARTS</span><span className="v">{driver.careerStarts}</span></div>
          </div>
        )}
      </div>

      {/* ID column */}
      <div className="drv-id">
        <div className="drv-id-top">
          <div>
            <div className="drv-id-name">
              <span className="drv-id-first">{driver.firstName}</span>
              <span className="drv-id-last">{driver.lastName.toUpperCase()}</span>
            </div>
            <div className="drv-id-meta">
              <span className="it"><span className="k">NAT</span> <span className="v">{driver.nationality}</span></span>
              <span className="it"><span className="k">AGE</span> <span className="v">{driver.age}</span></span>
              {driver.contract && (
                <span className="it"><span className="k">CONTRACT</span> <span className="v">S{currentSeason + driver.contract.termEndSeason - 1}</span></span>
              )}
            </div>
          </div>
          <div className="drv-id-ovr">
            <span className="k">OVR</span>
            <span className="v">{ovr}</span>
            <span className="d">CAREER</span>
          </div>
        </div>

        {championshipPosition !== null && (
          <div className="drv-champ">
            <div className="dc-pos">
              <span className="k">DRIVERS{'’'} STANDING</span>
              <span className="v">P{championshipPosition}<span className="of">/22</span></span>
            </div>
            <div className="dc-gap">
              <span className="k">GAP TO {championshipPosition === 1 ? 'P2' : 'LEADER'}</span>
              <span className={`v ${championshipGap === 0 ? '' : (championshipGap ?? 0) > 0 ? 'green' : 'amber'}`}>
                {(championshipGap ?? 0) > 0 ? '+' : ''}{championshipGap ?? 0} PTS
              </span>
            </div>
            <div className="dc-pulse">
              <span className="k">SEASON PULSE</span>
              <span className="hl">{driver.pulse.headline}</span>
              <span className="dt">{driver.pulse.detail}</span>
            </div>
          </div>
        )}

        {championshipPosition === null && driver.pulse && (
          <div className="drv-champ reserve">
            <div className="dc-pulse">
              <span className="k">RESERVE STATUS</span>
              <span className="hl">{driver.pulse.headline}</span>
              <span className="dt">{driver.pulse.detail}</span>
            </div>
          </div>
        )}

        <div className="drv-stats">
          <div className="drv-stat"><span className="k">PTS</span><span className="v">{stats.points}</span></div>
          <div className="drv-stat"><span className="k">WINS</span><span className={`v ${stats.wins > 0 ? 'green' : 'dim'}`}>{stats.wins}</span></div>
          <div className="drv-stat"><span className="k">PODS</span><span className={`v ${stats.podiums > 0 ? 'green' : 'dim'}`}>{stats.podiums}</span></div>
          <div className="drv-stat"><span className="k">POLES</span><span className={`v ${stats.poles > 0 ? '' : 'dim'}`}>{stats.poles}</span></div>
          <div className="drv-stat"><span className="k">DNF</span><span className={`v ${stats.dnfs > 1 ? 'red' : 'dim'}`}>{stats.dnfs}</span></div>
          <div className="drv-stat"><span className="k">PEN</span><span className={`v ${stats.penalties > 0 ? 'amber' : 'dim'}`}>{stats.penalties}</span></div>
          <div className="drv-stat"><span className="k">BEST</span><span className="v">{stats.bestFinish || '—'}</span></div>
          <div className="drv-stat"><span className="k">AVG</span><span className="v">{stats.averageFinish.toFixed(1)}</span></div>
        </div>
      </div>

      {/* Form strip — full width */}
      <FormBars form={driver.form} lastRaceResult={driver.lastRaceResult} />
    </div>
  )
}
