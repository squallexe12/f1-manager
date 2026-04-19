'use client'

import type { Recommendation } from '@/types/delegation'
import { Button } from '@/components/ui/button'

interface RecommendationsPanelProps {
  recommendations: Recommendation[]
  onApply: (id: string) => void
  onDismiss: (id: string) => void
  className?: string
}

const ROLE_LABEL: Record<Recommendation['role'], string> = {
  'technical-director': 'Technical Director',
  'race-engineer': 'Race Engineer',
  'commercial-director': 'Commercial Director',
  'team-manager': 'Team Manager',
}

const ROLE_GLYPH: Record<Recommendation['role'], string> = {
  'technical-director': 'TD',
  'race-engineer': 'RE',
  'commercial-director': 'CD',
  'team-manager': 'TM',
}

export function RecommendationsPanel({
  recommendations,
  onApply,
  onDismiss,
  className = '',
}: RecommendationsPanelProps) {
  const active = recommendations.filter(r => r.status === 'active')

  return (
    <div className={`flex flex-col gap-2 ${className}`} role="feed" aria-label="Engineer recommendations">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)]">
          Engineer Recommendations
        </h3>
        <span className="text-[10px] font-mono text-[var(--text-dim)]">
          {active.length} active
        </span>
      </div>

      {active.length === 0 ? (
        <div className="border border-dashed border-[var(--border-default)] rounded-lg p-4 text-[11px] text-[var(--text-dim)] italic">
          All clear. Department heads have no open recommendations.
        </div>
      ) : (
        active.map(rec => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onApply={onApply}
            onDismiss={onDismiss}
          />
        ))
      )}
    </div>
  )
}

function RecommendationCard({
  recommendation,
  onApply,
  onDismiss,
}: {
  recommendation: Recommendation
  onApply: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const { id, role, description, applicable } = recommendation
  return (
    <article
      className="
        relative border border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/[0.04]
        rounded-lg p-3 shadow-[0_0_14px_rgba(0,229,255,0.04)]
      "
    >
      <div className="flex items-start gap-3">
        <div
          className="
            shrink-0 w-8 h-8 rounded-md grid place-items-center
            bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)]
            text-[10px] font-mono font-bold tracking-wider
          "
          aria-hidden
        >
          {ROLE_GLYPH[role]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--accent-cyan)] mb-0.5">
            {ROLE_LABEL[role]}
          </div>
          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-2">
        {applicable ? (
          <Button size="sm" variant="secondary" onClick={() => onApply(id)}>
            Apply
          </Button>
        ) : (
          <span
            className="
              text-[10px] font-mono uppercase tracking-wider
              text-[var(--text-dim)] px-2
            "
            title="Informational only — no direct action"
          >
            Informational
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDismiss(id)}>
          Dismiss
        </Button>
      </div>
    </article>
  )
}
