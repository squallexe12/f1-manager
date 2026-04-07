'use client'

import { useState } from 'react'
import type { DriverCommand, TireCompound } from '@/types/race'
import { Button } from '@/components/ui/button'

interface DriverCommandsProps {
  driverId: string
  driverName: string
  currentCommand: DriverCommand
  availableCompounds?: TireCompound[]
  onCommand: (driverId: string, command: DriverCommand) => void
  onPitWithCompound?: (driverId: string, compound: TireCompound) => void
  className?: string
}

const COMMANDS: { command: DriverCommand; label: string }[] = [
  { command: 'push', label: 'Push' },
  { command: 'standard', label: 'Standard' },
  { command: 'conserve', label: 'Conserve' },
  { command: 'overtake', label: 'Overtake+' },
  { command: 'defend', label: 'Defend' },
]

// Positional: the 3 race compounds are always Hard (index 0), Medium (1), Soft (2)
const ROLE_COLORS = ['#FFFFFF', '#FFC800', '#FF3B30']
const ROLE_LABELS = ['Hard', 'Medium', 'Soft']

export function DriverCommands({ driverId, driverName, currentCommand, availableCompounds, onCommand, onPitWithCompound, className = '' }: DriverCommandsProps) {
  const [showPitMenu, setShowPitMenu] = useState(false)
  const compounds = availableCompounds ?? ['C1', 'C2', 'C3'] as TireCompound[]

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--text-muted)]">
        {driverName}
      </span>
      <div className="flex flex-wrap gap-1">
        {COMMANDS.map(({ command, label }) => (
          <button
            key={command}
            onClick={() => onCommand(driverId, command)}
            className={`
              px-2.5 py-1 text-[10px] font-heading font-semibold uppercase tracking-wider
              rounded transition-colors duration-150 outline-none
              focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50
              ${currentCommand === command
                ? 'bg-[var(--accent-lime)] text-[#0A0A0A]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-hover)]'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pit Stop with Tire Selection */}
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowPitMenu(!showPitMenu)}
          className="w-fit"
        >
          {showPitMenu ? 'Cancel' : 'PIT NOW'}
        </Button>

        {showPitMenu && (
          <div className="flex gap-1">
            {compounds.map((compound, idx) => (
              <button
                key={compound}
                onClick={() => {
                  onPitWithCompound?.(driverId, compound)
                  setShowPitMenu(false)
                }}
                className="
                  flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold
                  bg-[var(--bg-surface)] border border-[var(--border-default)]
                  hover:border-[var(--border-hover)] transition-colors duration-150
                  focus-visible:ring-2 focus-visible:ring-[var(--accent-lime)]/50 outline-none
                "
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ROLE_COLORS[idx] ?? '#888' }}
                />
                {ROLE_LABELS[idx] ?? compound}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
