'use client'

import type { Driver } from '@/types/driver'
import { RadarChart } from '@/components/charts/radar-chart'

interface DriverProfileProps {
  driver: Driver
  teamColor: string
  className?: string
}

export function DriverProfile({ driver, teamColor, className = '' }: DriverProfileProps) {
  const stats = driver.seasonStats
  const overallRating = Math.round(
    (driver.attributes.pace * 1.3 + driver.attributes.racecraft * 1.2 +
     driver.attributes.experience * 0.8 + driver.attributes.mentality * 0.7 +
     driver.attributes.marketability * 0.3 + driver.attributes.developmentPotential * 0.2) / 4.5
  )

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: teamColor }} />
        <div>
          <h2 className="text-lg font-heading font-bold text-[var(--text-primary)]">
            {driver.firstName} {driver.lastName}
          </h2>
          <div className="flex gap-3 text-xs text-[var(--text-muted)]">
            <span>{driver.nationality}</span>
            <span>Age {driver.age}</span>
            <span className="font-mono text-[var(--accent-lime)]">OVR {overallRating}</span>
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <RadarChart
        data={driver.attributes as unknown as Record<string, number>}
        color={teamColor}
        className="max-w-[220px] mx-auto"
      />

      {/* Season Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'PTS', value: stats.points },
          { label: 'WINS', value: stats.wins },
          { label: 'PODS', value: stats.podiums },
          { label: 'DNFs', value: stats.dnfs },
        ].map(({ label, value }) => (
          <div key={label} className="text-center bg-[var(--bg-surface)] rounded-md py-2">
            <div className="text-sm font-mono font-bold text-[var(--text-primary)]">{value}</div>
            <div className="text-[9px] font-heading text-[var(--text-dim)] uppercase">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
