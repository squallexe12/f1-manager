import type { DepartmentHead } from '@/types/team'

interface DepartmentPanelProps {
  departments: DepartmentHead[]
  className?: string
}

const ROLE_LABELS: Record<string, string> = {
  'technical-director': 'Technical Director',
  'race-engineer': 'Race Engineer',
  'commercial-director': 'Commercial Director',
  'team-manager': 'Team Manager',
}

export function DepartmentPanel({ departments, className = '' }: DepartmentPanelProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Department Heads
      </h3>
      <div className="border border-[var(--border-default)] rounded-lg divide-y divide-[var(--border-default)] bg-[var(--bg-surface)]">
        {departments.map(dept => (
          <div key={dept.role} className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs font-heading font-semibold text-[var(--text-primary)] truncate">
                {dept.name}
              </div>
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                {ROLE_LABELS[dept.role] ?? dept.role}
              </div>
            </div>
            <div className="shrink-0 text-[10px] font-mono text-[var(--accent-cyan)] tabular-nums">
              {dept.skill}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
