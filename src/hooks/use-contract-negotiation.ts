'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import {
  estimateMarketValue,
  evaluateOffer,
  salariesSpent,
  type ContractOffer,
  type ContractEvaluation,
} from '@/engine/drivers/contract-engine'
import type { Driver } from '@/types/driver'

export interface ContractNegotiation {
  driver: Driver
  marketValue: number
  currentSalaries: number
  budgetCap: number
  evaluate: (offer: ContractOffer) => ContractEvaluation
  previewSalaries: (offerSalary: number) => number
  commit: (offer: ContractOffer) => void
}

export function useContractNegotiation(driverId: string | null): ContractNegotiation | null {
  const slice = useGameStore(
    useShallow((s) => {
      if (!s.world || !driverId) return null
      const playerTeamId = s.world.gameState.playerTeamId
      const driver = s.world.drivers.find((d) => d.id === driverId) ?? null
      const team = s.world.teams.find((t) => t.id === playerTeamId) ?? null
      if (!driver || !team) return null
      return {
        driver,
        team,
        playerTeamId,
        drivers: s.world.drivers,
        budgetCap: s.world.finance[playerTeamId].budget.cap,
        signContract: s.signContract,
      }
    }),
  )

  const evaluate = useCallback(
    (offer: ContractOffer): ContractEvaluation =>
      slice ? evaluateOffer(slice.driver, offer, slice.team) : { accepted: false, satisfaction: 0, counterOffer: null },
    [slice],
  )

  const previewSalaries = useCallback(
    (offerSalary: number): number => {
      if (!slice) return 0
      const current = salariesSpent(slice.drivers, slice.playerTeamId)
      return current - (slice.driver.contract?.salary ?? 0) + offerSalary
    },
    [slice],
  )

  const commit = useCallback(
    (offer: ContractOffer) => slice?.signContract(slice.driver.id, offer),
    [slice],
  )

  if (!slice) return null

  return {
    driver: slice.driver,
    marketValue: estimateMarketValue(slice.driver),
    currentSalaries: salariesSpent(slice.drivers, slice.playerTeamId),
    budgetCap: slice.budgetCap,
    evaluate,
    previewSalaries,
    commit,
  }
}
