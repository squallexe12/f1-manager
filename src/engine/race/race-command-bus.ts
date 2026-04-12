import type { RaceCommand, RaceCommandEnvelope } from '@/types/race'

export type RaceCommandListener = (envelope: RaceCommandEnvelope) => void

export interface RaceCommandBus {
  dispatch(command: RaceCommand, timestamp?: number): RaceCommandEnvelope
  subscribe(listener: RaceCommandListener): () => void
  getLog(): RaceCommandEnvelope[]
  clear(): void
}

export interface RaceCommandBusOptions {
  now?: () => number
}

export function createRaceCommandBus(options: RaceCommandBusOptions = {}): RaceCommandBus {
  const now = options.now ?? Date.now
  const listeners = new Set<RaceCommandListener>()
  const log: RaceCommandEnvelope[] = []
  let sequence = 0

  return {
    dispatch(command, timestamp): RaceCommandEnvelope {
      const ts = timestamp ?? now()
      const seq = sequence++
      let envelope: RaceCommandEnvelope
      switch (command.type) {
        case 'setCommand':
          envelope = { type: 'setCommand', driverId: command.driverId, payload: command.payload, timestamp: ts, sequence: seq }
          break
        case 'pit':
          envelope = { type: 'pit', driverId: command.driverId, payload: command.payload, timestamp: ts, sequence: seq }
          break
        case 'strategyChange':
          envelope = { type: 'strategyChange', driverId: command.driverId, payload: command.payload, timestamp: ts, sequence: seq }
          break
      }
      log.push(envelope)
      for (const listener of listeners) listener(envelope)
      return envelope
    },

    subscribe(listener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    getLog(): RaceCommandEnvelope[] {
      return log.slice()
    },

    clear(): void {
      log.length = 0
      sequence = 0
    },
  }
}
