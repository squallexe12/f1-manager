'use client'

import type { Driver, ScoutSignal } from '@/types/driver'
import { formatM } from '@/lib/utils/format'

export interface MarketAgent {
  driver: Driver
  signal: ScoutSignal
  asking: number
}

interface DriverMarketPanelProps {
  agents: MarketAgent[]
  onApproach: (driverId: string) => void
}

const SIGNAL_LABEL: Record<ScoutSignal, string> = {
  hot: 'HOT PROSPECT',
  tracking: 'TRACKING',
  available: 'AVAILABLE',
}

export function DriverMarketPanel({ agents, onApproach }: DriverMarketPanelProps) {
  if (agents.length === 0) {
    return (
      <div className="drv-market drv-market-empty">
        <p>NO FREE AGENTS IN THE MARKET</p>
      </div>
    )
  }

  return (
    <div className="drv-market">
      {agents.map(({ driver, signal, asking }) => (
        <div key={driver.id} className="drv-card drv-market-card">
          <div className="drv-card-head">
            <span className="t">{driver.firstName.toUpperCase()} {driver.lastName.toUpperCase()}</span>
            <span className={`s drv-signal drv-signal-${signal}`}>{SIGNAL_LABEL[signal]}</span>
          </div>
          <div className="drv-card-body">
            <div className="drv-market-row">
              <span className="k">Asking Salary</span>
              <span className="v">{formatM(asking)}<span className="u"> / YR</span></span>
            </div>
            <div className="drv-market-row">
              <span className="k">Pace</span><span className="v">{driver.attributes.pace}</span>
            </div>
            <div className="drv-market-row">
              <span className="k">Potential</span><span className="v">{driver.attributes.developmentPotential}</span>
            </div>
            <button className="cact-btn primary drv-approach-btn" onClick={() => onApproach(driver.id)}>
              Approach
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
