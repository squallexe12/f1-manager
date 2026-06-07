import { mixSeed } from '@/engine/race/race-incidents'

/**
 * Single canonical seed-derivation module for the practice + qualifying
 * weekend (plan §4). Every weekend session derives an independent PRNG seed
 * off the per-round RACE seed (`deriveRaceSeed(seed, round)`), so practice,
 * qualifying and the race all branch from the SAME per-round root but into
 * independent, salted streams. Eliminating a car in Q1 can never shift Q3,
 * and a practice draw can never collide with a qualifying draw.
 *
 * Built on the existing 32-bit `mixSeed` hash. The precision-unsafe 64-bit
 * LCG multiplier constant (which exceeds Number.MAX_SAFE_INTEGER and would
 * lose precision before `| 0`) is deliberately NOT used anywhere — a guard
 * test asserts that literal never appears in this file.
 */

/** Distinct salt per weekend session. Standard (Q*) and sprint (SQ*) segments
 *  carry separate salts so the same physical lap in two formats never collides. */
export const SESSION_SALT: Record<string, number> = {
  FP1: 0x0001, FP2: 0x0002, FP3: 0x0003,
  SQ1: 0x0010, SQ2: 0x0011, SQ3: 0x0012,
  Q1: 0x0020, Q2: 0x0021, Q3: 0x0022,
}

/**
 * Derive an independent PRNG seed for one weekend session off the race seed.
 * Unknown keys fall back to salt 0 (defensive; all real callers pass a key
 * present in SESSION_SALT).
 */
export function deriveSessionSeed(raceSeed: number, sessionKey: string): number {
  return mixSeed(raceSeed, SESSION_SALT[sessionKey] ?? 0)
}
