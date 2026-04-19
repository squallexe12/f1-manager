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
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 5, label: '5×' },
  { value: 'max', label: 'MAX' },
]

export function SimSpeedControl({ currentSpeed, onSetSpeed, onPause, onResume, isPaused, className = '' }: SimSpeedControlProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim mr-1">SIM</span>

      {/* Speed buttons — .sim-group */}
      <div className="inline-flex border border-line-sub rounded-rad overflow-hidden">
        {SPEEDS.map(({ value, label }) => {
          const isActive = !isPaused && currentSpeed === value
          return (
            <button
              key={label}
              onClick={() => {
                onSetSpeed(value)
                if (isPaused) onResume()
              }}
              className={[
                'border-r border-line-hair last:border-r-0 px-2.5 py-1.5',
                'font-mono text-[10px] uppercase tracking-[0.12em]',
                'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
                'transition-[background,border-color] duration-[120ms]',
                isActive
                  ? 'bg-sig-red text-surface-void'
                  : 'bg-surface-raised text-ink-body hover:bg-surface-hi hover:border-line-strong',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Pause / resume — standalone .sim-btn */}
      <button
        onClick={isPaused ? onResume : onPause}
        className={[
          'px-2.5 py-1.5 rounded-rad border',
          'font-mono text-[10px] uppercase tracking-[0.12em]',
          'outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50',
          'transition-[background,border-color] duration-[120ms]',
          isPaused
            ? 'bg-sig-amber text-surface-void border-sig-amber'
            : 'bg-surface-raised text-ink-body border-line-sub hover:bg-surface-hi hover:border-line-strong',
        ].join(' ')}
      >
        {isPaused ? '▶' : '⏸'}
      </button>
    </div>
  )
}
