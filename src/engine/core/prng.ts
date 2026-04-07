// Mulberry32 — fast, deterministic 32-bit PRNG
export interface PRNG {
  next(): number
  range(min: number, max: number): number
  chance(probability: number): boolean
  pick<T>(array: T[]): T
  shuffle<T>(array: T[]): T[]
}

export function createPRNG(seed: number): PRNG {
  let state = seed | 0

  function next(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min)
    },
    chance(probability: number): boolean {
      return next() < probability
    },
    pick<T>(array: T[]): T {
      return array[Math.floor(next() * array.length)]
    },
    shuffle<T>(array: T[]): T[] {
      const result = [...array]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    },
  }
}
