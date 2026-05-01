'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TEAMS } from '@/data/teams'
import type { CommentaryEntry, RadioSpeaker, RadioTone } from '@/types/race'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'my-team' | 'fia'

interface TeamRadioPanelProps {
  entries: CommentaryEntry[]
  playerTeamId: string
  className?: string
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

/**
 * Static team-id → livery accent colour lookup, sourced from `src/data/teams.ts`.
 * The radio panel only needs the colour — flatten once at module init so each
 * row render is an O(1) object access rather than an array scan.
 */
const TEAM_COLOR_BY_ID: Record<string, string> = TEAMS.reduce<Record<string, string>>(
  (acc, t) => {
    acc[t.id] = t.color
    return acc
  },
  {},
)

const TEAM_COLOR_FALLBACK = 'var(--line-strong)'

function teamColor(teamId: string | undefined): string {
  if (!teamId) return TEAM_COLOR_FALLBACK
  return TEAM_COLOR_BY_ID[teamId] ?? TEAM_COLOR_FALLBACK
}

/**
 * Tone dot palette. `calm` and `flat` render as transparent so the dot slot
 * is reserved (alignment) but visually empty — only urgent/angry/celebrate
 * surface a coloured signal.
 */
const TONE_DOT_COLOR: Record<RadioTone, string> = {
  calm:      'transparent',
  flat:      'transparent',
  urgent:    'var(--sig-amber)',
  angry:     'var(--sig-red)',
  celebrate: 'var(--sig-green)',
}

/**
 * Convert a world driver id (e.g. `'norris'`) into a 3-letter speaker token
 * (`'NOR'`). Falls back to the full id uppercased for unknown shapes —
 * deterministic, no PRNG.
 */
function driverShort(driverId: string | undefined): string {
  if (!driverId) return '---'
  return driverId.slice(0, 3).toUpperCase()
}

// ─── Speaker pill ─────────────────────────────────────────────────────────────

interface SpeakerPillProps {
  speaker: RadioSpeaker | undefined
  driverId: string | undefined
  teamId: string | undefined
}

function SpeakerPill({ speaker, driverId, teamId }: SpeakerPillProps) {
  if (speaker === 'fia') {
    return (
      <span
        className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] px-[5px] py-[3px] rounded-[1px] leading-none bg-sig-red text-surface-void"
        aria-label="Speaker: Race Control"
      >
        RACE CONTROL
      </span>
    )
  }

  const drv = driverShort(driverId)

  if (speaker === 'engineer') {
    return (
      <span
        className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] px-[5px] py-[3px] rounded-[1px] leading-none border"
        style={{
          color: 'var(--accent-lime)',
          borderColor: 'var(--accent-lime)',
          backgroundColor: 'rgba(204, 255, 0, 0.08)',
        }}
        aria-label={`Speaker: Engineer to ${drv}`}
      >
        ENG → {drv}
      </span>
    )
  }

  // Driver speaker (default): tinted with team livery colour.
  const color = teamColor(teamId)
  return (
    <span
      className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] px-[5px] py-[3px] rounded-[1px] leading-none border"
      style={{
        color,
        borderColor: color,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      }}
      aria-label={`Speaker: Driver ${drv}`}
    >
      {drv}
    </span>
  )
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  ariaLabel?: string
}

function FilterChip({ label, active, onClick, ariaLabel }: FilterChipProps) {
  const baseClass =
    'font-mono text-[9px] font-bold uppercase tracking-[0.16em] px-2 py-[3px] rounded-[1px] leading-none border'
  const activeClass = active
    ? 'text-surface-void'
    : 'text-ink-mute hover:text-ink-body border-line-sub'
  const activeStyle = active
    ? {
        backgroundColor: 'var(--accent-lime)',
        borderColor: 'var(--accent-lime)',
      }
    : undefined

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={`${baseClass} ${activeClass}`}
      style={activeStyle}
    >
      {label}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamRadioPanel({
  entries,
  // playerTeamId is part of the public contract for Task 24's parent wiring.
  // v1 of the panel filters on the per-entry `isPlayerTeam` flag stamped by
  // the simulator at emit time, so this id is intentionally not consumed yet.
  playerTeamId: _playerTeamId,
  className = '',
}: TeamRadioPanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  // First narrow to radio entries only — the panel never shows non-radio items
  // even if the parent passes the full commentary stream.
  const radioEntries = useMemo(
    () => entries.filter((e) => e.severity === 'radio'),
    [entries],
  )

  const visibleEntries = useMemo(() => {
    if (filter === 'my-team') {
      return radioEntries.filter((e) => e.isPlayerTeam === true)
    }
    if (filter === 'fia') {
      return radioEntries.filter((e) => e.speaker === 'fia')
    }
    return radioEntries
  }, [radioEntries, filter])

  // Auto-scroll on new entries unless paused (hover). Watching `length` keeps
  // the effect cheap — entries are append-only so length change == new row.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (pausedRef.current) return
    el.scrollTop = el.scrollHeight
  }, [visibleEntries.length])

  const onMouseEnter = () => {
    pausedRef.current = true
  }
  const onMouseLeave = () => {
    pausedRef.current = false
    // Resume catch-up scroll when the user leaves the feed.
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  return (
    <div
      className={`flex flex-col bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-line-sub bg-surface-paper flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
          Team Radio
        </span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Radio filters">
          <FilterChip
            label="ALL"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            ariaLabel="Filter: all radio messages"
          />
          <FilterChip
            label="MY TEAM"
            active={filter === 'my-team'}
            onClick={() => setFilter('my-team')}
            ariaLabel="Filter: my team only"
          />
          <FilterChip
            label="RACE CONTROL"
            active={filter === 'fia'}
            onClick={() => setFilter('fia')}
            ariaLabel="Filter: race control only"
          />
        </div>
      </div>

      {/* Scroll region */}
      <div
        ref={containerRef}
        className="max-h-[420px] overflow-y-auto"
        role="log"
        aria-label="Team radio feed"
        aria-live="polite"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {visibleEntries.length === 0 ? (
          <p className="px-3.5 py-4 font-mono text-[11px] text-ink-dim italic">
            Standing by...
          </p>
        ) : (
          <div className="flex flex-col gap-px bg-line-hair">
            {visibleEntries.map((entry, i) => {
              const isPlayer = entry.isPlayerTeam === true
              const accent = teamColor(entry.teamId)
              const toneColor =
                entry.tone !== undefined ? TONE_DOT_COLOR[entry.tone] : 'transparent'

              return (
                <motion.div
                  key={`${entry.lap}-${i}-${entry.category ?? 'x'}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`bg-surface-paper grid gap-2.5 px-3.5 py-2 border-b border-line-hair items-start ${
                    !isPlayer ? 'opacity-75' : ''
                  }`}
                  style={{
                    gridTemplateColumns: '32px auto 10px 1fr',
                    borderLeft: `2px solid ${accent}`,
                    boxShadow: isPlayer
                      ? 'inset 0 0 0 1px rgba(0, 229, 255, 0.2)'
                      : undefined,
                  }}
                >
                  {/* Lap marker */}
                  <span className="font-mono text-[10px] text-ink-dim tabular-nums leading-none pt-[5px]">
                    L{entry.lap}
                  </span>

                  {/* Speaker pill */}
                  <div className="flex items-start pt-[2px]">
                    <SpeakerPill
                      speaker={entry.speaker}
                      driverId={entry.driverId}
                      teamId={entry.teamId}
                    />
                  </div>

                  {/* Tone dot */}
                  <span
                    aria-hidden="true"
                    className="block w-[6px] h-[6px] rounded-full mt-[8px]"
                    style={{ backgroundColor: toneColor }}
                  />

                  {/* Transmission text */}
                  <span className="font-body text-[12px] text-ink-body leading-[1.4] italic">
                    {entry.text}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
