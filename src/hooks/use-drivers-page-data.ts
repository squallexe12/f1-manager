'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/stores/game-store'
import {
  computePeerAttributes,
  computeChampionshipSummary,
  buildRivalryIndex,
} from '@/lib/utils/drivers-page'
import type { Driver, DriverAttributes } from '@/types/driver'
import type { Team } from '@/types/team'
import type { RivalryDisplay } from '@/lib/utils/drivers-page'

export interface DriversPageData {
  playerTeam: Team
  roster: {
    car01: Driver | null
    car02: Driver | null
    reserve: Driver | null
  }
  peerAttributes: DriverAttributes
  championshipPositionByDriverId: Record<string, number>
  championshipGapByDriverId: Record<string, number>
  rivalryIndex: Record<string, RivalryDisplay>
  season: number
  currentRound: number
  nextRound: { id: string; name: string } | null
  constructorPosition: number
  rosterCount: { active: number; reserve: number }
  phase: string
}

/**
 * Composes the Drivers page presentation data from world state.
 *
 * Pattern: useShallow selects only stable references (drivers array,
 * teams array, scalar gameState values, and action functions). Derived
 * values that require computation (peerAttributes, championshipSummary,
 * rivalryIndex) are memoised outside the selector to avoid useShallow
 * seeing new object references on every render → infinite loop.
 */
export function useDriversPageData(): DriversPageData | null {
  // Select only stable values — arrays and scalars that change by reference
  // only when the underlying data changes. Functions from the store are
  // stable across renders (Zustand creates them once).
  const slice = useGameStore(useShallow(state => {
    if (!state.world) return null
    return {
      drivers: state.world.drivers,
      teams: state.world.teams,
      calendar: state.world.calendar,
      playerTeamId: state.world.gameState.playerTeamId,
      season: state.world.gameState.season,
      currentRound: state.world.gameState.currentRound,
      phase: state.world.gameState.phase,
    }
  }))

  return useMemo(() => {
    if (!slice) return null

    const {
      drivers, teams, calendar, playerTeamId,
      season, currentRound, phase,
    } = slice

    const playerTeam = teams.find(t => t.id === playerTeamId)
    if (!playerTeam) return null

    const playerDrivers = drivers.filter(d => d.teamId === playerTeam.id && !d.isReserve)
    const reserveDriver = drivers.find(d => d.teamId === playerTeam.id && d.isReserve) ?? null

    const peerAttributes = computePeerAttributes(drivers)
    const championship = computeChampionshipSummary(drivers)
    const rivalryIndex = buildRivalryIndex(drivers, teams)

    const constructorPosition = playerTeam.constructorPosition

    const nextRoundEntry = calendar.find(r => r.round === currentRound + 1)
      ?? calendar.find(r => r.round === currentRound)
    const nextRound = nextRoundEntry
      ? { id: `R${String(nextRoundEntry.round).padStart(2, '0')}`, name: nextRoundEntry.name }
      : null

    return {
      playerTeam,
      roster: {
        car01: playerDrivers[0] ?? null,
        car02: playerDrivers[1] ?? null,
        reserve: reserveDriver,
      },
      peerAttributes,
      championshipPositionByDriverId: championship.positionById,
      championshipGapByDriverId: championship.gapById,
      rivalryIndex,
      season,
      currentRound,
      nextRound,
      constructorPosition,
      phase,
      rosterCount: {
        active: playerDrivers.length,
        reserve: reserveDriver ? 1 : 0,
      },
    }
  }, [slice])
}
