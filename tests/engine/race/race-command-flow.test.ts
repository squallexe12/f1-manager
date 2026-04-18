import { describe, it, expect } from 'vitest'
import { createRaceCommandBus } from '@/engine/race/race-command-bus'
import { applyCommandEnvelopeToSim } from '@/engine/race/race-command-apply'
import type { RaceCommandEnvelope, RaceStrategy } from '@/types/race'
import type { SimRaceState } from '@/engine/race/race-simulator'
import { createFallbackProfile } from '@/types/calibration'

function makeSim(): SimRaceState {
  const strategies: RaceStrategy[] = [
    { driverId: 'd1', plannedStops: [{ lap: 25, compound: 'C1' }], currentCommand: 'standard' },
    { driverId: 'd2', plannedStops: [], currentCommand: 'standard' },
  ]
  return {
    currentLap: 10,
    totalLaps: 50,
    weather: { current: 'dry', rainProbability: 0, changeInLaps: null },
    safetyCar: 'green',
    trackTemp: 40,
    results: [],
    incidents: [],
    commentary: [],
    drivers: [],
    circuit: { tireWear: 'medium', overtakingDifficulty: 'medium', weatherVariability: 'medium' },
    calibration: createFallbackProfile('test-circuit'),
    strategies,
    tireStates: {},
    positions: ['d1', 'd2'],
  }
}

describe('race command bus', () => {
  it('dispatches a setCommand envelope with a sequence and timestamp', () => {
    const bus = createRaceCommandBus({ now: () => 1000 })
    const envelope = bus.dispatch({
      type: 'setCommand',
      driverId: 'd1',
      payload: { command: 'push' },
    })
    expect(envelope.type).toBe('setCommand')
    expect(envelope.driverId).toBe('d1')
    expect(envelope.payload).toEqual({ command: 'push' })
    expect(envelope.timestamp).toBe(1000)
    expect(envelope.sequence).toBe(0)
  })

  it('assigns monotonically increasing sequence numbers', () => {
    const bus = createRaceCommandBus()
    const a = bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'push' } })
    const b = bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'conserve' } })
    const c = bus.dispatch({ type: 'pit', driverId: 'd1', payload: { compound: 'C3' } })
    expect(a.sequence).toBe(0)
    expect(b.sequence).toBe(1)
    expect(c.sequence).toBe(2)
  })

  it('notifies all subscribers on dispatch', () => {
    const bus = createRaceCommandBus()
    const seen1: RaceCommandEnvelope[] = []
    const seen2: RaceCommandEnvelope[] = []
    bus.subscribe((e) => seen1.push(e))
    bus.subscribe((e) => seen2.push(e))
    bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'push' } })
    expect(seen1).toHaveLength(1)
    expect(seen2).toHaveLength(1)
  })

  it('subscribe returns an unsubscribe function that stops delivery', () => {
    const bus = createRaceCommandBus()
    const seen: RaceCommandEnvelope[] = []
    const unsubscribe = bus.subscribe((e) => seen.push(e))
    bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'push' } })
    unsubscribe()
    bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'conserve' } })
    expect(seen).toHaveLength(1)
    expect(seen[0].payload).toEqual({ command: 'push' })
  })

  it('retains a log of all dispatched envelopes', () => {
    const bus = createRaceCommandBus()
    bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'push' } })
    bus.dispatch({ type: 'pit', driverId: 'd2', payload: { compound: 'C5' } })
    const log = bus.getLog()
    expect(log).toHaveLength(2)
    expect(log[0].driverId).toBe('d1')
    expect(log[1].driverId).toBe('d2')
  })

  it('getLog returns a copy so external mutation does not corrupt internal state', () => {
    const bus = createRaceCommandBus()
    bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'push' } })
    const log = bus.getLog()
    log.length = 0
    expect(bus.getLog()).toHaveLength(1)
  })

  it('clear resets log and sequence counter', () => {
    const bus = createRaceCommandBus()
    bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'push' } })
    bus.clear()
    expect(bus.getLog()).toHaveLength(0)
    const next = bus.dispatch({ type: 'setCommand', driverId: 'd1', payload: { command: 'conserve' } })
    expect(next.sequence).toBe(0)
  })

  it('envelopes are JSON round-trippable without data loss', () => {
    const bus = createRaceCommandBus({ now: () => 42 })
    const envelope = bus.dispatch({
      type: 'pit',
      driverId: 'd1',
      payload: { compound: 'C5' },
    })
    const json = JSON.stringify(envelope)
    const restored = JSON.parse(json) as RaceCommandEnvelope
    expect(restored).toEqual(envelope)
  })

  it('strategyChange envelopes carry the full strategy payload intact through JSON', () => {
    const bus = createRaceCommandBus()
    const strategy: RaceStrategy = {
      driverId: 'd1',
      plannedStops: [{ lap: 18, compound: 'C3' }, { lap: 40, compound: 'C5' }],
      currentCommand: 'standard',
    }
    const env = bus.dispatch({ type: 'strategyChange', driverId: 'd1', payload: { strategy } })
    const restored = JSON.parse(JSON.stringify(env))
    expect(restored.payload.strategy).toEqual(strategy)
  })
})

describe('applyCommandEnvelopeToSim', () => {
  it('applies a setCommand envelope to the matching driver strategy', () => {
    const sim = makeSim()
    const envelope: RaceCommandEnvelope = {
      type: 'setCommand', driverId: 'd1', payload: { command: 'push' }, timestamp: 0, sequence: 0,
    }
    const res = applyCommandEnvelopeToSim(sim, envelope)
    expect(res.applied).toBe(true)
    expect(sim.strategies[0].currentCommand).toBe('push')
  })

  it('applies a pit envelope by prepending a pit stop and setting pit command', () => {
    const sim = makeSim()
    const envelope: RaceCommandEnvelope = {
      type: 'pit', driverId: 'd1', payload: { compound: 'C5' }, timestamp: 0, sequence: 0,
    }
    const res = applyCommandEnvelopeToSim(sim, envelope)
    expect(res.applied).toBe(true)
    expect(sim.strategies[0].currentCommand).toBe('pit')
    expect(sim.strategies[0].plannedStops[0]).toEqual({ lap: sim.currentLap, compound: 'C5' })
    expect(sim.strategies[0].plannedStops).toHaveLength(2)
  })

  it('applies a strategyChange envelope, replacing plannedStops and command', () => {
    const sim = makeSim()
    const envelope: RaceCommandEnvelope = {
      type: 'strategyChange',
      driverId: 'd1',
      payload: {
        strategy: {
          driverId: 'd1',
          plannedStops: [{ lap: 15, compound: 'C3' }],
          currentCommand: 'conserve',
        },
      },
      timestamp: 0,
      sequence: 0,
    }
    const res = applyCommandEnvelopeToSim(sim, envelope)
    expect(res.applied).toBe(true)
    expect(sim.strategies[0].plannedStops).toEqual([{ lap: 15, compound: 'C3' }])
    expect(sim.strategies[0].currentCommand).toBe('conserve')
  })

  it('returns applied=false when the driver is not in the sim', () => {
    const sim = makeSim()
    const envelope: RaceCommandEnvelope = {
      type: 'setCommand', driverId: 'ghost', payload: { command: 'push' }, timestamp: 0, sequence: 0,
    }
    const res = applyCommandEnvelopeToSim(sim, envelope)
    expect(res.applied).toBe(false)
    expect(sim.strategies[0].currentCommand).toBe('standard')
    expect(sim.strategies[1].currentCommand).toBe('standard')
  })

  it('later commands replace earlier ones', () => {
    const sim = makeSim()
    applyCommandEnvelopeToSim(sim, {
      type: 'setCommand', driverId: 'd1', payload: { command: 'push' }, timestamp: 0, sequence: 0,
    })
    applyCommandEnvelopeToSim(sim, {
      type: 'setCommand', driverId: 'd1', payload: { command: 'conserve' }, timestamp: 1, sequence: 1,
    })
    expect(sim.strategies[0].currentCommand).toBe('conserve')
  })
})
