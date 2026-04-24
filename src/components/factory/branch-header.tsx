import type { CSSProperties } from 'react'

interface BranchHeaderProps {
  label: string
  color: string
  completed: number
  total: number
  active: boolean
}

export function BranchHeader({ label, color, completed, total, active }: BranchHeaderProps) {
  return (
    <div className="branch-head" style={{ ['--branch-color' as string]: color } as CSSProperties}>
      <span className="bname">{label}</span>
      <span className="bcount">
        {completed}/{total}
      </span>
      <span className={`bsub${active ? ' active' : ''}`}>{active ? '◉ ACTIVE' : 'STANDBY'}</span>
    </div>
  )
}
