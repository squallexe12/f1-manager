'use client'

import { motion } from 'framer-motion'
import type { LapResult } from '@/types/race'

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

export function TimingTower({ entries, className = '' }: TimingTowerProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`} role="table" aria-label="Live timing tower">
      <div className="flex items-center gap-2 px-2 py-1 text-[9px] font-heading uppercase tracking-wider text-[var(--text-dim)]" role="row">
        <span className="w-6" role="columnheader">POS</span>
        <span className="flex-1" role="columnheader">DRIVER</span>
        <span className="w-16 text-right" role="columnheader">GAP</span>
        <span className="w-20 text-right" role="columnheader">LAST</span>
        <span className="w-8 text-center" role="columnheader">TIRE</span>
      </div>
      {entries.map((entry) => (
        <motion.div
          key={entry.driverId}
          layout
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          role="row"
          aria-label={`P${entry.position} ${entry.driverName}`}
          className={`
            flex items-center gap-2 px-2 py-1.5 rounded
            ${entry.isPlayer ? 'bg-[var(--accent-lime)]/[0.06] border-l-2 border-[var(--accent-lime)]' : 'hover:bg-white/[0.02]'}
          `}
        >
          <span className="w-6 text-xs font-mono text-[var(--text-muted)]">
            {entry.position}
          </span>
          <div className="flex-1 flex items-center gap-1.5">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: entry.teamColor }} />
            <span className={`text-xs font-heading font-semibold ${entry.isPlayer ? 'text-[var(--accent-lime)]' : 'text-[var(--text-primary)]'}`}>
              {entry.driverName}
            </span>
          </div>
          <span className="w-16 text-right text-[10px] font-mono text-[var(--text-muted)]">
            {entry.position === 1 ? 'LEADER' : `+${entry.gapToLeader.toFixed(1)}s`}
          </span>
          <span className="w-20 text-right text-[10px] font-mono text-[var(--text-secondary)]">
            {entry.lastLapTime ? formatTime(entry.lastLapTime) : '—'}
          </span>
          <span className="w-8 text-center text-[9px] font-mono text-[var(--text-dim)]">
            {entry.tire}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
