'use client'

import type { Race, TireCompound } from '@/types/race'
import { colorForCompound } from '@/components/tire-roles'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import type { CalibrationProfile } from '@/types/calibration'
import type { Recommendation } from '@/types/delegation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StrategyPlanner, type DriverStrategies } from './strategy-planner'
import { RaceIntelPanel } from './race-intel-panel'

interface PracticeProgram {
  id: string
  label: string
  description: string
}

const PRACTICE_PROGRAMS: PracticeProgram[] = [
  { id: 'race-pace', label: 'Race Pace', description: 'Long runs to understand tire degradation and fuel load behavior' },
  { id: 'qualifying-sim', label: 'Qualifying Sim', description: 'Low-fuel hot laps to optimize single-lap performance' },
  { id: 'tire-test', label: 'Tire Test', description: 'Evaluate all three compounds to find the optimal strategy window' },
  { id: 'setup-work', label: 'Setup Work', description: 'Adjust car balance between understeer and oversteer' },
]

interface PreRaceSetupProps {
  race: Race
  playerTeam: Team
  playerDrivers: Driver[]
  phase: 'practice' | 'qualifying'
  onStartSession: (programId: string) => void
  onAdvance: () => void
  onSelectStrategies?: (strategies: DriverStrategies) => void
  /** IP-07: circuit calibration profile — drives the race-intelligence panel */
  calibration?: CalibrationProfile
  /** IP-08: active Race Engineer recommendation (if any) surfaced as a banner */
  raceEngineerRecommendation?: Recommendation
  /** IP-08: apply handler for the Race Engineer recommendation */
  onApplyRecommendation?: (id: string) => void
  className?: string
}

export function PreRaceSetup({
  race,
  playerTeam,
  playerDrivers,
  phase,
  onStartSession,
  onAdvance,
  onSelectStrategies,
  calibration,
  raceEngineerRecommendation,
  onApplyRecommendation,
  className = '',
}: PreRaceSetupProps) {
  const compoundLabels: Record<number, string> = { 0: 'HARD', 1: 'MEDIUM', 2: 'SOFT' }

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Race Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Round {race.round} — {race.name}
          </h2>
          <Badge variant={race.isSprint ? 'cyan' : 'neutral'}>
            {race.isSprint ? 'Sprint Weekend' : 'Standard'}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono text-[var(--text-secondary)]">
          <div>
            <span className="text-[var(--text-dim)] block">Circuit</span>
            {race.circuit.name}
          </div>
          <div>
            <span className="text-[var(--text-dim)] block">Laps</span>
            {race.circuit.laps}
          </div>
          <div>
            <span className="text-[var(--text-dim)] block">Downforce</span>
            {race.circuit.downforceLevel.toUpperCase()}
          </div>
          <div>
            <span className="text-[var(--text-dim)] block">Tire Wear</span>
            {race.circuit.tireWear.toUpperCase()}
          </div>
        </div>
      </div>

      {/* IP-07: Race Intelligence (OpenF1-derived pre-race hints) */}
      {calibration && <RaceIntelPanel circuit={race.circuit} calibration={calibration} />}

      {/* IP-08: Race Engineer recommendation banner (practice only) */}
      {phase === 'practice' && raceEngineerRecommendation && (
        <div
          className="
            border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/[0.05]
            rounded-lg p-3 flex items-center gap-3
            shadow-[0_0_14px_rgba(0,229,255,0.05)]
          "
          role="status"
        >
          <div
            className="
              shrink-0 w-8 h-8 rounded-md grid place-items-center
              bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)]
              text-[10px] font-mono font-bold tracking-wider
            "
            aria-hidden
          >
            RE
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-heading uppercase tracking-wider text-[var(--accent-cyan)]">
              Race Engineer
            </div>
            <p className="text-xs text-[var(--text-primary)] leading-relaxed">
              {raceEngineerRecommendation.description}
            </p>
          </div>
          {raceEngineerRecommendation.applicable && onApplyRecommendation && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onApplyRecommendation(raceEngineerRecommendation.id)}
            >
              Apply
            </Button>
          )}
        </div>
      )}

      {/* Tire Compounds */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Available Compounds
        </h3>
        <div className="flex gap-3">
          {race.circuit.compounds.map((compound, i) => (
            <CompoundChip
              key={compound}
              compound={compound}
              label={compoundLabels[i] ?? ''}
              circuitCompounds={race.circuit.compounds}
            />
          ))}
        </div>
      </div>

      {/* Drivers */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
        <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Drivers
        </h3>
        <div className="flex gap-4">
          {playerDrivers.map(driver => (
            <div key={driver.id} className="flex-1 border border-[var(--border-default)] rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: playerTeam.color }} />
                <div>
                  <div className="text-xs font-heading font-semibold text-[var(--text-primary)]">
                    {driver.firstName} {driver.lastName}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)]">
                    #{driver.shortName}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                <StatCell label="PAC" value={driver.attributes.pace} />
                <StatCell label="RAC" value={driver.attributes.racecraft} />
                <StatCell label="EXP" value={driver.attributes.experience} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Practice Programs (only in practice phase) */}
      {phase === 'practice' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Practice Programs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {PRACTICE_PROGRAMS.map(prog => (
              <button
                key={prog.id}
                onClick={() => onStartSession(prog.id)}
                className="
                  text-left p-3 border border-[var(--border-default)] rounded-md
                  hover:border-[var(--border-hover)] transition-colors duration-150
                  focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50 outline-none
                "
              >
                <div className="text-xs font-heading font-semibold text-[var(--text-primary)] mb-0.5">
                  {prog.label}
                </div>
                <div className="text-[10px] text-[var(--text-dim)]">{prog.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Qualifying Info */}
      {phase === 'qualifying' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-xs font-heading uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Qualifying
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Three-part qualifying determines grid positions. Q1 eliminates the bottom 5, Q2 the next 5, and Q3 determines pole position.
          </p>
          <div className="flex gap-2">
            <Badge variant="neutral">Q1 — All 22</Badge>
            <Badge variant="neutral">Q2 — Top 15</Badge>
            <Badge variant="lime">Q3 — Top 10</Badge>
          </div>
        </div>
      )}

      {/* Strategy Planner (qualifying phase) */}
      {phase === 'qualifying' && onSelectStrategies && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
          <StrategyPlanner
            race={race}
            team={playerTeam}
            playerDrivers={playerDrivers}
            onSelectStrategies={onSelectStrategies}
          />
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={onAdvance}>
          {phase === 'practice' ? 'Advance to Qualifying' : 'Advance to Race'}
        </Button>
      </div>
    </div>
  )
}

function CompoundChip({
  compound,
  label,
  circuitCompounds,
}: {
  compound: TireCompound
  label: string
  circuitCompounds: readonly TireCompound[]
}) {
  const color = colorForCompound(compound, circuitCompounds)

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] rounded-md border border-white/[0.06]">
      <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: color }} />
      <div>
        <div className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{compound}</div>
        <div className="text-[9px] text-[var(--text-dim)]">{label}</div>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[var(--text-dim)]">{label}</div>
      <div className="text-[var(--text-secondary)]">{value}</div>
    </div>
  )
}
