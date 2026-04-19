'use client'

import { useState } from 'react'
import type { Race, Circuit, TireCompound } from '@/types/race'
import { colorForCompound, roleForCompound } from '@/components/tire-roles'
import type { Driver } from '@/types/driver'
import type { Team } from '@/types/team'
import type { CalibrationProfile } from '@/types/calibration'
import type { Recommendation } from '@/types/delegation'
import { Button } from '@/components/ui/button'
import { StrategyPlanner, type DriverStrategies } from './strategy-planner'
import { RaceIntelPanel } from './race-intel-panel'

interface PracticeProgram {
  id: string
  label: string
  icon: string
  description: string
}

const PRACTICE_PROGRAMS: PracticeProgram[] = [
  { id: 'race-pace', label: 'Race Pace', icon: 'R', description: 'Long runs to understand tire degradation and fuel load behavior' },
  { id: 'qualifying-sim', label: 'Qualifying Sim', icon: 'Q', description: 'Low-fuel hot laps to optimize single-lap performance' },
  { id: 'tire-test', label: 'Tire Test', icon: 'T', description: 'Evaluate all three compounds to find the optimal strategy window' },
  { id: 'setup-work', label: 'Setup Work', icon: 'S', description: 'Adjust car balance between understeer and oversteer' },
]

// Setup characteristics derived from circuit data — no numeric sliders exist
// in the current store; info cards are used per .setup-grid fallback (Step 4.5).
// IP-P1: pitLaneLoss / overtakeOpportunity not on Circuit type; using available fields only.
const SETUP_ITEMS: { key: keyof Circuit; label: string }[] = [
  { key: 'downforceLevel', label: 'Downforce Level' },
  { key: 'tireWear', label: 'Tire Wear' },
  { key: 'overtakingDifficulty', label: 'Overtaking Difficulty' },
  { key: 'weatherVariability', label: 'Weather Variability' },
]

type ActiveTab = 'sessions' | 'setup' | 'intel' | 'planner'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions & Programs' },
  { id: 'setup', label: 'Setup' },
  { id: 'intel', label: 'Intel' },
  { id: 'planner', label: 'Planner' },
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('sessions')
  // Track previous phase via useState so we can reset the tab during render
  // without useEffect (avoids react-hooks/set-state-in-effect lint error).
  const [prevPhase, setPrevPhase] = useState(phase)
  if (prevPhase !== phase) {
    setPrevPhase(phase)
    setActiveTab('sessions')
  }

  const compoundLabels: Record<number, string> = { 0: 'HARD', 1: 'MEDIUM', 2: 'SOFT' }

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {/* ── Hero: .pre-wrap layout ──────────────────────────────────────────── */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        {/* .pre-left */}
        <div className="relative overflow-hidden rounded-rad border border-line-sub bg-surface-paper p-8 flex flex-col gap-5">
          {/* Gradient ellipse — ref app.css .pre-left::before */}
          <div
            className="pointer-events-none absolute top-0 right-0 h-[200%] w-1/2"
            style={{
              background: 'radial-gradient(ellipse at 100% 0%, oklch(0.26 0.08 25 / 0.3), transparent 60%)',
            }}
            aria-hidden
          />

          {/* Round badge — .pre-round */}
          <div className="font-mono text-[11px] tracking-[0.3em] text-sig-red font-bold uppercase relative">
            Round {race.round}
            {race.isSprint && (
              <span className="ml-3 px-2 py-0.5 rounded-[2px] border border-sig-amber/50 bg-sig-amber/10 text-sig-amber text-[9px] tracking-[0.14em]">
                Sprint Weekend
              </span>
            )}
          </div>

          {/* Race name — .pre-name */}
          <div>
            <div
              className="font-display font-extrabold text-ink-hi leading-[0.9] tracking-tight relative"
              style={{ fontSize: 'clamp(32px, 4vw, 64px)', maxWidth: '520px' }}
            >
              {race.name}
            </div>
            {/* Location — .pre-loc */}
            <div className="font-mono text-[12px] tracking-[0.2em] text-ink-mute uppercase mt-2 relative">
              {race.circuit.name}
            </div>
          </div>

          {/* Stats row — .pre-stats */}
          <div
            className="grid gap-5 border-t border-line-hair pt-5 relative"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            <StatBlock k="Laps" v={String(race.circuit.laps)} />
            <StatBlock k="Downforce" v={race.circuit.downforceLevel.toUpperCase()} />
            <StatBlock k="Tire Wear" v={race.circuit.tireWear.toUpperCase()} />
            <StatBlock k="Circuit" v={race.circuit.name.substring(0, 8).toUpperCase()} />
          </div>

          {/* Available compounds (rel.) */}
          <div className="flex gap-2 relative">
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

        {/* .pre-drivers */}
        <div className="rounded-rad border border-line-sub bg-surface-paper overflow-hidden">
          {/* Panel head */}
          <div className="flex items-center px-4 py-2.5 border-b border-line-hair bg-surface-raised">
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-hi font-semibold">
              Drivers
            </span>
          </div>

          {/* Driver rows — .pre-driver */}
          {playerDrivers.map(driver => (
            <div
              key={driver.id}
              className="relative grid items-center border-b border-line-hair last:border-b-0 px-4 py-4"
              style={{ gridTemplateColumns: '60px 1fr auto' }}
            >
              {/* Team color left border — .pre-driver::before */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: playerTeam.color }}
                aria-hidden
              />
              {/* .pre-num */}
              <div
                className="font-display font-extrabold text-ink-hi leading-none"
                style={{ fontSize: '42px', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}
              >
                {/* Driver.number not in type — fallback to 0, mirrors Task 2 leaderNumber={0} pattern */}
                {'—'}
              </div>
              {/* .pre-driver-body */}
              <div className="flex flex-col gap-0.5">
                <div className="font-display font-bold text-[18px] text-ink-hi">
                  {driver.firstName} {driver.lastName}
                </div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-ink-dim uppercase">
                  {driver.shortName}
                </div>
              </div>
              {/* Driver stats mini-grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="PAC" value={driver.attributes.pace} />
                <MiniStat label="RAC" value={driver.attributes.racecraft} />
                <MiniStat label="EXP" value={driver.attributes.experience} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── IP-08: Race Engineer recommendation banner ──────────────────────── */}
      {phase === 'practice' && raceEngineerRecommendation && (
        <div
          className="border border-sig-cyan/40 bg-sig-cyan/[0.05] rounded-rad p-3 flex items-center gap-3"
          style={{ boxShadow: '0 0 14px rgba(0,229,255,0.05)' }}
          role="status"
        >
          <div
            className="shrink-0 w-8 h-8 rounded-rad grid place-items-center bg-sig-cyan/15 text-sig-cyan text-[10px] font-mono font-bold tracking-wider"
            aria-hidden
          >
            RE
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-sig-cyan">
              Race Engineer
            </div>
            <p className="text-[12px] text-ink-hi leading-relaxed">
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

      {/* ── Tab bar — .phase-switcher aesthetic (inline, not fixed) ────────── */}
      <div className="flex gap-1 p-1.5 rounded-rad border border-line-sub bg-surface-paper w-fit">
        {TABS.map(tab => {
          // Hide Planner tab in practice phase (planner only relevant for qualifying onwards)
          if (tab.id === 'planner' && phase === 'practice') return null
          // Hide Intel tab if no calibration data
          if (tab.id === 'intel' && !calibration) return null

          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'font-mono text-[9px] tracking-[0.14em] uppercase font-semibold px-2.5 py-1.5 rounded-[calc(var(--rad)-2px)] outline-none',
                'transition-[background,color] duration-[120ms]',
                'focus-visible:ring-2 focus-visible:ring-sig-red/50',
                isActive
                  ? 'bg-ink-hi text-surface-void'
                  : 'text-ink-mute hover:text-ink-body bg-transparent',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}

      {/* SESSIONS & PROGRAMS */}
      {activeTab === 'sessions' && (
        <div className="flex flex-col gap-4">
          {/* Session status cards — .session-row */}
          <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <SessionCard
              label="Practice"
              title={phase === 'practice' ? 'FP1' : 'DONE'}
              status={phase === 'practice' ? 'active' : 'done'}
              subtitle={phase === 'practice' ? 'Free Practice 1' : 'Completed'}
            />
            <SessionCard
              label="Qualifying"
              title="QUALI"
              status={phase === 'qualifying' ? 'active' : phase === 'practice' ? 'pending' : 'done'}
              subtitle="All 22 → Q1 · Q2 · Q3"
            />
            <SessionCard
              label="Race"
              title="RACE"
              status="pending"
              subtitle={`${race.circuit.laps} laps`}
            />
          </div>

          {/* Practice programs — .prog-grid (only in practice phase) */}
          {phase === 'practice' && (
            <>
              <div className="font-mono text-[10px] tracking-[0.16em] text-ink-dim uppercase font-semibold">
                Practice Programs
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {PRACTICE_PROGRAMS.map(prog => (
                  <button
                    key={prog.id}
                    onClick={() => onStartSession(prog.id)}
                    className={[
                      'text-left rounded-rad border border-line-sub bg-surface-paper p-4 flex flex-col gap-2.5 min-h-[160px] relative overflow-hidden',
                      'transition-[border-color,background] duration-[120ms]',
                      'hover:border-sig-red hover:bg-surface-raised',
                      'focus-visible:ring-2 focus-visible:ring-sig-red/50 outline-none',
                    ].join(' ')}
                  >
                    {/* Icon letter — .prog-ic */}
                    <div
                      className="font-display font-extrabold text-ink-hi leading-none"
                      style={{ fontSize: '38px', letterSpacing: '-0.04em' }}
                    >
                      {prog.icon}
                    </div>
                    {/* Name — .prog-name */}
                    <div className="font-display font-bold text-[14px] text-ink-hi">
                      {prog.label}
                    </div>
                    {/* Description — .prog-desc */}
                    <div className="font-body text-[11px] text-ink-mute leading-[1.4] flex-1">
                      {prog.description}
                    </div>
                    {/* Laps indicator */}
                    <div className="font-mono text-[9px] text-ink-dim tracking-[0.16em]">
                      15–20 LAPS
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Qualifying info (qualifying phase) */}
          {phase === 'qualifying' && (
            <div className="rounded-rad border border-line-sub bg-surface-paper overflow-hidden">
              <div className="px-4 py-3 border-b border-line-hair bg-surface-raised">
                <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-hi font-semibold">
                  Qualifying Format
                </span>
              </div>
              <div className="p-4">
                <p className="font-body text-[13px] text-ink-mute leading-relaxed mb-4">
                  Three-part qualifying determines grid positions. Q1 eliminates the bottom 5, Q2 the next 5, and Q3 determines pole position.
                </p>
                {/* IP-P1: qualifying grid dropped — no pre-race qualifying results in store */}
                <div className="flex gap-2">
                  <QualiBadge label="Q1" sub="All 22" />
                  <QualiBadge label="Q2" sub="Top 15" />
                  <QualiBadge label="Q3" sub="Top 10" accent />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SETUP TAB — .setup-grid fallback (no numeric sliders in store) */}
      {activeTab === 'setup' && (
        <div className="rounded-rad border border-line-sub bg-surface-paper overflow-hidden">
          <div className="px-4 py-3 border-b border-line-hair bg-surface-raised">
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ink-hi font-semibold">
              Circuit Characteristics
            </span>
            <span className="ml-3 font-mono text-[9px] text-ink-dim tracking-[0.1em]">
              {race.circuit.name}
            </span>
          </div>
          {/* .setup-grid 2-column */}
          <div className="grid grid-cols-2 gap-5 p-5">
            {SETUP_ITEMS.map(item => {
              const raw = race.circuit[item.key]
              const val = raw != null ? String(raw) : '—'
              return (
                <div key={item.key} className="flex flex-col gap-2">
                  {/* .setup-row */}
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-mute">
                      {item.label}
                    </span>
                    <span className="font-mono font-bold text-[14px] text-ink-hi uppercase">
                      {val}
                    </span>
                  </div>
                  {/* .setup-track visual bar */}
                  <SetupTrack value={val} />
                </div>
              )
            })}

            {/* Compound availability */}
            <div className="col-span-2 flex flex-col gap-2">
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-mute">
                  Compounds Available
                </span>
                <span className="font-mono font-bold text-[14px] text-ink-hi">
                  {race.circuit.compounds.length}
                </span>
              </div>
              <div className="flex gap-2">
                {race.circuit.compounds.map((c, i) => {
                  const label = ({ 0: 'HARD', 1: 'MEDIUM', 2: 'SOFT' } as Record<number, string>)[i] ?? ''
                  return <CompoundChip key={c} compound={c} label={label} circuitCompounds={race.circuit.compounds} />
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTEL TAB */}
      {activeTab === 'intel' && calibration && (
        <RaceIntelPanel circuit={race.circuit} calibration={calibration} />
      )}

      {/* PLANNER TAB */}
      {activeTab === 'planner' && onSelectStrategies && (
        <StrategyPlanner
          race={race}
          team={playerTeam}
          playerDrivers={playerDrivers}
          onSelectStrategies={onSelectStrategies}
        />
      )}

      {/* ── Action CTA ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button size="lg" onClick={onAdvance}>
          {phase === 'practice' ? 'Advance to Qualifying' : 'Advance to Race'}
        </Button>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBlock({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-[0.16em] text-ink-dim uppercase">{k}</span>
      <span className="font-mono font-bold text-[20px] text-ink-hi" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {v}
      </span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[9px] text-ink-dim uppercase tracking-wider">{label}</span>
      <span className="font-mono text-[12px] font-bold text-ink-body">{value}</span>
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
  const role = roleForCompound(compound, circuitCompounds)
  const bgClass =
    role === 'soft' ? 'bg-c-soft/15' : role === 'medium' ? 'bg-c-med/15' : 'bg-c-hard/10'

  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${bgClass} rounded-rad border border-line-hair`}>
      <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: color }} />
      <div>
        <div className="font-mono text-[10px] font-bold text-ink-hi">{compound}</div>
        <div className="font-mono text-[9px] text-ink-dim">{label}</div>
      </div>
    </div>
  )
}

function SessionCard({
  label,
  title,
  status,
  subtitle,
}: {
  label: string
  title: string
  status: 'done' | 'active' | 'pending'
  subtitle: string
}) {
  const borderClass =
    status === 'active' ? 'border-sig-red' : 'border-line-sub'
  const bgClass =
    status === 'active'
      ? 'bg-[linear-gradient(180deg,oklch(0.22_0.04_25_/_0.2),var(--bg-paper))]'
      : 'bg-surface-paper'

  return (
    <div className={`relative overflow-hidden rounded-rad border ${borderClass} ${bgClass} p-4 flex flex-col gap-2.5`}>
      {/* Status badge */}
      {status === 'done' && (
        <span className="absolute top-3 right-3 font-mono text-[8px] tracking-[0.2em] text-sig-green font-bold">
          COMPLETE
        </span>
      )}
      {status === 'active' && (
        <span className="absolute top-3 right-3 font-mono text-[9px] tracking-[0.2em] text-sig-red font-bold">
          ◉ LIVE
        </span>
      )}

      {/* Label — .session-k */}
      <div className="font-mono text-[10px] tracking-[0.2em] text-ink-dim uppercase">
        {label}
      </div>
      {/* Title — .session-t */}
      <div className="font-display font-extrabold text-ink-hi leading-none" style={{ fontSize: '32px', letterSpacing: '-0.02em' }}>
        {title}
      </div>
      {/* Subtitle — .session-time */}
      <div className="font-mono text-[12px] text-ink-mute">
        {subtitle}
      </div>
      {/* Progress bar — .session-progbar */}
      <div className="h-[3px] rounded-[1px] overflow-hidden bg-surface-void">
        <div
          className="h-full bg-sig-red"
          style={{ width: status === 'done' ? '100%' : status === 'active' ? '45%' : '0%' }}
        />
      </div>
    </div>
  )
}

function QualiBadge({ label, sub, accent = false }: { label: string; sub: string; accent?: boolean }) {
  return (
    <div
      className={[
        'flex flex-col items-center px-4 py-2 rounded-rad border font-mono',
        accent
          ? 'border-sig-red/50 bg-sig-red/10 text-sig-red'
          : 'border-line-sub bg-surface-raised text-ink-mute',
      ].join(' ')}
    >
      <span className="text-[12px] font-bold tracking-[0.08em]">{label}</span>
      <span className="text-[9px] tracking-[0.14em] text-ink-dim">{sub}</span>
    </div>
  )
}

// .setup-track — visual-only track bar (no slider, fallback per Step 4.5)
// Maps string values (low/medium/high) to a fill percentage.
function SetupTrack({ value }: { value: string }) {
  const fillMap: Record<string, number> = {
    low: 25, medium: 50, high: 75, '1': 10, '2': 20, '3': 30,
  }
  const fill = fillMap[value.toLowerCase()] ?? 50
  // Direction: values >50 fill right from center, <50 fill left from center
  const isRight = fill >= 50
  const fillWidth = Math.abs(fill - 50) * 2
  const fillLeft = isRight ? '50%' : `${50 - fillWidth / 2}%`

  return (
    <div
      className="relative h-6 rounded-[1px] overflow-hidden border border-line-hair bg-surface-void"
    >
      {/* Mid marker */}
      <div
        className="absolute top-0 bottom-0 w-px z-10"
        style={{ left: '50%', background: 'var(--line-strong)' }}
      />
      {/* Fill */}
      <div
        className="absolute top-0 bottom-0 bg-sig-red"
        style={{
          left: fillLeft,
          width: `${fillWidth}%`,
        }}
      />
      {/* Tick marks */}
      <div className="absolute inset-0 flex justify-between items-center px-0.5 pointer-events-none">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="w-px h-2 bg-line-hair" />
        ))}
      </div>
    </div>
  )
}
