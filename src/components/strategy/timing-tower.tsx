'use client'

import { motion } from 'framer-motion'

interface TimingTowerEntry {
  position: number
  driverId: string
  driverName: string
  teamColor: string
  isPlayer: boolean
  gapToLeader: number
  lastLapTime: number | null
  tire: string
}

interface TimingTowerProps {
  entries: TimingTowerEntry[]
  className?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

/** Map a tire compound letter to a Broadcast compound token class. */
function tireColorClass(tire: string): string {
  const t = tire.trim().toUpperCase()
  if (t === 'S' || t.startsWith('SOFT')) return 'text-c-soft'
  if (t === 'M' || t.startsWith('MED')) return 'text-c-med'
  if (t === 'H' || t.startsWith('HARD')) return 'text-c-hard'
  if (t === 'I' || t.startsWith('INT')) return 'text-c-inter'
  if (t === 'W' || t.startsWith('WET')) return 'text-c-wet'
  return 'text-ink-mute'
}

function tireLetter(tire: string): string {
  const t = tire.trim().toUpperCase()
  if (t.startsWith('SOFT')) return 'S'
  if (t.startsWith('MED')) return 'M'
  if (t.startsWith('HARD')) return 'H'
  if (t.startsWith('INT')) return 'I'
  if (t.startsWith('WET')) return 'W'
  return t.charAt(0)
}

export function TimingTower({ entries, className = '' }: TimingTowerProps) {
  return (
    <div
      className={`flex flex-col font-mono text-[12px] bg-surface-paper border border-line-sub rounded-rad overflow-hidden ${className}`}
      role="table"
      aria-label="Live timing tower"
    >
      {/* Header row */}
      <div
        className="grid gap-2 px-3 py-1.5 border-b border-line-sub text-[9px] uppercase tracking-[0.14em] text-ink-dim"
        style={{ gridTemplateColumns: '32px 8px 48px 1fr 70px 64px 40px' }}
        role="row"
      >
        <span role="columnheader" className="text-right">POS</span>
        <span role="columnheader" />
        <span role="columnheader">CODE</span>
        <span role="columnheader">DRIVER</span>
        <span role="columnheader" className="text-right">GAP</span>
        <span role="columnheader" className="text-right">LAST</span>
        <span role="columnheader" className="text-right">TIRE</span>
      </div>

      {entries.map((entry) => {
        const isLeader = entry.position === 1
        return (
          <motion.div
            key={entry.driverId}
            layout
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="row"
            aria-label={`P${entry.position} ${entry.driverName}`}
            className={`
              relative grid gap-2 px-3 py-[7px] border-b border-line-hair items-center
              transition-[background] duration-[120ms]
              ${entry.isPlayer
                ? 'bg-[oklch(0.20_0.03_25_/_0.35)]'
                : 'hover:bg-surface-raised'
              }
            `}
            style={{ gridTemplateColumns: '32px 8px 48px 1fr 70px 64px 40px' }}
          >
            {/* Player indicator bar */}
            {entry.isPlayer && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-sig-red" />
            )}

            {/* POS */}
            <span
              className={`text-right font-display font-bold text-[18px] leading-none tabular-nums tracking-[-0.02em] ${
                isLeader ? 'text-sig-red' : 'text-ink-hi'
              }`}
            >
              {entry.position}
            </span>

            {/* Team bar */}
            <span
              className="w-[4px] h-[22px] rounded-[1px] shrink-0"
              style={{ backgroundColor: entry.teamColor }}
            />

            {/* Driver code */}
            <span className="font-display font-bold text-[13px] text-ink-hi tracking-[0.02em] uppercase truncate">
              {entry.driverName.split(' ').pop()?.slice(0, 3) ?? entry.driverName.slice(0, 3)}
            </span>

            {/* Name group */}
            <div className="flex flex-col gap-0 min-w-0">
              <span className="font-body text-[10px] text-ink-dim tracking-[0.02em] truncate">
                {entry.driverName}
              </span>
            </div>

            {/* Gap */}
            <span
              className={`text-right text-[11px] tabular-nums ${
                isLeader
                  ? 'text-sig-amber font-bold tracking-[0.1em]'
                  : 'text-ink-body'
              }`}
            >
              {isLeader ? 'LEADER' : `+${entry.gapToLeader.toFixed(3)}`}
            </span>

            {/* Last lap */}
            <span className="text-right text-[11px] text-ink-mute tabular-nums">
              {entry.lastLapTime ? formatTime(entry.lastLapTime) : '—'}
            </span>

            {/* Tire */}
            <span className={`text-right text-[11px] font-bold tabular-nums ${tireColorClass(entry.tire)}`}>
              {tireLetter(entry.tire)}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
