import { describe, it, expect } from 'vitest'
import { simulateRace, type RaceSetup, type RaceDriver } from '@/engine/race/race-simulator'
import type { TireCompound, RaceStrategy, RaceIncident } from '@/types/race'

/**
 * Tier B v2 — pit-lane determinism HARD GATE.
 *
 * A seeded full-race scenario with multiple pit stops must produce
 * byte-identical output across two runs. If this test fails after any change
 * to pit-lane FSM, sub-step PRNG ordering, or simulatePitLane orchestration,
 * the change DOES NOT SHIP — root-cause first, paper over second.
 */

function makeRaceDriver(id: string, idx: number): RaceDriver {
  return {
    id,
    shortName: id.toUpperCase(),
    teamId: `team-${idx}`,
    car: {
      downforce: 80, straightSpeed: 80, reliability: 80,
      tireManagement: 80, braking: 80, cornering: 80,
    },
    attributes: {
      pace: 80, racecraft: 78, experience: 70, mentality: 75,
      marketability: 60, developmentPotential: 60,
    },
    mood: { motivation: 50, frustration: 30, confidence: 60 },
  }
}

function makeRaceSetup(): RaceSetup {
  const ids = ['drv-a', 'drv-b', 'drv-c', 'drv-d', 'drv-e', 'drv-f', 'drv-g', 'drv-h']
  const drivers = ids.map((id, idx) => makeRaceDriver(id, idx))
  // Staggered planned stops so multiple cars enter the pit lane on the same
  // lap on at least a few laps — exercises the multi-car PRNG ordering.
  const strategies: RaceStrategy[] = drivers.map((d, idx) => ({
    driverId: d.id,
    plannedStops: [
      { lap: 10 + (idx % 3), compound: 'C3' as TireCompound },
      { lap: 20 + (idx % 3), compound: 'C2' as TireCompound },
    ],
    currentCommand: 'standard' as const,
  }))
  return {
    drivers,
    circuit: {
      id: 'silverstone',
      name: 'Silverstone',
      laps: 30,
      tireWear: 'medium',
      overtakingDifficulty: 'medium',
      weatherVariability: 'low',
      compounds: ['C2', 'C3', 'C4'],
    },
    strategies,
    weather: 'dry',
    gridOrder: drivers.map((d) => d.id),
  }
}

describe('pit-lane determinism HARD GATE', () => {
  it('two seeded race runs produce byte-identical output', () => {
    const a = simulateRace(makeRaceSetup(), 4242)
    const b = simulateRace(makeRaceSetup(), 4242)

    // Final positions must match exactly.
    expect(a.finalPositions).toEqual(b.finalPositions)

    // Lap-by-lap timing must match exactly.
    expect(a.lapData.length).toBe(b.lapData.length)
    for (let lap = 0; lap < a.lapData.length; lap++) {
      const lapA = a.lapData[lap]
      const lapB = b.lapData[lap]
      expect(lapA.length).toBe(lapB.length)
      for (let i = 0; i < lapA.length; i++) {
        expect(lapA[i].driverId).toBe(lapB[i].driverId)
        expect(lapA[i].lapTime).toBe(lapB[i].lapTime)
        expect(lapA[i].position).toBe(lapB[i].position)
        expect(lapA[i].pitted).toBe(lapB[i].pitted)
      }
    }

    // Incident streams must match exactly (ids included — sub-step PRNG
    // ordering is the load-bearing invariant).
    expect(a.incidents.length).toBe(b.incidents.length)
    for (let i = 0; i < a.incidents.length; i++) {
      expect(a.incidents[i]).toEqual(b.incidents[i])
    }

    // Fastest lap must match.
    expect(a.fastestLap).toEqual(b.fastestLap)
  })

  it('different seeds produce different output (sanity check that determinism is real, not accidental)', () => {
    const a = simulateRace(makeRaceSetup(), 1)
    const b = simulateRace(makeRaceSetup(), 2)
    // At minimum, lap-time variance noise should differ.
    const sumA = a.lapData.flat().reduce((s, r) => s + r.lapTime, 0)
    const sumB = b.lapData.flat().reduce((s, r) => s + r.lapTime, 0)
    expect(sumA).not.toBe(sumB)
  })

  // ─── Tier C IP-C5: pit-line white-line crossing determinism ──────────────────
  //
  // The byte-identical incident-stream assertion above implicitly covers
  // pit-line-crossing incidents (offence `pit-line-crossing`, finalised id
  // `pl-<lap>-<driverId>-<boundary>`). This dedicated case makes that explicit
  // for regression protection: it finds a seed whose forced-pit-stop scenario
  // actually fires ≥1 crossing, runs it twice, and deep-equals the filtered
  // crossing sub-stream. If the white-line detector draw ever drifts out of its
  // appended-per-car position, the finalised ids diverge and this fails first.
  it('pit-line white-line crossings are byte-identical across two seeded runs', () => {
    const isPitLineCrossing = (i: RaceIncident): boolean =>
      i.type === 'penalty-issued' && i.offenceType === 'pit-line-crossing'

    // Seed-search for a scenario that actually produces a crossing so the
    // equality assertion is exercised against real ids, not two empty arrays.
    let firingSeed: number | null = null
    for (let seed = 4242; seed <= 4242 + 200; seed++) {
      const run = simulateRace(makeRaceSetup(), seed)
      if (run.incidents.some(isPitLineCrossing)) {
        firingSeed = seed
        break
      }
    }
    expect(firingSeed, 'expected at least one seed in [4242, 4442] to fire a pit-line crossing').not.toBeNull()

    const a = simulateRace(makeRaceSetup(), firingSeed!)
    const b = simulateRace(makeRaceSetup(), firingSeed!)

    const crossingsA = a.incidents.filter(isPitLineCrossing)
    const crossingsB = b.incidents.filter(isPitLineCrossing)

    expect(crossingsA.length).toBeGreaterThan(0)
    expect(crossingsA).toEqual(crossingsB)
  })
})
