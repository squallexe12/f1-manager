'use client'

import type { RndUpgrade } from '@/types/team'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TechNodeProps {
  upgrade: RndUpgrade
  onStart?: (id: string) => void
  onPause?: (id: string) => void
  /** When true, node is the Technical Director's current active recommendation */
  recommended?: boolean
  className?: string
}

const STATUS_BADGE: Record<string, { label: string; variant: 'lime' | 'cyan' | 'amber' | 'neutral' }> = {
  complete: { label: 'Complete', variant: 'lime' },
  'in-progress': { label: 'In Progress', variant: 'cyan' },
  available: { label: 'Available', variant: 'amber' },
  queued: { label: 'Queued', variant: 'neutral' },
  locked: { label: 'Locked', variant: 'neutral' },
}

export function TechNode({ upgrade, onStart, onPause, recommended = false, className = '' }: TechNodeProps) {
  const badge = STATUS_BADGE[upgrade.status]
  const isLocked = upgrade.status === 'locked'
  const isComplete = upgrade.status === 'complete'
  const isInProgress = upgrade.status === 'in-progress'
  const showRecommended = recommended && upgrade.status === 'available'

  return (
    <div
      className={`
        border rounded-lg p-3 transition-all duration-150
        ${isComplete ? 'border-[var(--accent-lime)]/40 bg-[var(--accent-lime)]/[0.03]' : ''}
        ${isInProgress ? 'border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/[0.03] shadow-[0_0_12px_rgba(0,229,255,0.06)]' : ''}
        ${showRecommended ? 'border-[var(--accent-cyan)]/60 bg-[var(--accent-cyan)]/[0.05] shadow-[0_0_18px_rgba(0,229,255,0.10)]' : ''}
        ${isLocked ? 'border-[var(--border-default)] opacity-40' : ''}
        ${!isLocked && !isComplete && !isInProgress && !showRecommended ? 'border-[var(--border-default)] bg-[var(--bg-surface)]' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className={`text-xs font-heading font-semibold ${isLocked ? 'text-[var(--text-dim)]' : 'text-[var(--text-primary)]'}`}>
          {isComplete && '✓ '}{upgrade.name}
        </span>
        <div className="flex items-center gap-1.5">
          {showRecommended && (
            <span
              className="
                text-[9px] font-mono uppercase tracking-wider
                px-1.5 py-0.5 rounded-full
                bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)]
                border border-[var(--accent-cyan)]/40
              "
              title="Technical Director recommends this upgrade"
            >
              TD Pick
            </span>
          )}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-muted)] mb-2 leading-relaxed">
        {upgrade.description}
      </p>

      {isInProgress && (
        <div className="mb-2">
          <ProgressBar value={upgrade.progress} color="var(--accent-cyan)" />
          <div className="text-[10px] font-mono text-[var(--text-dim)] mt-1">
            ETA: {Math.ceil(((100 - upgrade.progress) / 100) * upgrade.developmentRaces)} races
          </div>
        </div>
      )}

      {/* Performance delta preview */}
      <div className="flex flex-wrap gap-1 mb-2">
        {Object.entries(upgrade.performanceDelta).map(([key, val]) => (
          val ? (
            <span
              key={key}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                val > 0 ? 'bg-[var(--accent-lime)]/10 text-[var(--accent-lime)]' : 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
              }`}
            >
              {key}: {val > 0 ? '+' : ''}{val}
            </span>
          ) : null
        ))}
      </div>

      {/* Cost + Actions */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[var(--text-dim)]">
          ${(upgrade.cost / 1_000_000).toFixed(0)}M · {upgrade.developmentRaces} races
        </span>
        {upgrade.status === 'available' && onStart && (
          <Button size="sm" onClick={() => onStart(upgrade.id)}>Start</Button>
        )}
        {isInProgress && onPause && (
          <Button size="sm" variant="ghost" onClick={() => onPause(upgrade.id)}>Pause</Button>
        )}
      </div>
    </div>
  )
}
