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
    <div className={`flex flex-col gap-2 ${className}`}>
      <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
        Department Heads
      </h3>
      {departments.map((dept) => (
        <div
          key={dept.role}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
              {dept.name}
            </span>
            <span className="text-[10px] font-mono text-[var(--accent-cyan)]">
              {dept.skill}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">
            {ROLE_LABELS[dept.role] ?? dept.role}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {dept.currentFocus}
          </div>
          {dept.flaggedIssue && (
            <div className="text-[10px] text-[var(--accent-amber)] mt-1">
              ⚠ {dept.flaggedIssue}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
