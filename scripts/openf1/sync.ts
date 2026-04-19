#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CIRCUITS } from '../../src/data/circuits'
import { createOpenF1Client } from './client'
import { mapOpenF1CircuitName } from './circuit-map'
import { normalizeCalibrationProfile } from './normalize'
import type { OpenF1SessionBundle } from './types'

// ---------------------------------------------------------------------------
// Build-time sync — fetches race sessions from api.openf1.org, normalizes them
// into CalibrationProfile JSON files under src/data/calibration/.
//
// Runtime engines never call this script; it exists only at build time.
//
// Usage: npm run sync:openf1 -- --year=2024 [--circuit=bahrain]
// ---------------------------------------------------------------------------

interface CliArgs {
  year: number
  circuit?: string
  throttleMs: number
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {}
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.+)$/)
    if (match) args[match[1]] = match[2]
  }
  const year = Number(args.year ?? new Date().getFullYear() - 1)
  if (!Number.isFinite(year)) {
    throw new Error('Invalid --year argument')
  }
  const throttleMs = Number(args.throttleMs ?? 1500)
  return { year, circuit: args.circuit, throttleMs }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  // Higher retry tolerance helps absorb transient 429s from the public API.
  const client = createOpenF1Client({ retries: 4, retryDelayMs: 1500 })

  const __filename = fileURLToPath(import.meta.url)
  const outDir = resolve(dirname(__filename), '../../src/data/calibration')
  await mkdir(outDir, { recursive: true })

  console.log(`[openf1-sync] Fetching Race sessions for year=${args.year}`)
  const sessions = await client.getSessions({ year: args.year, sessionName: 'Race' })
  console.log(`[openf1-sync] Found ${sessions.length} sessions`)

  const written: string[] = []
  const failed: string[] = []
  let index = 0
  for (const session of sessions) {
    index++
    const circuitId = mapOpenF1CircuitName(session.circuit_short_name)
    if (!circuitId) {
      console.warn(`[openf1-sync] Skipping unknown circuit: "${session.circuit_short_name}"`)
      continue
    }

    if (args.circuit && args.circuit !== circuitId) continue

    const circuit = CIRCUITS.find((c) => c.id === circuitId)
    if (!circuit) {
      console.warn(`[openf1-sync] circuitId "${circuitId}" not present in CIRCUITS, skipping`)
      continue
    }

    // Serialize per-endpoint calls so we don't burst three parallel requests
    // per session and trip the public API's rate limiter.
    try {
      const laps = await client.getLaps(session.session_key)
      await sleep(args.throttleMs)
      const stints = await client.getStints(session.session_key)
      await sleep(args.throttleMs)
      const weather = await client.getWeather(session.session_key)
      await sleep(args.throttleMs)
      const pitStops = await client.getPitStops(session.session_key)

      const bundle: OpenF1SessionBundle = {
        circuitId,
        circuitCompounds: circuit.compounds,
        sessionKey: session.session_key,
        laps,
        stints,
        weather,
        pitStops,
      }

      const profile = normalizeCalibrationProfile(bundle)
      const outPath = join(outDir, `${circuitId}.json`)
      await writeFile(outPath, JSON.stringify(profile, null, 2), 'utf-8')
      written.push(circuitId)
      console.log(`[openf1-sync] Wrote ${outPath} (${index}/${sessions.length})`)
    } catch (err) {
      failed.push(circuitId)
      console.error(`[openf1-sync] Failed for circuit=${circuitId}:`, err)
    }

    if (index < sessions.length) {
      await sleep(args.throttleMs)
    }
  }

  console.log(`[openf1-sync] Done. ${written.length} profile(s) written: ${written.join(', ') || '(none)'}`)
  if (failed.length > 0) {
    console.warn(`[openf1-sync] ${failed.length} profile(s) failed: ${failed.join(', ')}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[openf1-sync] Fatal:', err)
  process.exitCode = 1
})
