'use client'

import type { Driver, DriverAttributes } from '@/types/driver'
import { AttrRadar } from '@/components/drivers/attr-radar'

interface AttributesCardProps {
  driver: Driver
  peer: DriverAttributes
  teamColor: string
}

const ATTR_LABELS: Record<keyof DriverAttributes, string> = {
  pace: 'PACE',
  racecraft: 'RACECRAFT',
  experience: 'EXPERIENCE',
  mentality: 'MENTALITY',
  marketability: 'MARKETABILITY',
  developmentPotential: 'POTENTIAL',
}

const ATTR_KEYS: (keyof DriverAttributes)[] = [
  'pace',
  'racecraft',
  'experience',
  'mentality',
  'marketability',
  'developmentPotential',
]

export function AttributesCard({ driver, peer, teamColor }: AttributesCardProps) {
  return (
    <div className="drv-card attrs">
      <div className="drv-card-head">
        <span className="t">Attributes</span>
        <span className="s">vs Grid Peer Average</span>
      </div>
      <div className="drv-card-body">
        <div className="attr-radar-row">
          <div className="attr-radar">
            <AttrRadar attrs={driver.attributes} peer={peer} color={teamColor} />
          </div>
          <div className="attr-bars">
            {ATTR_KEYS.map(k => {
              const v = driver.attributes[k]
              const p = peer[k]
              const delta = v - p
              return (
                <div key={k} className="attr-row" style={{ ['--peer' as string]: `${p}%` }}>
                  <span className="ak">{ATTR_LABELS[k]}</span>
                  <div className="attr-bar">
                    <div className="fill" style={{ transform: `scaleX(${v / 100})` }} />
                  </div>
                  <span className="av">
                    {v}
                    <span className={`delta ${delta >= 0 ? 'up' : 'dn'}`}>
                      {delta >= 0 ? '+' : ''}{delta}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
