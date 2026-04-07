import { DonutChart } from '@/components/ui/donut-chart'

interface AeroAllocationProps {
  windTunnelUsed: number
  windTunnelLimit: number
  cfdUsed: number
  cfdLimit: number
  className?: string
}

export function AeroAllocation({ windTunnelUsed, windTunnelLimit, cfdUsed, cfdLimit, className = '' }: AeroAllocationProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Aero Testing
      </h3>
      <div className="flex gap-6 justify-center">
        <DonutChart
          percentage={(windTunnelUsed / windTunnelLimit) * 100}
          color="var(--accent-cyan)"
          label="Wind Tunnel"
          sublabel={`${windTunnelUsed}/${windTunnelLimit}h`}
          size={90}
        />
        <DonutChart
          percentage={(cfdUsed / cfdLimit) * 100}
          color="var(--accent-purple)"
          label="CFD"
          sublabel={`${cfdUsed}/${cfdLimit} runs`}
          size={90}
        />
      </div>
    </div>
  )
}
