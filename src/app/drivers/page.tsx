'use client'

import { useState } from 'react'
import { useRequireGame } from '@/hooks/use-require-game'
import { PageShell } from '@/components/layout/page-shell'
import { DriverProfile } from '@/components/drivers/driver-profile'
import { MoodTracker } from '@/components/drivers/mood-tracker'
import { ContractPanel } from '@/components/drivers/contract-panel'
import { ScoutPanel } from '@/components/drivers/scout-panel'
import { PenaltyRecordSection } from '@/components/drivers/penalty-record-section'
import { Button } from '@/components/ui/button'

type Tab = 'car-01' | 'car-02' | 'reserve' | 'scout'

export default function DriversPage() {
  const world = useRequireGame()
  const [activeTab, setActiveTab] = useState<Tab>('car-01')

  if (!world) return null

  const playerTeam = world.teams.find((t) => t.id === world.gameState.playerTeamId)!
  const playerDrivers = world.drivers.filter(d => d.teamId === playerTeam.id && !d.isReserve)
  const reserveDriver = world.drivers.find(d => d.teamId === playerTeam.id && d.isReserve)
  const freeAgents = world.drivers.filter(d => !d.teamId)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'car-01', label: `Car 01 — ${playerDrivers[0]?.shortName ?? ''}` },
    { id: 'car-02', label: `Car 02 — ${playerDrivers[1]?.shortName ?? ''}` },
    { id: 'reserve', label: 'Reserve' },
    { id: 'scout', label: 'Scout' },
  ]

  const getDriver = () => {
    if (activeTab === 'car-01') return playerDrivers[0]
    if (activeTab === 'car-02') return playerDrivers[1]
    if (activeTab === 'reserve') return reserveDriver
    return null
  }

  const currentDriver = getDriver()

  return (
    <PageShell>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-xs font-heading font-semibold uppercase tracking-wider
              rounded-md transition-colors duration-150 whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-[var(--accent-lime)]/10 text-[var(--accent-lime)] border border-[var(--accent-lime)]/30'
                : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)] border border-transparent'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'scout' ? (
        <ScoutPanel scouts={freeAgents} onApproach={() => {}} onFileReport={() => {}} />
      ) : currentDriver ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DriverProfile driver={currentDriver} teamColor={playerTeam.color} />
          <div className="flex flex-col gap-4">
            <MoodTracker mood={currentDriver.mood} />
            <ContractPanel
              contract={currentDriver.contract}
              driverName={`${currentDriver.firstName} ${currentDriver.lastName}`}
            />
            <PenaltyRecordSection
              driver={currentDriver}
              currentSeason={world.gameState.season}
              currentRound={world.gameState.currentRound}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-dim)]">No driver assigned to this slot.</p>
        </div>
      )}
    </PageShell>
  )
}
