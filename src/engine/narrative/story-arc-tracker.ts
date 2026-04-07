import type { StoryArc, ArcStage, NarrativeEvent, EventThread } from '@/types/narrative'
import type { PRNG } from '@/engine/core/prng'

const STAGE_TRANSITIONS: Record<ArcStage, ArcStage | null> = {
  building: 'escalating',
  escalating: 'climax',
  climax: 'resolution',
  resolution: null,
}

// How many races before an arc stage advances
const STAGE_DURATION: Record<ArcStage, number> = {
  building: 3,
  escalating: 2,
  climax: 1,
  resolution: 1,
}

/**
 * Create a new story arc from an initial event.
 */
export function createArc(
  event: NarrativeEvent,
  currentRound: number,
  driverIds: string[],
  teamIds: string[],
): StoryArc {
  return {
    id: `arc-${event.thread}-${currentRound}`,
    thread: event.thread,
    title: event.headline,
    description: event.body,
    stage: 'building',
    startedAtRound: currentRound,
    involvedDriverIds: driverIds,
    involvedTeamIds: teamIds,
    eventIds: [event.id],
  }
}

/**
 * Advance active arcs by one race. Returns updated arcs and any newly completed arc IDs.
 */
export function advanceArcs(
  arcs: StoryArc[],
  currentRound: number,
  rng: PRNG,
): { updatedArcs: StoryArc[]; completedArcIds: string[] } {
  const completedArcIds: string[] = []

  const updatedArcs = arcs.map(arc => {
    if (arc.stage === 'resolution') {
      // Already resolved, check if it should be cleaned up
      return arc
    }

    const racesInStage = currentRound - arc.startedAtRound
    const stageDuration = STAGE_DURATION[arc.stage]

    // Check if stage should advance
    if (racesInStage >= stageDuration) {
      const nextStage = STAGE_TRANSITIONS[arc.stage]

      if (!nextStage) {
        completedArcIds.push(arc.id)
        return arc
      }

      // Random chance to accelerate (20%) or delay (10%)
      if (rng.chance(0.2)) {
        // Skip to next-next stage if possible
        const skipStage = STAGE_TRANSITIONS[nextStage]
        if (skipStage) {
          return { ...arc, stage: skipStage, startedAtRound: currentRound }
        }
      }

      return { ...arc, stage: nextStage, startedAtRound: currentRound }
    }

    return arc
  })

  return { updatedArcs, completedArcIds }
}

/**
 * Link an event to an existing arc.
 */
export function linkEventToArc(arc: StoryArc, eventId: string): StoryArc {
  return {
    ...arc,
    eventIds: [...arc.eventIds, eventId],
  }
}

/**
 * Clean up resolved arcs older than a threshold.
 */
export function cleanupArcs(arcs: StoryArc[], currentRound: number, maxAge: number = 10): StoryArc[] {
  return arcs.filter(arc => {
    if (arc.stage === 'resolution') {
      return currentRound - arc.startedAtRound < maxAge
    }
    return true
  })
}
