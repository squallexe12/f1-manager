import type { ComponentAllocation } from '@/types/team'
import { ProgressBar } from '@/components/ui/progress-bar'

interface ComponentStatusProps {
  components: ComponentAllocation[]
  className?: string
}

const ELEMENT_LABELS: Record<string, string> = {
  ice: 'ICE',
  turbo: 'Turbo',
  'ers-battery': 'ERS Battery',
  gearbox: 'Gearbox',
}

function getColor(used: number, limit: number): string {
  const ratio = used / limit
  if (ratio >= 1) return 'var(--accent-red)'
  if (ratio >= 0.75) return 'var(--accent-amber)'
  return 'var(--accent-lime)'
}

export function ComponentStatus({ components, className = '' }: ComponentStatusProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Power Unit Allocation
      </h3>
      {components.map((comp) => {
        const color = getColor(comp.used, comp.limit)
        const atRisk = comp.used >= comp.limit

        return (
          <div key={comp.element}>
            <div className="flex justify-between mb-0.5">
              <span className="text-xs text-[var(--text-secondary)]">
                {ELEMENT_LABELS[comp.element] ?? comp.element}
              </span>
              <span className="text-[10px] font-mono" style={{ color }}>
                {comp.used}/{comp.limit}
              </span>
            </div>
            <ProgressBar
              value={(comp.used / comp.limit) * 100}
              color={color}
            />
            {atRisk && (
              <div className="text-[10px] text-[var(--accent-red)] mt-0.5">
                Grid penalty on next change
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
