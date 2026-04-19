'use client'

import { useState } from 'react'
import type { DriverCommand, TireCompound } from '@/types/race'

interface DriverCommandsProps {
  driverId: string
  driverName: string
  currentCommand: DriverCommand
  availableCompounds?: TireCompound[]
  onCommand: (driverId: string, command: DriverCommand) => void
  onPitWithCompound?: (driverId: string, compound: TireCompound) => void
  className?: string
}

const COMMANDS: { command: DriverCommand; label: string; type: 'attack' | 'conserve' | 'default' }[] = [
  { command: 'push',     label: 'PUSH',     type: 'attack' },
  { command: 'overtake', label: 'OVERTAKE', type: 'attack' },
  { command: 'standard', label: 'STANDARD', type: 'default' },
  { command: 'defend',   label: 'DEFEND',   type: 'default' },
  { command: 'conserve', label: 'CONSERVE', type: 'conserve' },
]

// Positional: the 3 race compounds are always Hard (index 0), Medium (1), Soft (2)
const ROLE_COLORS = ['#FFFFFF', '#FFC800', '#FF3B30']
const ROLE_LABELS = ['Hard', 'Medium', 'Soft']

function cmdButtonClass(cmd: { command: DriverCommand; type: 'attack' | 'conserve' | 'default' }, isActive: boolean): string {
  const base = `
    font-mono text-[9px] font-semibold uppercase tracking-[0.12em]
    px-1 py-2 rounded-rad cursor-pointer
    transition-[background,border-color,color] duration-[120ms]
    outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50
    border
  `
  if (!isActive) {
    return `${base} bg-surface-raised border-line-hair text-ink-mute hover:bg-surface-hi hover:text-ink-hi`
  }
  if (cmd.type === 'attack') {
    return `${base} bg-sig-red border-sig-red text-white`
  }
  if (cmd.type === 'conserve') {
    return `${base} bg-sig-cyan border-sig-cyan text-surface-void`
  }
  // default active
  return `${base} bg-ink-hi border-ink-hi text-surface-void`
}

export function DriverCommands({ driverId, driverName, currentCommand, availableCompounds, onCommand, onPitWithCompound, className = '' }: DriverCommandsProps) {
  const [showPitMenu, setShowPitMenu] = useState(false)
  const compounds = availableCompounds ?? ['C1', 'C2', 'C3'] as TireCompound[]

  return (
    <div className={`flex flex-col gap-2 bg-surface-paper border border-line-sub rounded-rad p-3 ${className}`}>
      {/* Driver label */}
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">
        {driverName}
      </span>

      {/* 5-col command button grid — one column per command, single aligned row */}
      <div className="grid grid-cols-5 gap-1">
        {COMMANDS.map(({ command, label, type }) => (
          <button
            key={command}
            type="button"
            onClick={() => onCommand(driverId, command)}
            className={cmdButtonClass({ command, type }, currentCommand === command)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pit stop row — radio-line style amber border */}
      <div
        className="relative mt-1 px-2.5 py-2 bg-surface-void border-l-2 border-sig-amber font-mono text-[11px] text-ink-body italic"
      >
        {/* ▸ RADIO label */}
        <span
          className="not-italic absolute -top-[7px] left-2 px-1.5 bg-surface-paper font-mono text-[8px] uppercase tracking-[0.14em] text-sig-amber font-bold"
        >
          ▸ PIT STOP
        </span>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <button
            type="button"
            onClick={() => setShowPitMenu(!showPitMenu)}
            className="
              not-italic font-mono text-[9px] uppercase tracking-[0.12em] font-bold
              px-2.5 py-1 rounded-rad
              bg-sig-red border border-sig-red text-white
              hover:opacity-90
              transition-opacity duration-[120ms]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50
            "
          >
            {showPitMenu ? 'CANCEL' : 'PIT NOW'}
          </button>

          {showPitMenu && (
            <div className="flex gap-1 flex-wrap">
              {compounds.map((compound, idx) => (
                <button
                  key={compound}
                  type="button"
                  onClick={() => {
                    onPitWithCompound?.(driverId, compound)
                    setShowPitMenu(false)
                  }}
                  className="
                    not-italic flex items-center gap-1 px-2 py-1 rounded-rad
                    font-mono text-[9px] font-bold uppercase tracking-[0.1em]
                    bg-surface-raised border border-line-sub text-ink-hi
                    hover:bg-surface-hi hover:border-line-strong
                    transition-[background,border-color] duration-[120ms]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sig-red/50
                  "
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: ROLE_COLORS[idx] ?? '#888' }}
                  />
                  {ROLE_LABELS[idx] ?? compound}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
