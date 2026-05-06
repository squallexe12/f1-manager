import type { Driver, DriverPulse } from '@/types/driver'
import { FORM_DNF } from '@/engine/drivers/form-history'
const DETAIL_MAX = 96

export interface PulseContext {
  championshipPositionByDriverId: Record<string, number>
  championshipGapByDriverId: Record<string, number>
  totalDriversInChampionship: number
  currentRound: number
  currentSeason: number
}

/**
 * Per-driver narrative status. Pure, deterministic, branched on observable
 * state. Branch order matters — first match wins. See spec §3.2 for the
 * full table.
 *
 * Never calls Math.random or PRNG. Same input → byte-equal output.
 */
export function derivePulse(driver: Driver, ctx: PulseContext): DriverPulse {
  const pos = ctx.championshipPositionByDriverId[driver.id]
  const gap = ctx.championshipGapByDriverId[driver.id]
  const stats = driver.seasonStats
  const round = ctx.currentRound
  const dnfsRecent = driver.form.slice(-2).filter(p => p >= FORM_DNF).length
  const podiumsLast4 = driver.form.slice(-4).filter(p => p >= 1 && p <= 3).length
  const activePts = driver.penaltyPoints.reduce((s, e) => s + e.points, 0)

  // Branch 1: reserve
  if (driver.isReserve) {
    return finalize('Reserve · race-ready', 'Simulator pace tracking · awaiting call-up window')
  }
  // Branch 2: free agent F2
  if (driver.teamId === null && driver.isF2) {
    return finalize(
      'F2 prospect — on the radar',
      `${driver.scoutingReports} scouting reports filed · ${driver.age} years old`,
    )
  }
  // Branch 3: free agent veteran
  if (driver.teamId === null && !driver.isF2) {
    return finalize(
      'Free agent · seeking seat',
      `${driver.careerStarts} career starts · ${driver.careerWins}W / ${driver.careerPodiums}P`,
    )
  }
  // Branch 4: championship leader
  if (pos === 1) {
    return finalize(
      'Leading the championship',
      `${stats.wins}W in ${round} · +${gap} on P2 · ${stats.dnfs} ${plural('DNF', stats.dnfs)}`,
    )
  }
  // Branch 5: P2/P3 within 25 pts of leader
  if ((pos === 2 || pos === 3) && gap !== undefined && gap >= -25) {
    return finalize(
      'On championship pace',
      `${stats.wins}W in ${round} · trailing leader by ${Math.abs(gap)} pts · ${stats.dnfs} ${plural('DNF', stats.dnfs)}`,
    )
  }
  // Branch 6: hot streak (3+ podiums in last 4)
  if (podiumsLast4 >= 3) {
    return finalize(
      'On a hot streak',
      `${podiumsLast4} podiums in last 4 · best P${stats.bestFinish}`,
    )
  }
  // Branch 7: DNF in last 2 races
  if (dnfsRecent >= 1 && stats.dnfs >= 1) {
    const lastFormEntry = driver.form.length > 0 ? driver.form[driver.form.length - 1] : null
    const lastWasDnf = lastFormEntry !== null && lastFormEntry >= FORM_DNF
    const lastResult = lastWasDnf ? 'DNF' : (driver.lastRaceResult !== null ? `P${driver.lastRaceResult}` : 'DNF')
    return finalize(
      'Reliability under fire',
      `${stats.dnfs} ${plural('DNF', stats.dnfs)} this season · last race ${lastResult}`,
    )
  }
  // Branch 8: stewards circling (>= 9 active penalty points)
  if (activePts >= 9) {
    return finalize(
      'Stewards circling',
      `${activePts} active penalty points · ${driver.warningsThisSeason} warnings`,
    )
  }
  // Branch 9: rookie campaign
  if (driver.attributes.experience < 50 && driver.age <= 23) {
    return finalize(
      'Rookie campaign — finding rhythm',
      `P${stats.bestFinish} best · ${stats.penalties} penalties · qualifying ahead of race-day`,
    )
  }
  // Branch 10: pressure building
  if (driver.mood.frustration >= 70) {
    const lastResult = driver.lastRaceResult === null ? 'DNF' : `P${driver.lastRaceResult}`
    return finalize(
      'Pressure building',
      `P${pos ?? '?'} · last race ${lastResult} · mood deteriorating`,
    )
  }
  // Branch 11: locked in
  if (driver.mood.confidence >= 85 && driver.mood.motivation >= 85) {
    return finalize(
      'Locked in',
      `P${pos ?? '?'} · ${stats.points} pts · ${stats.wins}W in ${stats.lastProcessedRound}`,
    )
  }
  // Branch 12: midfield grind
  if (pos !== undefined && pos >= 11) {
    return finalize(
      'Midfield grind',
      `P${pos} · ${stats.points} pts · best P${stats.bestFinish}`,
    )
  }
  // Branch 13: fallback
  return finalize(
    'Chasing form',
    `P${pos ?? '?'} · ${stats.points} pts · ${round} rounds in`,
  )
}

function plural(word: string, n: number): string {
  return n === 1 ? word : `${word}s`
}

function finalize(headline: string, detail: string): DriverPulse {
  if (detail.length <= DETAIL_MAX) return { headline, detail }
  // Truncate after the last "·" that fits within the cap.
  const cap = detail.slice(0, DETAIL_MAX)
  const lastDot = cap.lastIndexOf(' · ')
  return {
    headline,
    detail: lastDot > 0 ? detail.slice(0, lastDot) : cap,
  }
}
