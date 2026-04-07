'use client'

import { useRequireGame } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import {
  getAllRegulationsUpTo, getTechnicalDirectives, getUpcomingDirectives,
} from '@/engine/regulations/regulation-engine'
import { REGULATION_CHANGES } from '@/data/regulations'

const CATEGORY_BADGE: Record<string, 'lime' | 'cyan' | 'amber' | 'purple' | 'red' | 'neutral'> = {
  'budget-cap': 'amber',
  'aero': 'cyan',
  'power-unit': 'purple',
  'tires': 'red',
  'sporting': 'lime',
  'components': 'neutral',
}

export default function RegulationsPage() {
  const world = useRequireGame()

  if (!world) return null

  const { gameState } = world
  const currentSeason = gameState.season
  const currentRound = gameState.currentRound

  // Current active regulations (cumulative)
  const activeRegulations = getAllRegulationsUpTo(currentSeason)

  // Active technical directives this season
  const activeDirectives = getTechnicalDirectives(currentSeason, currentRound)
  const upcomingDirectives = getUpcomingDirectives(currentSeason, currentRound)

  // Future regulation changes
  const futureRegulations = REGULATION_CHANGES.filter(r => r.season > currentSeason)
  const futureSeasons = [...new Set(futureRegulations.map(r => r.season))].sort()

  return (
    <PageShell>
      <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)] mb-6">
        Regulations — Season {currentSeason}
      </h2>

      {/* Current Rules Summary */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 mb-6">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Current Rules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RuleCard
            label="Budget Cap"
            value={`$${(world.finance[gameState.playerTeamId]?.budget.cap / 1_000_000).toFixed(0)}M`}
            description="Total team operations spending limit"
          />
          <RuleCard
            label="Power Unit Cap"
            value="$130M"
            description="Separate cap for PU manufacturer spending"
          />
          <RuleCard
            label="Power Unit"
            value="1.6L V6 Turbo Hybrid"
            description="~50/50 ICE/Electric split, no MGU-H"
          />
          <RuleCard
            label="Aerodynamics"
            value="Active Front + Rear"
            description="No DRS — replaced by Overtake Mode"
          />
          <RuleCard
            label="Fuel"
            value="100% Sustainable"
            description="Mandatory advanced sustainable fuel"
          />
          <RuleCard
            label="Tires"
            value="Pirelli C1-C5"
            description="3 compounds selected per race"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technical Directives */}
        <div>
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Technical Directives
          </h3>

          {/* Active */}
          {activeDirectives.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {activeDirectives.map(td => (
                <div
                  key={td.id}
                  className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                      {td.title}
                    </span>
                    <Badge variant="lime">Active</Badge>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mb-1">{td.description}</p>
                  <div className="flex gap-2 text-[9px] font-mono text-[var(--text-dim)]">
                    <span>Area: {td.affectedArea}</span>
                    <span>Round {td.round}</span>
                    {Object.entries(td.performanceImpact).map(([attr, delta]) => (
                      <span key={attr} className={delta > 0 ? 'text-[var(--accent-lime)]' : 'text-[var(--accent-red)]'}>
                        {attr}: {delta > 0 ? '+' : ''}{delta}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcomingDirectives.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">Upcoming</span>
              {upcomingDirectives.map(td => (
                <div
                  key={td.id}
                  className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 opacity-70"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                      {td.title}
                    </span>
                    <Badge variant="amber">Round {td.round}</Badge>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)]">{td.description}</p>
                </div>
              ))}
            </div>
          )}

          {activeDirectives.length === 0 && upcomingDirectives.length === 0 && (
            <p className="text-xs text-[var(--text-dim)] italic">No technical directives this season.</p>
          )}
        </div>

        {/* Regulation Timeline */}
        <div>
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Regulation Timeline
          </h3>

          {/* Regulations applied this season */}
          {activeRegulations.filter(r => r.season === currentSeason).length > 0 && (
            <div className="mb-4">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--accent-lime)]">
                Season {currentSeason} (Current)
              </span>
              <div className="flex flex-col gap-2 mt-2">
                {activeRegulations.filter(r => r.season === currentSeason).map(reg => (
                  <RegulationCard key={reg.id} regulation={reg} isActive />
                ))}
              </div>
            </div>
          )}

          {/* Future seasons */}
          {futureSeasons.map(season => (
            <div key={season} className="mb-4">
              <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
                Season {season}
              </span>
              <div className="flex flex-col gap-2 mt-2">
                {futureRegulations.filter(r => r.season === season).map(reg => (
                  <RegulationCard key={reg.id} regulation={reg} />
                ))}
              </div>
            </div>
          ))}

          {futureSeasons.length === 0 && (
            <p className="text-xs text-[var(--text-dim)] italic">No upcoming regulation changes announced.</p>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function RuleCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="bg-white/[0.02] rounded-md p-3">
      <div className="text-[9px] font-heading uppercase tracking-wider text-[var(--text-dim)] mb-0.5">
        {label}
      </div>
      <div className="text-xs font-heading font-semibold text-[var(--text-primary)] mb-0.5">
        {value}
      </div>
      <div className="text-[10px] text-[var(--text-secondary)]">{description}</div>
    </div>
  )
}

function RegulationCard({ regulation, isActive = false }: { regulation: { id: string; category: string; title: string; description: string }; isActive?: boolean }) {
  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 ${isActive ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">
          {regulation.title}
        </span>
        <Badge variant={CATEGORY_BADGE[regulation.category] ?? 'neutral'}>
          {regulation.category}
        </Badge>
      </div>
      <p className="text-[10px] text-[var(--text-secondary)]">{regulation.description}</p>
    </div>
  )
}
