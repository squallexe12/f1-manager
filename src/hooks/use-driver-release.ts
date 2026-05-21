'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import { salariesSpent } from '@/engine/drivers/contract-engine'
import { computeSeverance } from '@/engine/drivers/contract-release'
import type { Driver } from '@/types/driver'

export interface DriverRelease {
  driver: Driver
  severance: number
  fromReleaseClause: boolean
  currentSalaries: number
  salariesAfter: number
  operationsBefore: number
  operationsAfter: number
  budgetCap: number
  capRisk: boolean
  wouldLeaveOneRaceDriver: boolean
  commit: () => void
}

export function useDriverRelease(driverId: string | null): DriverRelease | null {
  const slice = useGameStore(
    useShallow((s) => {
      if (!s.world || !driverId) return null
      const playerTeamId = s.world.gameState.playerTeamId
      const driver = s.world.drivers.find((d) => d.id === driverId) ?? null
      // Only meaningful for a contracted player driver.
      if (!driver || driver.teamId !== playerTeamId || !driver.contract) return null
      const budget = s.world.finance[playerTeamId].budget
      return {
        driver,
        playerTeamId,
        drivers: s.world.drivers,
        budget,
        releaseDriver: s.releaseDriver,
      }
    }),
  )

  const commit = useCallback(() => slice?.releaseDriver(slice.driver.id), [slice])

  if (!slice) return null

  const { driver, drivers, playerTeamId, budget } = slice
  const contract = driver.contract! // guarded by the selector
  const severance = computeSeverance(contract)

  const currentSalaries = salariesSpent(drivers, playerTeamId)
  const salariesAfter = currentSalaries - contract.salary
  const operationsBefore = budget.categories.find((c) => c.name === 'Operations')?.spent ?? 0
  const operationsAfter = operationsBefore + severance

  // totalSpent changes by (salariesAfter - currentSalaries) + severance.
  const projectedTotal = budget.totalSpent - contract.salary + severance
  const capRisk = projectedTotal > budget.cap * 0.9

  const raceDrivers = drivers.filter((d) => d.teamId === playerTeamId && !d.isReserve)
  const wouldLeaveOneRaceDriver = !driver.isReserve && raceDrivers.length - 1 < 2

  return {
    driver,
    severance,
    fromReleaseClause: contract.releaseClause != null,
    currentSalaries,
    salariesAfter,
    operationsBefore,
    operationsAfter,
    budgetCap: budget.cap,
    capRisk,
    wouldLeaveOneRaceDriver,
    commit,
  }
}
