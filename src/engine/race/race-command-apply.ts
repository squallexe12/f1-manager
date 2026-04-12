import type { RaceCommandEnvelope } from '@/types/race'
import type { SimRaceState } from './race-simulator'

export interface CommandApplyResult {
  applied: boolean
  driverId: string
  type: RaceCommandEnvelope['type']
}

export function applyCommandEnvelopeToSim(
  sim: SimRaceState,
  envelope: RaceCommandEnvelope,
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
