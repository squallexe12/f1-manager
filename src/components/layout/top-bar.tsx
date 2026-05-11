'use client'

import { useGameStore } from '@/stores/game-store'
import { useShallow } from 'zustand/react/shallow'
import type { SimSpeed } from '@/types/race'
import { PressBadge } from '@/components/nav/PressBadge'

const SIM_SPEEDS: SimSpeed[] = [1, 2, 5, 'max']

function simSpeedLabel(s: SimSpeed): string {
  return s === 'max' ? 'MAX' : `${s}×`
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'management': return 'MANAGEMENT'
    case 'practice': return 'PRACTICE'
    case 'qualifying': return 'QUALIFYING'
    case 'sprint-qualifying': return 'SPRINT QUALI'
    case 'sprint': return 'SPRINT'
    case 'race': return 'RACE'
    case 'post-race': return 'POST-RACE'
    default: return phase.replace('-', ' ').toUpperCase()
  }
}

function sessionLabel(phase: string): string {
  switch (phase) {
    case 'management': return 'OFF-TRACK'
    case 'practice': return 'FP'
    case 'qualifying': return 'QUALI'
    case 'sprint-qualifying': return 'SPRINT Q'
    case 'sprint': return 'SPRINT'
    case 'race': return 'RACE'
    case 'post-race': return 'DEBRIEF'
    default: return '—'
  }
}

function formatMillions(dollars: number): string {
  const m = dollars / 1_000_000
  if (Math.abs(m) >= 100) return `$${m.toFixed(0)}M`
  return `$${m.toFixed(1)}M`
}

export function TopBar() {
  const data = useGameStore(
    useShallow((s) => {
      if (!s.world) return null
      const { gameState, teams, calendar, finance } = s.world
      const playerTeam = teams.find((t) => t.id === gameState.playerTeamId)
      const playerFinance = playerTeam ? finance[playerTeam.id] : undefined
      const currentRace = calendar[gameState.currentRound - 1]
      return {
        teamShortName: playerTeam?.shortName ?? 'TEAM',
        teamName: playerTeam?.name ?? 'Team',
        season: gameState.season,
        currentRound: gameState.currentRound,
        totalRaces: gameState.totalRaces,
        phase: gameState.phase,
        raceName: currentRace?.name ?? 'Off Season',
        constructorPosition: playerTeam?.constructorPosition ?? 0,
        constructorPoints: playerTeam?.constructorPoints ?? 0,
        morale: playerTeam?.morale ?? 0,
        budgetRemaining: playerFinance
          ? playerFinance.budget.cap - playerFinance.budget.totalSpent
          : 0,
        budgetCap: playerFinance?.budget.cap ?? 0,
        prestige: playerFinance?.prestige ?? '—',
      }
    })
  )

  const race = useGameStore(
    useShallow((s) => ({
      simPhase: s.raceRuntime.phase,
      workerStatus: s.raceRuntime.workerStatus,
      simSpeed: s.raceRuntime.simSpeed,
      currentLap: s.raceRuntime.currentLap,
      totalLaps: s.raceRuntime.totalLaps,
      safetyCar: s.raceRuntime.safetyCar,
      trackTemp: s.raceRuntime.trackTemp,
      weather: s.raceRuntime.weather,
    }))
  )

  const setRacePhase = useGameStore((s) => s.setRacePhase)
  const setRaceSimSpeed = useGameStore((s) => s.setRaceSimSpeed)

  if (!data) return null

  const isLive = race.simPhase === 'running' || race.simPhase === 'paused'
  const isPaused = race.simPhase === 'paused' || race.workerStatus !== 'running'

  // Flag marker state
  let flag: 'green' | 'yellow' | 'red' | 'sc' | 'idle' = 'idle'
  let flagText = 'STANDBY'
  if (isLive) {
    if (race.safetyCar === 'sc') { flag = 'sc'; flagText = 'SC DEPLOYED' }
    else if (race.safetyCar === 'vsc') { flag = 'yellow'; flagText = 'VSC' }
    else { flag = 'green'; flagText = 'GREEN FLAG' }
  } else if (data.phase === 'management') {
    flagText = 'FACTORY'
  } else {
    flagText = phaseLabel(data.phase)
  }

  // Budget formatting
  const budgetText = formatMillions(data.budgetRemaining)

  // Ticker: different content per phase
  const tickerItems: Array<[string, string]> = isLive
    ? [
        ['LAP', `${race.currentLap}/${race.totalLaps}`],
        ['WEATHER', race.weather.current.toUpperCase()],
        ['TRACK', `${Math.round(race.trackTemp)}°C`],
        ['RAIN', `${Math.round(race.weather.rainProbability * 100)}%`],
        ['SC', race.safetyCar === 'green' ? 'NO' : race.safetyCar.toUpperCase()],
        ['TEAM', data.teamName.toUpperCase()],
        ['WCC', `P${data.constructorPosition}`],
        ['BUDGET', budgetText],
      ]
    : [
        ['SEASON', String(data.season)],
        ['ROUND', `${data.currentRound}/${data.totalRaces}`],
        ['NEXT', data.raceName.toUpperCase()],
        ['WCC', `P${data.constructorPosition}`],
        ['POINTS', String(data.constructorPoints)],
        ['BUDGET', budgetText],
        ['CAP', formatMillions(data.budgetCap)],
        ['PRESTIGE', String(data.prestige)],
        ['MORALE', String(data.morale)],
        ['PHASE', phaseLabel(data.phase)],
      ]

  const tickerBlock = (
    <>
      {tickerItems.map(([k, v], i) => (
        <span key={i}>
          <span className="tk-lap">{k}</span>
          <span className="tk-dot" />
          {v}
        </span>
      ))}
    </>
  )

  // Weather right-side panel
  const air = Math.round(race.trackTemp - 8) // best-effort: no ambient-air field in runtime
  const trk = Math.round(race.trackTemp)
  const rain = Math.round(race.weather.rainProbability * 100)

  return (
    <header className="topbar-shell">
      <div className="topbar" role="banner">
        {/* Left: brand */}
        <div className="brand">
          <div className="brand-mark" aria-hidden>P</div>
          <div className="brand-text">
            <div className="b1">Pitwall / Strategy</div>
            <div className="b2">
              Command · Season {data.season} · R{String(data.currentRound).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Center: live stats */}
        <div className="topbar-center">
          <div className="stat">
            <div className="k">Race</div>
            <div className="v">{data.raceName}</div>
          </div>
          <div className="stat">
            <div className="k">Phase</div>
            <div className={`v ${isLive ? 'accent blink' : ''}`}>
              {isLive ? 'LIVE' : phaseLabel(data.phase)}
            </div>
          </div>
          <div className="stat">
            <div className="k">Session</div>
            <div className="v">{sessionLabel(data.phase)}</div>
          </div>
          <div className="stat">
            <div className="k">Budget</div>
            <div className="v green">{budgetText}</div>
          </div>
          <div className="stat">
            <div className="k">WCC</div>
            <div className="v">P{data.constructorPosition}</div>
          </div>
        </div>

        {/* Right: sim controls (race only) or phase badge + press badge */}
        <div className="topbar-right">
          <PressBadge />
          {isLive ? (
            <>
              <button
                type="button"
                className={`sim-btn ${isPaused ? 'danger' : ''}`}
                onClick={() =>
                  setRacePhase(isPaused ? 'running' : 'paused')
                }
                aria-label={isPaused ? 'Resume race' : 'Pause race'}
              >
                {isPaused ? '▶ RESUME' : '❚❚ PAUSE'}
              </button>
              <div className="sim-group" role="group" aria-label="Sim speed">
                {SIM_SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`sim-btn ${s === race.simSpeed ? 'active' : ''}`}
                    onClick={() => setRaceSimSpeed(s)}
                    aria-pressed={s === race.simSpeed}
                    aria-label={s === 'max' ? 'Maximum speed' : `${s} times speed`}
                  >
                    {simSpeedLabel(s)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={`topbar-phase ${isLive ? 'live' : ''}`}>
              <span className="dot" aria-hidden />
              {phaseLabel(data.phase)}
            </div>
          )}
        </div>
      </div>

      {/* Flag strip (bonded to topbar) */}
      <div className="flag-strip" role="status" aria-live="polite">
        <div className={`flag-marker ${flag === 'idle' ? 'idle' : flag}`}>
          {flagText}
        </div>
        <div className="topbar-ticker">
          <div className="topbar-ticker-track">
            {tickerBlock}
            {tickerBlock}
          </div>
        </div>
        <div className="flag-right">
          <span className="fr-item">
            <span className="fr-k">AIR</span>
            <span className="fr-v">{isLive ? `${air}°` : '—'}</span>
          </span>
          <span className="fr-item">
            <span className="fr-k">TRK</span>
            <span className="fr-v">{isLive ? `${trk}°` : '—'}</span>
          </span>
          <span className="fr-item">
            <span className="fr-k">RAIN</span>
            <span className="fr-v">{isLive ? `${rain}%` : '—'}</span>
          </span>
        </div>
      </div>
    </header>
  )
}
