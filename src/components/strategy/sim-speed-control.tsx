'use client'

import type { SimSpeed } from '@/types/race'

interface SimSpeedControlProps {
  currentSpeed: SimSpeed | 'paused'
  onSetSpeed: (speed: SimSpeed) => void
  onPause: () => void
  onResume: () => void
  isPaused: boolean
  className?: string
}

const SPEEDS: { value: SimSpeed; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 'max', label: 'MAX' },
]

export function SimSpeedControl({ currentSpeed, onSetSpeed, onPause, onResume, isPaused, className = '' }: SimSpeedControlProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-dim)] mr-1">
        SIM
      </span>
      {SPEEDS.map(({ value, label }) => (
        <button
          key={label}
          onClick={() => {
            onSetSpeed(value)
            if (isPaused) onResume()
          }}
          className={`
            px-2 py-1 text-[10px] font-mono font-bold rounded
            transition-colors duration-150 outline-none
            focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
            ${!isPaused && currentSpeed === value
              ? 'bg-[var(--accent-lime)] text-[#0A0A0A]'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-hover)]'
            }
          `}
        >
          {label}
        </button>
      ))}
      <button
        onClick={isPaused ? onResume : onPause}
        className={`
          px-2 py-1 text-[10px] font-mono font-bold rounded
          transition-colors duration-150 outline-none
          focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
          ${isPaused
            ? 'bg-[var(--accent-amber)] text-[#0A0A0A]'
            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-hover)]'
          }
        `}
      >
        {isPaused ? '▶' : '⏸'}
      </button>
    </div>
  )
}
