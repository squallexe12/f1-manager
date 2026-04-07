import type { Race } from '@/types/race'
import { CIRCUITS } from './circuits'

// 2026 F1 Calendar — sprint weekends marked
const SPRINT_CIRCUIT_IDS = new Set([
  'montreal', 'zandvoort', 'singapore', 'silverstone', 'interlagos', 'austin',
])

const CALENDAR_ORDER = [
  'melbourne', 'shanghai', 'suzuka', 'bahrain', 'jeddah', 'miami',
  'imola', 'monaco', 'montreal', 'barcelona', 'spielberg', 'silverstone',
  'spa', 'zandvoort', 'monza', 'baku', 'singapore', 'austin',
  'mexico', 'interlagos', 'las-vegas', 'abu-dhabi',
]

export const CALENDAR: Race[] = CALENDAR_ORDER.map((circuitId, index) => {
  const circuit = CIRCUITS.find(c => c.id === circuitId)!
  return {
    id: `race-${index + 1}`,
    name: circuit.name,
    circuit,
    round: index + 1,
    isSprint: SPRINT_CIRCUIT_IDS.has(circuitId),
  }
})
