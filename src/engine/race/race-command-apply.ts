import type { RaceCommandEnvelope, RadioCategory } from '@/types/race'
import type { PRNG } from '@/engine/core/prng'
import type { SimRaceState } from './race-simulator'
import { pickRadioMessage, isBroadcastWorthy, type RadioContext } from './radio-picker'

export interface CommandApplyResult {
  applied: boolean
  driverId: string
  type: RaceCommandEnvelope['type']
}

export function applyCommandEnvelopeToSim(
  sim: SimRaceState,
  envelope: RaceCommandEnvelope,
  rng: PRNG,
): CommandApplyResult {
  const result: CommandApplyResult = {
    applied: false,
    driverId: envelope.driverId,
    type: envelope.type,
  }

  const strategy = sim.strategies.find((s) => s.driverId === envelope.driverId)
  if (!strategy) return result

  switch (envelope.type) {
    case 'setCommand': {
      strategy.currentCommand = envelope.payload.command
      result.applied = true

      // Player-only radio side effect: when the player issues push/overtake or
      // conserve/defend, the engineer acknowledges on the radio. AI commands
      // (or unattended sims with no playerTeamId) emit nothing here.
      const driver = sim.drivers.find((d) => d.id === envelope.driverId)
      if (driver && sim.playerTeamId !== undefined && sim.playerTeamId === driver.teamId) {
        const cmd = envelope.payload.command
        let category: RadioCategory | null = null
        if (cmd === 'push' || cmd === 'overtake') category = 'push_now'
        else if (cmd === 'conserve' || cmd === 'defend') category = 'manage_tires'

        if (category) {
          const positions = sim.positions
          const ctx: RadioContext = {
            category,
            speaker: 'engineer',
            driver,
            team: { id: driver.teamId, name: driver.teamId },
            lap: sim.currentLap,
            totalLaps: sim.totalLaps,
            position: positions.indexOf(driver.id) + 1,
            isPlayerTeam: true,
          }
          const raceCtx = {
            championshipRivalIds: sim.championshipRivalIds,
            podiumPositions: positions.slice(0, 3),
            playerDriverIds: sim.playerDriverIds,
          }
          // Player-team always passes isBroadcastWorthy; gate kept for symmetry.
          if (isBroadcastWorthy(category, ctx, raceCtx)) {
            sim.commentary.push(pickRadioMessage(ctx, rng))
          }
        }
      }

      return result
    }
    case 'pit': {
      strategy.plannedStops = [
        { lap: sim.currentLap, compound: envelope.payload.compound },
        ...strategy.plannedStops,
      ]
      strategy.currentCommand = 'pit'
      result.applied = true
      return result
    }
    case 'strategyChange': {
      strategy.plannedStops = envelope.payload.strategy.plannedStops.map((s) => ({ ...s }))
      strategy.currentCommand = envelope.payload.strategy.currentCommand
      result.applied = true
      return result
    }
  }

  return result
}
