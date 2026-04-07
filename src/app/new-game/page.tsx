'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScenarioType } from '@/types/game'
import { useGameStore } from '@/stores/game-store'
import { TeamSelector } from '@/components/new-game/team-selector'
import { ScenarioSelector } from '@/components/new-game/scenario-selector'
import { Button } from '@/components/ui/button'

export default function NewGamePage() {
  const router = useRouter()
  const initGame = useGameStore((s) => s.initGame)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(null)
  const [step, setStep] = useState<'team' | 'scenario'>('team')

  function handleTeamSelect(teamId: string) {
    setSelectedTeamId(teamId)
    setSelectedScenario(null) // reset scenario when team changes
  }

  function handleNext() {
    if (step === 'team' && selectedTeamId) {
      setStep('scenario')
    }
  }

  function handleBack() {
    setStep('team')
    setSelectedScenario(null)
  }

  function handleLaunch() {
    if (!selectedTeamId || !selectedScenario) return
    initGame(selectedTeamId, selectedScenario)
    router.push('/paddock')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)] tracking-tight">
          NEW SEASON
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {step === 'team' ? 'Select your constructor' : 'Choose your starting scenario'}
        </p>

        {/* Step indicator */}
        <div className="flex gap-2 mt-4">
          <div className={`h-1 w-16 rounded-full ${step === 'team' ? 'bg-[var(--accent-lime)]' : 'bg-[var(--accent-lime)]/40'}`} />
          <div className={`h-1 w-16 rounded-full ${step === 'scenario' ? 'bg-[var(--accent-lime)]' : 'bg-white/[0.06]'}`} />
        </div>
      </div>

      {/* Content */}
      {step === 'team' ? (
        <>
          <TeamSelector selectedTeamId={selectedTeamId} onSelect={handleTeamSelect} />
          <div className="flex justify-end mt-6">
            <Button
              onClick={handleNext}
              disabled={!selectedTeamId}
            >
              Next: Choose Scenario
            </Button>
          </div>
        </>
      ) : (
        <>
          <ScenarioSelector
            selectedTeamId={selectedTeamId!}
            selectedScenario={selectedScenario}
            onSelect={setSelectedScenario}
          />
          <div className="flex justify-between mt-6">
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
            <Button
              onClick={handleLaunch}
              disabled={!selectedScenario}
            >
              Launch Season
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
