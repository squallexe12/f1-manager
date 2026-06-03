'use client'

import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import { salariesSpent } from '@/engine/drivers/contract-engine'
import {
  expectedSalary,
  acceptanceFloor,
  evaluateOffer,
  findSlotOccupant,
  type OfferTerms,
  type OfferResult,
  type RosterSlot,
} from '@/engine/drivers/free-agent-signing'
import type { Driver } from '@/types/driver'
import type { PrestigeRating } from '@/types/finance'

export interface FreeAgentSigning {
  driver: Driver
  prestige: PrestigeRating
  askingSalary: number
  acceptanceFloor: number
  budgetCap: number
  currentSalaries: number
  slots: Array<{ slot: RosterSlot; occupant: Driver | null }>
  evaluate: (offer: OfferTerms) => OfferResult
  projectedSalaries: (offer: OfferTerms) => number
  commit: (offer: OfferTerms, slotChoice: RosterSlot) => void
}

export function useFreeAgentSigning(driverId: string | null): FreeAgentSigning | null {
  const slice = useGameStore(
    useShallow((s) => {
      if (!s.world || !driverId) return null
      const playerTeamId = s.world.gameState.playerTeamId
      const driver = s.world.drivers.find((d) => d.id === driverId) ?? null
      if (!driver || driver.teamId !== null) return null // free agents only
      return {
        driver,
        playerTeamId,
        drivers: s.world.drivers,
        prestige: s.world.finance[playerTeamId].prestige,
        budget: s.world.finance[playerTeamId].budget,
        signFreeAgent: s.signFreeAgent,
      }
    }),
  )

  const commit = useCallback(
    (offer: OfferTerms, slotChoice: RosterSlot) => {
      if (!slice) return
      const occupant = findSlotOccupant(
        { drivers: slice.drivers } as never, // findSlotOccupant only reads world.drivers + playerTeamId
        slice.playerTeamId,
        slotChoice,
      )
      slice.signFreeAgent({
        driverId: slice.driver.id,
        offer,
        slotChoice,
        displaceDriverId: occupant?.id ?? null,
      })
    },
    [slice],
  )

  if (!slice) return null

  const { driver, drivers, playerTeamId, prestige, budget } = slice
  const asking = expectedSalary(driver)
  const floor = acceptanceFloor(driver, prestige)
  const currentSalaries = salariesSpent(drivers, playerTeamId)

  const slots: Array<{ slot: RosterSlot; occupant: Driver | null }> = (
    ['CAR-01', 'CAR-02', 'RESERVE'] as RosterSlot[]
  ).map((slot) => ({
    slot,
    occupant: findSlotOccupant({ drivers } as never, playerTeamId, slot),
  }))

  return {
    driver,
    prestige,
    askingSalary: asking,
    acceptanceFloor: floor,
    budgetCap: budget.cap,
    currentSalaries,
    slots,
    evaluate: (offer) => evaluateOffer(driver, offer, prestige),
    projectedSalaries: (offer) => currentSalaries + offer.salary,
    commit,
  }
}
