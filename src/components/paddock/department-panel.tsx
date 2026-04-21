import type { DepartmentHead } from '@/types/team'

interface DepartmentPanelProps {
  departments: DepartmentHead[]
  className?: string
}

const ROLE_LABELS: Record<DepartmentHead['role'], string> = {
  'technical-director': 'Technical Director',
  'race-engineer': 'Race Engineer',
  'commercial-director': 'Commercial Director',
  'team-manager': 'Team Manager',
}

const ROLE_GLYPH: Record<DepartmentHead['role'], string> = {
  'technical-director': 'TD',
  'race-engineer': 'RE',
  'commercial-director': 'CD',
  'team-manager': 'TM',
}

export function DepartmentPanel({ departments, className = '' }: DepartmentPanelProps) {
  return (
    <div className={`pd-dept ${className}`} role="list" aria-label="Department heads">
      <div className="pd-panel-head">
        <div className="ph-title">Department Heads</div>
        <div className="ph-sub">{departments.length} ROLES</div>
      </div>
      {departments.map(dept => (
        <div key={dept.role} className="pd-dept-row" role="listitem">
          <div className="pd-dept-glyph" aria-hidden>{ROLE_GLYPH[dept.role]}</div>
          <div className="pd-dept-info">
            <div className="pd-dept-name">{dept.name}</div>
            <div className="pd-dept-role">{ROLE_LABELS[dept.role]}</div>
          </div>
          <div className="pd-dept-stats">
            <div className="pd-dept-skill">{dept.skill}</div>
            <div className="pd-dept-contract">
              &apos;{String(dept.contractEndSeason).slice(-2).padStart(2, '0')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
